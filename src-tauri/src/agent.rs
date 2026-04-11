use crate::constants::SAMPLE_DIFF;
use crate::models::{AgentStateEvent, ApprovalWaitOutcome, SimulatedStep, StopState};
use crate::state::{ExecutionRuntime, SharedState};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub(crate) fn spawn_cli_agent(
    app: AppHandle,
    state: State<SharedState>,
    spec_payload: String,
    mode: String,
    model: String,
    reasoning: String,
) -> Result<(), String> {
    let runtime = state.runtime.clone();
    let run_id = {
        let mut control = runtime
            .control
            .lock()
            .map_err(|_| String::from("Execution lock was poisoned."))?;
        control.run_id = control.run_id.wrapping_add(1);
        control.awaiting_approval = false;
        control.stop_requested = false;
        control.run_id
    };

    thread::spawn(move || {
        run_simulated_agent(app, runtime, run_id, spec_payload, mode, model, reasoning);
    });

    Ok(())
}

#[tauri::command]
pub(crate) fn approve_action(state: State<SharedState>) -> Result<(), String> {
    let mut control = state
        .runtime
        .control
        .lock()
        .map_err(|_| String::from("Execution lock was poisoned."))?;
    control.awaiting_approval = false;
    state.runtime.signal.notify_all();
    Ok(())
}

#[tauri::command]
pub(crate) fn kill_agent_process(state: State<SharedState>) -> Result<(), String> {
    let mut control = state
        .runtime
        .control
        .lock()
        .map_err(|_| String::from("Execution lock was poisoned."))?;
    control.stop_requested = true;
    control.awaiting_approval = false;
    state.runtime.signal.notify_all();
    Ok(())
}

pub(crate) fn run_simulated_agent(
    app: AppHandle,
    runtime: Arc<ExecutionRuntime>,
    run_id: u64,
    spec_payload: String,
    mode: String,
    model: String,
    reasoning: String,
) {
    let heading_count = spec_payload
        .lines()
        .filter(|line| line.trim_start().starts_with('#'))
        .count();
    let steps = build_simulated_steps(heading_count, &mode, &model, &reasoning);
    emit_state(&app, "executing", Some("Pre-flight Check"), None, None);

    for step in steps {
        match stop_state(&runtime, run_id) {
            StopState::Continue => {}
            StopState::StopRequested => {
                emit_line(
                    &app,
                    "Execution interrupted before the next step could run.",
                );
                emit_state(
                    &app,
                    "halted",
                    Some(step.milestone),
                    None,
                    Some("Execution interrupted by the operator."),
                );
                return;
            }
            StopState::Replaced => return,
        }

        thread::sleep(Duration::from_millis(step.delay_ms));
        match stop_state(&runtime, run_id) {
            StopState::Continue => {}
            StopState::StopRequested => {
                emit_line(
                    &app,
                    "Execution interrupted before the next step could run.",
                );
                emit_state(
                    &app,
                    "halted",
                    Some(step.milestone),
                    None,
                    Some("Execution interrupted by the operator."),
                );
                return;
            }
            StopState::Replaced => return,
        }
        emit_state(&app, "executing", Some(step.milestone), None, None);
        emit_line(&app, &step.line);

        if step.gate {
            let summary = if mode == "stepped" {
                "Stepped approval required before the next write action."
            } else {
                "Milestone boundary reached. Review the diff before execution resumes."
            };

            match wait_for_approval(&app, &runtime, run_id, step.milestone, summary) {
                Ok(ApprovalWaitOutcome::Approved) => {}
                Ok(ApprovalWaitOutcome::StopRequested) => {
                    emit_line(&app, "Execution interrupted during approval gate.");
                    emit_state(
                        &app,
                        "halted",
                        Some(step.milestone),
                        None,
                        Some("Execution interrupted by the operator."),
                    );
                    return;
                }
                Ok(ApprovalWaitOutcome::Replaced) => return,
                Err(message) => {
                    emit_line(&app, &message);
                    emit_state(
                        &app,
                        "error",
                        Some(step.milestone),
                        None,
                        Some("Approval synchronization failed."),
                    );
                    return;
                }
            }

            emit_line(&app, "Approval received. Resuming the agent loop.");
        }
    }

    if !matches!(stop_state(&runtime, run_id), StopState::Continue) {
        return;
    }

    emit_line(
        &app,
        "Execution complete. Final diff is ready for inspection.",
    );
    emit_state(
        &app,
        "completed",
        Some("Execution Complete"),
        Some(SAMPLE_DIFF),
        Some("Simulated agent execution completed successfully."),
    );
}

