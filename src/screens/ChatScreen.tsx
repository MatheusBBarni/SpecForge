import {
  ArrowRight,
  Attachment,
  ChatBubble,
  ChatLines,
  CheckCircle,
  EditPencil,
  Refresh,
  SendSolid,
  Settings,
  Trash,
  WarningCircle,
  XmarkCircle
} from "iconoir-react";
import { useMemo, useState } from "react";

import { getModelOptions, getReasoningOptions } from "../lib/agentConfig";
import { isOpenableWorkspacePath } from "../lib/appShell";
import { DiffPreview } from "../components/DiffPreview";
import type {
  AutonomyMode,
  ChatContextItem,
  ChatSession,
  ChatSessionSummary,
  ModelProvider,
  WorkspaceEntry
} from "../types";

interface ChatScreenProps {
  workspaceRootName: string;
  sessions: ChatSessionSummary[];
  activeSession: ChatSession | null;
  activeDraft: string;
  workspaceEntries: WorkspaceEntry[];
  configuredModelProviders: ModelProvider[];
  cavemanReady: boolean;
  cavemanMessage: string;
  cavemanChecking: boolean;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onDraftChange: (value: string) => void;
  onRefresh: () => void;
  onRemoveContextItem: (itemId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onSaveSessionConfig: (payload: {
    sessionId: string;
    selectedModel: ChatSession["selectedModel"];
    selectedReasoning: ChatSession["selectedReasoning"];
    autonomyMode: AutonomyMode;
    contextItems: ChatContextItem[];
  }) => void;
  onSelectSession: (sessionId: string) => void;
  onSend: () => void;
  onStop: () => void;
  onApprove: () => void;
  onAttachFile: (path: string) => void;
  onOpenReview: () => void;
}

const AUTONOMY_OPTIONS: AutonomyMode[] = ["stepped", "milestone", "god_mode"];

export function ChatScreen({
  workspaceRootName,
  sessions,
  activeSession,
  activeDraft,
  workspaceEntries,
  configuredModelProviders,
  cavemanReady,
  cavemanMessage,
  cavemanChecking,
  onCreateSession,
  onDeleteSession,
  onDraftChange,
  onRefresh,
  onRemoveContextItem,
  onRenameSession,
  onSaveSessionConfig,
  onSelectSession,
  onSend,
  onStop,
  onApprove,
  onAttachFile,
  onOpenReview
}: ChatScreenProps) {
  const [topicSearch, setTopicSearch] = useState("");
  const [contextSearch, setContextSearch] = useState("");
  const mentionQuery = useMemo(() => {
    const match = activeDraft.match(/(?:^|\s)@([^\s@]*)$/);
    return match?.[1]?.toLowerCase() ?? "";
  }, [activeDraft]);
  const visibleSessions = useMemo(
    () =>
      sessions.filter((session) =>
        `${session.title} ${session.lastMessagePreview}`
          .toLowerCase()
          .includes(topicSearch.trim().toLowerCase())
      ),
    [sessions, topicSearch]
  );
  const attachableFiles = useMemo(
    () =>
      workspaceEntries.filter(
        (entry) =>
          entry.kind === "file" &&
          isOpenableWorkspacePath(entry.path) &&
          `${entry.name} ${entry.path}`
            .toLowerCase()
            .includes((mentionQuery || contextSearch).trim().toLowerCase())
      ),
    [contextSearch, mentionQuery, workspaceEntries]
  );
  const messageCount = activeSession?.messages.length ?? 0;
  const canSend = Boolean(activeSession && activeDraft.trim() && cavemanReady && !activeSession.runtime.isBusy);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-4 lg:px-5 lg:pb-5">
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <aside className={PANEL_CLASS}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">Topics</p>
              <h1 className="m-0 text-lg font-semibold text-[var(--text-main)]">{workspaceRootName}</h1>
            </div>
            <button className={PRIMARY_BUTTON_CLASS} onClick={onCreateSession} type="button">
              <ChatBubble className="size-4" />
              New
            </button>
          </div>

          <input
            className={INPUT_CLASS}
            onChange={(event) => setTopicSearch(event.target.value)}
            placeholder="Search topics"
            value={topicSearch}
          />

          <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
            {visibleSessions.map((session) => (
              <button
                className={`${TOPIC_CARD_CLASS} ${session.id === activeSession?.id ? "border-[var(--accent)]/40 bg-white/9" : ""}`}
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-left">
                    <div className="truncate text-sm font-semibold text-[var(--text-main)]">{session.title}</div>
                    <div className="line-clamp-2 pt-1 text-xs leading-5 text-[var(--text-subtle)]">{session.lastMessagePreview || "No messages yet."}</div>
                  </div>
                  <span className="rounded-full border border-[var(--border-soft)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                    {session.status.replace("_", " ")}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {activeSession ? (
            <div className="grid gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 p-3">
              <button
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  const nextTitle = window.prompt("Rename topic", activeSession.title)?.trim();
                  if (nextTitle) {
                    onRenameSession(activeSession.id, nextTitle);
                  }
                }}
                type="button"
              >
                <EditPencil className="size-4" />
                Rename
              </button>
              <button className={DANGER_BUTTON_CLASS} onClick={() => onDeleteSession(activeSession.id)} type="button">
                <Trash className="size-4" />
                Delete
              </button>
            </div>
          ) : null}
        </aside>