pub(crate) fn build_simulated_steps(
    heading_count: usize,
    mode: &str,
    model: &str,
    reasoning: &str,
) -> Vec<SimulatedStep> {
    let mut steps = vec![
        SimulatedStep {
            delay_ms: 450,
            line: format!(
                "Loaded approved specification with {heading_count} markdown headings into {model} using the {reasoning} reasoning profile."
            ),
            milestone: "Pre-flight Check",
            gate: false,
        },
        SimulatedStep {
            delay_ms: 650,
            line: String::from(
                "Scanning CLI availability and staging the current repository diff.",
            ),
            milestone: "Pre-flight Check",
            gate: false,
        },
        SimulatedStep {
            delay_ms: 750,
            line: String::from(
                "Mapping milestones for review UI, Zustand stores, and Tauri commands.",
            ),
            milestone: "Milestone Planning",
            gate: false,
        },
    ];

    if mode == "stepped" {
        steps.push(SimulatedStep {
            delay_ms: 650,
            line: String::from(
                "A write action is ready to execute against the approved specification.",
            ),
            milestone: "Stepped Approval",
            gate: true,
        });
    }

    steps.extend([
        SimulatedStep {
            delay_ms: 700,
            line: String::from(
                "Applying Dracula theme tokens and composing the review workspace shell.",
            ),
            milestone: "Compose Review Workspace",
            gate: false,
        },
        SimulatedStep {
            delay_ms: 650,
            line: String::from(
                "Wiring project, settings, and agent stores into the execution dashboard.",
            ),
            milestone: "Compose Review Workspace",
            gate: false,
        },
    ]);

    if mode == "milestone" {
        steps.push(SimulatedStep {
            delay_ms: 650,
            line: String::from("The first milestone is complete and ready for diff review."),
            milestone: "Milestone Approval",
            gate: true,
        });
    }

    steps.extend([
        SimulatedStep {
            delay_ms: 650,
            line: String::from("Streaming terminal telemetry and enabling approval controls."),
            milestone: "Execution Dashboard",
            gate: false,
        },
        SimulatedStep {
            delay_ms: 550,
            line: String::from("Packaging a final summary for IDE handoff."),
            milestone: "Execution Dashboard",
            gate: false,
        },
    ]);

    steps
}

pub(crate) fn wait_for_approval(
    app: &AppHandle,
    runtime: &Arc<ExecutionRuntime>,
    run_id: u64,
    milestone: &str,
    summary: &str,
) -> Result<ApprovalWaitOutcome, String> {
    emit_state(
        app,
        "awaiting_approval",
        Some(milestone),
        Some(SAMPLE_DIFF),
        Some(summary),
    );

    let mut control = runtime
        .control
        .lock()
        .map_err(|_| String::from("Execution lock was poisoned."))?;
    control.awaiting_approval = true;
    runtime.signal.notify_all();

    while control.run_id == run_id && control.awaiting_approval && !control.stop_requested {
        control = runtime
            .signal
            .wait(control)
            .map_err(|_| String::from("Execution lock was poisoned."))?;
    }

    if control.stop_requested {
        return Ok(ApprovalWaitOutcome::StopRequested);
    }

    if control.run_id != run_id {
        return Ok(ApprovalWaitOutcome::Replaced);
    }

    Ok(ApprovalWaitOutcome::Approved)
}

pub(crate) fn stop_state(runtime: &Arc<ExecutionRuntime>, run_id: u64) -> StopState {
    runtime
        .control
        .lock()
        .map(|control| {
            if control.stop_requested {
                StopState::StopRequested
            } else if control.run_id != run_id {
                StopState::Replaced
            } else {
                StopState::Continue
            }
        })
        .unwrap_or(StopState::StopRequested)
}

pub(crate) fn emit_line(app: &AppHandle, line: &str) {
    let _ = app.emit("cli-output", line.to_string());
}

pub(crate) fn emit_state(
    app: &AppHandle,
    status: &str,
    current_milestone: Option<&str>,
    pending_diff: Option<&str>,
    summary: Option<&str>,
) {
    let payload = AgentStateEvent {
        status: status.to_string(),
        current_milestone: current_milestone.map(|value| value.to_string()),
        pending_diff: pending_diff.map(|value| value.to_string()),
        summary: summary.map(|value| value.to_string()),
    };
    let _ = app.emit("agent-state", payload);
}