        <section className={PANEL_CLASS}>
          <header className="flex items-center justify-between gap-4 border-b border-[var(--border-strong)] pb-4">
            <div className="min-w-0">
              <p className="mb-1 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">Agent Chat</p>
              <h2 className="m-0 truncate text-xl font-semibold text-[var(--text-main)]">{activeSession?.title ?? "No topic selected"}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button className={SECONDARY_BUTTON_CLASS} onClick={onOpenReview} type="button">
                Review
                <ArrowRight className="size-4" />
              </button>
              <button className={SECONDARY_BUTTON_CLASS} onClick={onRefresh} type="button">
                <Refresh className="size-4" />
              </button>
            </div>
          </header>

          {!cavemanReady ? (
            <div className="mt-4 flex items-start gap-3 rounded-[1rem] border border-[rgba(255,184,108,0.25)] bg-[rgba(255,184,108,0.12)] px-4 py-3 text-sm text-[var(--text-main)]">
              <WarningCircle className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" />
              <div>{cavemanChecking ? "Verifying Caveman skill..." : cavemanMessage}</div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto py-4 pr-2">
            {activeSession ? (
              <div className="space-y-4">
                {activeSession.messages.map((message) => (
                  <article
                    className={`rounded-[1.2rem] border px-4 py-4 ${
                      message.role === "assistant"
                        ? "mr-12 border-[var(--border-soft)] bg-[var(--bg-surface)]/85"
                        : "ml-12 border-[var(--accent)]/28 bg-[linear-gradient(135deg,rgba(189,147,249,0.16),rgba(139,233,253,0.08))]"
                    }`}
                    key={message.id}
                  >
                    <div className="mb-2 text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-[var(--accent-2)]">{message.role}</div>
                    <div className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-main)]">{message.content}</div>
                  </article>
                ))}
                {messageCount === 0 ? (
                  <div className="grid min-h-[14rem] place-items-center rounded-[1.2rem] border border-dashed border-[var(--border-soft)] bg-[var(--bg-surface)]/60 p-8 text-center text-sm leading-7 text-[var(--text-subtle)]">
                    Start a topic. PRD, SPEC, supporting docs, and the workspace tree are already attached to the first turn.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid min-h-[14rem] place-items-center rounded-[1.2rem] border border-dashed border-[var(--border-soft)] bg-[var(--bg-surface)]/60 p-8 text-center text-sm leading-7 text-[var(--text-subtle)]">
                Create a topic to start the agent chat workspace.
              </div>
            )}
          </div>

          <footer className="border-t border-[var(--border-strong)] pt-4">
            <textarea
              className="min-h-[9rem] w-full resize-none rounded-[1.2rem] border border-[var(--border-soft)] bg-black/20 px-4 py-4 text-[15px] leading-7 text-[var(--text-main)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="Ask the agent anything about this topic. Type @ to attach a workspace file."
              value={activeDraft}
            />
            {mentionQuery.length > 0 ? (
              <div className="mt-3 max-h-44 overflow-auto rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)]/90 p-2">
                {attachableFiles.slice(0, 8).map((entry) => (
                  <button className={LIST_ITEM_CLASS} key={entry.path} onClick={() => onAttachFile(entry.path)} type="button">
                    <Attachment className="size-4" />
                    {entry.path}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-subtle)]">
                <ChatLines className="size-4 text-[var(--accent-2)]" />
                {activeSession?.runtime.executionSummary ?? "Ready for the next prompt."}
              </div>
              <div className="flex flex-wrap gap-2">
                {activeSession?.runtime.awaitingApproval ? (
                  <button className={PRIMARY_BUTTON_CLASS} onClick={onApprove} type="button">
                    <CheckCircle className="size-4" />
                    Approve
                  </button>
                ) : null}
                {activeSession?.runtime.isBusy ? (
                  <button className={DANGER_BUTTON_CLASS} onClick={onStop} type="button">
                    <XmarkCircle className="size-4" />
                    Stop
                  </button>
                ) : null}
                <button className={`${PRIMARY_BUTTON_CLASS} ${!canSend ? "cursor-not-allowed opacity-50 hover:translate-y-0" : ""}`} disabled={!canSend} onClick={onSend} type="button">
                  <SendSolid className="size-4" />
                  Send
                </button>
              </div>
            </div>
          </footer>
        </section>

        <aside className={PANEL_CLASS}>
          <div className="flex items-center gap-3">
            <Settings className="size-5 text-[var(--accent-2)]" />
            <h2 className="m-0 text-lg font-semibold text-[var(--text-main)]">Context & Artifacts</h2>
          </div>
          {activeSession ? (
            <>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                <SelectField label="Model" options={getModelOptions(configuredModelProviders.length === 1 ? configuredModelProviders[0] : undefined)} value={activeSession.selectedModel} onChange={(selectedModel) => onSaveSessionConfig({ sessionId: activeSession.id, selectedModel, selectedReasoning: activeSession.selectedReasoning, autonomyMode: activeSession.autonomyMode, contextItems: activeSession.contextItems })} />
                <SelectField label="Reasoning" options={getReasoningOptions(activeSession.selectedModel)} value={activeSession.selectedReasoning} onChange={(selectedReasoning) => onSaveSessionConfig({ sessionId: activeSession.id, selectedModel: activeSession.selectedModel, selectedReasoning, autonomyMode: activeSession.autonomyMode, contextItems: activeSession.contextItems })} />
                <SelectField label="Autonomy" options={AUTONOMY_OPTIONS.map((value) => ({ value, label: value.replace("_", " ") }))} value={activeSession.autonomyMode} onChange={(autonomyMode) => onSaveSessionConfig({ sessionId: activeSession.id, selectedModel: activeSession.selectedModel, selectedReasoning: activeSession.selectedReasoning, autonomyMode, contextItems: activeSession.contextItems })} />
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Attached Context</div>
                <div className="flex flex-wrap gap-2">
                  {activeSession.contextItems.map((item) => (
                    <button className={CONTEXT_CHIP_CLASS} key={item.id} onClick={() => onRemoveContextItem(item.id)} type="button">
                      {item.label}
                      <span className="text-[var(--text-muted)]">x</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3">
                <input className={INPUT_CLASS} onChange={(event) => setContextSearch(event.target.value)} placeholder="Attach workspace files" value={contextSearch} />
                <div className="max-h-48 overflow-auto rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)]/80 p-2">
                  {attachableFiles.slice(0, 18).map((entry) => (
                    <button className={LIST_ITEM_CLASS} key={entry.path} onClick={() => onAttachFile(entry.path)} type="button">
                      <Attachment className="size-4" />
                      {entry.path}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">Current Diff</div>
                <DiffPreview diff={activeSession.runtime.pendingDiff ?? "No diff captured yet."} />
              </div>

              <div className="grid min-h-0 flex-1 gap-2 overflow-auto rounded-[1rem] border border-[var(--border-soft)] bg-black/20 p-3 font-[var(--font-mono)] text-xs leading-6 text-[var(--text-main)]">
                {activeSession.runtime.terminalOutput.length === 0 ? (
                  <div className="text-[var(--text-subtle)]">Terminal output will appear here for the active topic.</div>
                ) : (
                  activeSession.runtime.terminalOutput.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
                )}
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function SelectField<Value extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: Array<{ value: Value; label: string }>;
  value: Value;
  onChange: (value: Value) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-subtle)]">{label}</span>
      <select className={INPUT_CLASS} onChange={(event) => onChange(event.target.value as Value)} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const PANEL_CLASS = "flex min-h-0 flex-col gap-4 overflow-hidden rounded-[1.5rem] border border-[var(--border-strong)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow)] backdrop-blur-[30px]";
const INPUT_CLASS = "w-full rounded-[1rem] border border-[var(--border-soft)] bg-black/15 px-4 py-3 text-[15px] text-[var(--text-main)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]";
const PRIMARY_BUTTON_CLASS = "inline-flex items-center justify-center gap-2 rounded-[1rem] border-0 bg-[linear-gradient(135deg,var(--accent),#ff79c6)] px-4 py-3 font-semibold text-[#15131c] transition hover:-translate-y-0.5 hover:opacity-95";
const SECONDARY_BUTTON_CLASS = "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-white/5 px-4 py-3 font-medium text-[var(--text-main)] transition hover:-translate-y-0.5 hover:bg-white/8";
const DANGER_BUTTON_CLASS = "inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[rgba(255,85,85,0.32)] bg-[rgba(255,85,85,0.16)] px-4 py-3 font-medium text-[var(--danger)] transition hover:-translate-y-0.5";
const TOPIC_CARD_CLASS = "w-full rounded-[1rem] border border-[var(--border-soft)] bg-[var(--bg-surface)]/70 px-4 py-4 transition hover:-translate-y-0.5 hover:bg-[var(--bg-surface)]/90";
const CONTEXT_CHIP_CLASS = "inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-white/6 px-3 py-2 text-xs font-medium text-[var(--text-main)]";
const LIST_ITEM_CLASS = "flex w-full items-center gap-2 rounded-[0.9rem] px-3 py-2 text-left text-sm text-[var(--text-main)] transition hover:bg-white/8";
