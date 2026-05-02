import {
  type ChangeEvent,
  type RefObject, 
  startTransition,
  useCallback
} from "react";
import { getModelLabel, getReasoningLabel } from "../lib/agentConfig";
import { type DocumentTarget, stampLog } from "../lib/appShell";
import { waitForNextPaint } from "../lib/appState";
import {
  buildCursorPrdGrillPrompt,
  buildCursorPrdPrompt,
  buildCursorSpecGrillPrompt,
  buildCursorSpecPrompt,
  runCursorAgentPrompt
} from "../lib/cursorAgentRuntime";
import {
  deleteDocumentPreview,
  generatePrdDocument,
  generateSpecDocument,
  loadProjectContext,
  pickDocument,
  saveDocumentPreview
} from "../lib/runtime";
import {
  type ImportableFile, 
  parseWorkspaceDocument
} from "../lib/workspaceImport";
import type { CliHealth, ProjectSettings } from "../types";
import type {
  AgentStoreSlice,
  ProjectStoreSlice,
  SettingsStoreSlice,
  WorkspaceUiStoreSlice
} from "./useAppStoreSlices";
import type { AppDerivedState } from "./useAppView";

interface UseDocumentHandlersOptions {
  agentState: AgentStoreSlice;
  derivedState: AppDerivedState;
  desktopRuntime: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  pendingImportTargetRef: React.MutableRefObject<DocumentTarget>;
  projectState: ProjectStoreSlice;
  settingsState: SettingsStoreSlice;
  workspaceUiState: WorkspaceUiStoreSlice;
}

export function useDocumentHandlers({
  agentState,
  derivedState,
  desktopRuntime,
  fileInputRef,
  pendingImportTargetRef,
  projectState,
  settingsState,
  workspaceUiState
}: UseDocumentHandlersOptions) {
  const assignDocument = useCallback(
    (target: DocumentTarget, content: string, path: string) => {
      startTransition(() => {
      if (target === "prd") {
        projectState.setPrdContent(content, path);
        projectState.setPrdPaneMode("preview");
        projectState.setPrdPreviewState(false);
        return;
      }

      projectState.setSpecContent(content, path);
      projectState.setSpecPaneMode("preview");
      projectState.setSpecPreviewState(false);
      });

      if (target === "prd") {
        workspaceUiState.setPrdGenerationPrompt("");
        workspaceUiState.setPrdGenerationError("");
        return;
      }

      workspaceUiState.setSpecGenerationPrompt("");
      workspaceUiState.setSpecGenerationError("");
    },
    [projectState, workspaceUiState]
  );

  const handleOpenImportFile = useCallback(
    async (target: DocumentTarget) => {
      pendingImportTargetRef.current = target;

      if (!desktopRuntime) {
        fileInputRef.current?.click();
        return;
      }

      workspaceUiState.setIsImporting(true);

      try {
        const document = await pickDocument();

        if (document) {
          assignDocument(target, document.content, document.sourcePath);
        }
      } catch (error) {
        reportImportError(target, error, workspaceUiState);
      } finally {
        workspaceUiState.setIsImporting(false);
      }
    },
    [assignDocument, desktopRuntime, fileInputRef, pendingImportTargetRef, workspaceUiState]
  );

  const handleFileSelection = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] as ImportableFile | undefined;

      if (!file) {
        return;
      }

      try {
        const document = await parseWorkspaceDocument(file);
        assignDocument(pendingImportTargetRef.current, document.content, document.sourcePath);
      } catch (error) {
        reportImportError(pendingImportTargetRef.current, error, workspaceUiState);
      } finally {
        event.target.value = "";
      }
    },
    [assignDocument, pendingImportTargetRef, workspaceUiState]
  );

  const handleGeneratePrd = useCallback(async () => {
    const trimmedPrompt = workspaceUiState.prdGenerationPrompt.trim();
    const validationError = getPrdGenerationValidationError({
      currentProjectSettings: derivedState.currentProjectSettings,
      desktopRuntime,
      environmentCodexStatus: settingsState.environment.codex.status,
      environmentCursorStatus: settingsState.environment.cursor.status,
      environmentDockerStatus: settingsState.environment.docker.status,
      projectRootPath: workspaceUiState.projectRootPath,
      trimmedPrompt
    });

    if (validationError) {
      workspaceUiState.setPrdGenerationError(validationError);
      return;
    }

    workspaceUiState.setPrdGenerationError("");
    agentState.setStatus("generating_prd");
    agentState.appendTerminalOutput(
      stampLog(
        "prd",
        `Generating a PRD draft with ${getModelLabel(projectState.selectedModel)} (${getReasoningLabel(projectState.selectedModel, projectState.selectedReasoning)} reasoning).`
      )
    );

    try {
      await waitForNextPaint();
      const generatedContent = await runCursorAgentPrompt({
        workspaceRoot: workspaceUiState.projectRootPath,
        model: projectState.selectedModel,
        reasoning: projectState.selectedReasoning,
        prompt: buildCursorPrdPrompt({
          agentDescription: derivedState.currentProjectSettings.prdAgentDescription,
          userPrompt: trimmedPrompt
        }),
        onEvent: (line) => agentState.appendTerminalOutput(stampLog("sandcastle", line))
      });

      const generatedPrd = await saveDocumentPreview({
        workspaceRoot: workspaceUiState.projectRootPath,
        target: "prd",
        content: generatedContent
      });

      startTransition(() => {
        projectState.setPrdContent(generatedPrd.content, generatedPrd.sourcePath);
        projectState.setPrdPaneMode("preview");
        projectState.setPrdPreviewState(true);
      });
      workspaceUiState.setPrdGenerationPrompt("");
      agentState.setStatus("idle");
      agentState.appendTerminalOutput(
        stampLog(
          "prd",
          `PRD preview generated, saved to ${generatedPrd.fileName}, and loaded into the review pane.`
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate a PRD.";
      workspaceUiState.setPrdGenerationError(message);
      agentState.setStatus("error");
      agentState.appendTerminalOutput(stampLog("error", message));
    }
  }, [
    agentState,
    derivedState.currentProjectSettings,
    desktopRuntime,
    projectState,
    settingsState,
    workspaceUiState
  ]);

  const handleGrillPrd = useCallback(async () => {
    const trimmedPrompt = workspaceUiState.prdGenerationPrompt.trim();
    const validationError = getPrdGenerationValidationError({
      currentProjectSettings: derivedState.currentProjectSettings,
      desktopRuntime,
      environmentCodexStatus: settingsState.environment.codex.status,
      environmentCursorStatus: settingsState.environment.cursor.status,
      environmentDockerStatus: settingsState.environment.docker.status,
      projectRootPath: workspaceUiState.projectRootPath,
      trimmedPrompt
    });

    if (validationError) {
      workspaceUiState.setPrdGenerationError(validationError);
      return;
    }

    workspaceUiState.setPrdGenerationError("");
    agentState.setStatus("generating_prd");
    agentState.appendTerminalOutput(stampLog("prd", "Running grill-me against the PRD brief."));

    try {
      await waitForNextPaint();
      const grillResponse = await runCursorAgentPrompt({
        workspaceRoot: workspaceUiState.projectRootPath,
        model: projectState.selectedModel,
        reasoning: projectState.selectedReasoning,
        prompt: buildCursorPrdGrillPrompt({
          agentDescription: derivedState.currentProjectSettings.prdAgentDescription,
          userPrompt: trimmedPrompt
        }),
        onEvent: (line) => agentState.appendTerminalOutput(stampLog("sandcastle", line))
      });

      workspaceUiState.setPrdGenerationPrompt(appendGrillResponse(trimmedPrompt, grillResponse));
      agentState.setStatus("idle");
      agentState.appendTerminalOutput(stampLog("prd", "Grill-me question added to the PRD prompt."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to grill the PRD brief.";
      workspaceUiState.setPrdGenerationError(message);
      agentState.setStatus("error");
      agentState.appendTerminalOutput(stampLog("error", message));
    }
  }, [
    agentState,
    derivedState.currentProjectSettings,
    desktopRuntime,
    projectState,
    settingsState,
    workspaceUiState
  ]);

  const handleGenerateSpec = useCallback(async () => {
    const trimmedPrompt = workspaceUiState.specGenerationPrompt.trim();
    const validationError = getSpecGenerationValidationError({
      currentProjectSettings: derivedState.currentProjectSettings,
      desktopRuntime,
      environmentCodexStatus: settingsState.environment.codex.status,
      environmentCursorStatus: settingsState.environment.cursor.status,
      environmentDockerStatus: settingsState.environment.docker.status,
      prdContent: projectState.prdContent,
      projectRootPath: workspaceUiState.projectRootPath,
      trimmedPrompt
    });

    if (validationError) {
      workspaceUiState.setSpecGenerationError(validationError);
      return;
    }

    workspaceUiState.setSpecGenerationError("");
    agentState.setStatus("generating_spec");
    agentState.appendTerminalOutput(
      stampLog(
        "spec",
        `Generating a technical specification with ${getModelLabel(projectState.selectedModel)} (${getReasoningLabel(projectState.selectedModel, projectState.selectedReasoning)} reasoning).`
      )
    );

    try {
      await waitForNextPaint();
      const generatedContent = await runCursorAgentPrompt({
        workspaceRoot: workspaceUiState.projectRootPath,
        model: projectState.selectedModel,
        reasoning: projectState.selectedReasoning,
        prompt: buildCursorSpecPrompt({
          agentDescription: derivedState.currentProjectSettings.specAgentDescription,
          userPrompt: trimmedPrompt,
          prdContent: projectState.prdContent
        }),
        onEvent: (line) => agentState.appendTerminalOutput(stampLog("sandcastle", line))
      });

      const generatedSpec = await saveDocumentPreview({
        workspaceRoot: workspaceUiState.projectRootPath,
        target: "spec",
        content: generatedContent
      });

      startTransition(() => {
        projectState.setSpecContent(generatedSpec.content, generatedSpec.sourcePath);
        projectState.setSpecPaneMode("preview");
        projectState.setSpecPreviewState(true);
      });
      workspaceUiState.setSpecGenerationPrompt("");
      agentState.setStatus("idle");
      agentState.appendTerminalOutput(
        stampLog(
          "spec",
          `Specification preview generated, saved to ${generatedSpec.fileName}, and loaded into the review pane.`
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate a specification.";
      workspaceUiState.setSpecGenerationError(message);
      agentState.setStatus("error");
      agentState.appendTerminalOutput(stampLog("error", message));
    }
  }, [
    agentState,
    derivedState.currentProjectSettings,
    desktopRuntime,
    projectState,
    settingsState,
    workspaceUiState
  ]);

  const handleGrillSpec = useCallback(async () => {
    const trimmedPrompt = workspaceUiState.specGenerationPrompt.trim();
    const validationError = getSpecGenerationValidationError({
      currentProjectSettings: derivedState.currentProjectSettings,
      desktopRuntime,
      environmentCodexStatus: settingsState.environment.codex.status,
      environmentCursorStatus: settingsState.environment.cursor.status,
      environmentDockerStatus: settingsState.environment.docker.status,
      prdContent: projectState.prdContent,
      projectRootPath: workspaceUiState.projectRootPath,
      requirePrompt: false,
      trimmedPrompt
    });

    if (validationError) {
      workspaceUiState.setSpecGenerationError(validationError);
      return;
    }

    workspaceUiState.setSpecGenerationError("");
    agentState.setStatus("generating_spec");
    agentState.appendTerminalOutput(stampLog("spec", "Running grill-me against the spec brief."));

    try {
      await waitForNextPaint();
      const grillResponse = await runCursorAgentPrompt({
        workspaceRoot: workspaceUiState.projectRootPath,
        model: projectState.selectedModel,
        reasoning: projectState.selectedReasoning,
        prompt: buildCursorSpecGrillPrompt({
          agentDescription: derivedState.currentProjectSettings.specAgentDescription,
          userPrompt: trimmedPrompt,
          prdContent: projectState.prdContent
        }),
        onEvent: (line) => agentState.appendTerminalOutput(stampLog("sandcastle", line))
      });

      workspaceUiState.setSpecGenerationPrompt(appendGrillResponse(trimmedPrompt, grillResponse));
      agentState.setStatus("idle");
      agentState.appendTerminalOutput(stampLog("spec", "Grill-me question added to the spec prompt."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to grill the spec brief.";
      workspaceUiState.setSpecGenerationError(message);
      agentState.setStatus("error");
      agentState.appendTerminalOutput(stampLog("error", message));
    }
  }, [
    agentState,
    derivedState.currentProjectSettings,
    desktopRuntime,
    projectState,
    settingsState,
    workspaceUiState
  ]);

  const handleSavePrdPreview = useCallback(async () => {
    await savePreviewDocument({
      target: "prd",
      content: projectState.prdContent,
      outputPath: derivedState.currentProjectSettings.prdPath,
      projectRootPath: workspaceUiState.projectRootPath,
      setContent: projectState.setPrdContent,
      setPreviewState: projectState.setPrdPreviewState,
      setPaneMode: projectState.setPrdPaneMode,
      appendTerminalOutput: agentState.appendTerminalOutput
    });
  }, [agentState, derivedState.currentProjectSettings.prdPath, projectState, workspaceUiState.projectRootPath]);

  const handleDiscardPrdPreview = useCallback(async () => {
    await discardPreviewDocument({
      target: "prd",
      projectRootPath: workspaceUiState.projectRootPath,
      fallbackPath: derivedState.currentProjectSettings.prdPath,
      setContent: projectState.setPrdContent,
      setPreviewState: projectState.setPrdPreviewState,
      setPaneMode: projectState.setPrdPaneMode,
      appendTerminalOutput: agentState.appendTerminalOutput
    });
  }, [agentState, derivedState.currentProjectSettings.prdPath, projectState, workspaceUiState.projectRootPath]);

  const handleSaveSpecPreview = useCallback(async () => {
    await savePreviewDocument({
      target: "spec",
      content: projectState.specContent,
      outputPath: derivedState.currentProjectSettings.specPath,
      projectRootPath: workspaceUiState.projectRootPath,
      setContent: projectState.setSpecContent,
      setPreviewState: projectState.setSpecPreviewState,
      setPaneMode: projectState.setSpecPaneMode,
      appendTerminalOutput: agentState.appendTerminalOutput
    });
  }, [agentState, derivedState.currentProjectSettings.specPath, projectState, workspaceUiState.projectRootPath]);

  const handleDiscardSpecPreview = useCallback(async () => {
    await discardPreviewDocument({
      target: "spec",
      projectRootPath: workspaceUiState.projectRootPath,
      fallbackPath: derivedState.currentProjectSettings.specPath,
      setContent: projectState.setSpecContent,
      setPreviewState: projectState.setSpecPreviewState,
      setPaneMode: projectState.setSpecPaneMode,
      appendTerminalOutput: agentState.appendTerminalOutput
    });
  }, [agentState, derivedState.currentProjectSettings.specPath, projectState, workspaceUiState.projectRootPath]);

  return {
    assignDocument,
    handleOpenImportFile,
    handleFileSelection,
    handleGrillPrd,
    handleGeneratePrd,
    handleGrillSpec,
    handleGenerateSpec,
    handleSavePrdPreview,
    handleDiscardPrdPreview,
    handleSaveSpecPreview,
    handleDiscardSpecPreview
  };
}

function reportImportError(
  target: DocumentTarget,
  error: unknown,
  workspaceUiState: WorkspaceUiStoreSlice
) {
  const message =
    error instanceof Error ? error.message : "The selected file could not be imported.";

  if (target === "prd") {
    workspaceUiState.setPrdGenerationError(message);
    return;
  }

  workspaceUiState.setSpecGenerationError(message);
}

function getPrdGenerationValidationError({
  currentProjectSettings,
  desktopRuntime,
  environmentCodexStatus,
  environmentCursorStatus,
  environmentDockerStatus,
  projectRootPath,
  trimmedPrompt
}: {
  currentProjectSettings: ProjectSettings;
  desktopRuntime: boolean;
  environmentCursorStatus: CliHealth;
  environmentCodexStatus: CliHealth;
  environmentDockerStatus: CliHealth;
  projectRootPath: string;
  trimmedPrompt: string;
}) {
  if (!desktopRuntime) {
    return "Sandcastle access and document saving require the desktop runtime.";
  }

  if (!projectRootPath.trim()) {
    return "Choose a project folder before generating a PRD.";
  }

  if (!currentProjectSettings.prdPath.toLowerCase().endsWith(".md")) {
    return "Configure the PRD path as a Markdown file before generating.";
  }

  if (!trimmedPrompt) {
    return "Add the product context you want the AI to consider.";
  }

  return getRuntimeReadinessError({
    environmentCodexStatus,
    environmentCursorStatus,
    environmentDockerStatus,
    target: "PRD"
  });
}

function getSpecGenerationValidationError({
  currentProjectSettings,
  desktopRuntime,
  environmentCodexStatus,
  environmentCursorStatus,
  environmentDockerStatus,
  prdContent,
  projectRootPath,
  requirePrompt = true,
  trimmedPrompt
}: {
  currentProjectSettings: ProjectSettings;
  desktopRuntime: boolean;
  environmentCursorStatus: CliHealth;
  environmentCodexStatus: CliHealth;
  environmentDockerStatus: CliHealth;
  prdContent: string;
  projectRootPath: string;
  requirePrompt?: boolean;
  trimmedPrompt: string;
}) {
  if (!desktopRuntime) {
    return "Sandcastle access and document saving require the desktop runtime.";
  }

  if (!projectRootPath.trim()) {
    return "Choose a project folder before generating a spec.";
  }

  if (!prdContent.trim()) {
    return "Load or generate a PRD before drafting a specification.";
  }

  if (!currentProjectSettings.specPath.toLowerCase().endsWith(".md")) {
    return "Configure the spec path as a Markdown file before generating.";
  }

  if (requirePrompt && !trimmedPrompt) {
    return "Add the technical guidance you want the AI to consider.";
  }

  return getRuntimeReadinessError({
    environmentCodexStatus,
    environmentCursorStatus,
    environmentDockerStatus,
    target: "spec"
  });
}

function getRuntimeReadinessError({
  environmentCodexStatus,
  environmentCursorStatus,
  environmentDockerStatus,
  target
}: {
  environmentCursorStatus: CliHealth;
  environmentCodexStatus: CliHealth;
  environmentDockerStatus: CliHealth;
  target: "PRD" | "spec";
}) {
  if (environmentCursorStatus !== "found") {
    return `Configure Codex authentication in Settings before generating a ${target}.`;
  }

  if (environmentCodexStatus !== "found") {
    return `Install or repair Codex CLI before generating a ${target}.`;
  }

  if (environmentDockerStatus !== "found") {
    return `Start Docker before generating a ${target}.`;
  }

  return "";
}

function appendGrillResponse(currentPrompt: string, grillResponse: string) {
  const trimmedCurrentPrompt = currentPrompt.trim();
  const trimmedResponse = grillResponse.trim();
  const nextBlock = `Grill-me follow-up:
${trimmedResponse}

My answer:
`;

  return trimmedCurrentPrompt
    ? `${trimmedCurrentPrompt}\n\n${nextBlock}`
    : nextBlock;
}

async function savePreviewDocument({
  target,
  content,
  outputPath,
  projectRootPath,
  setContent,
  setPreviewState,
  setPaneMode,
  appendTerminalOutput
}: {
  target: DocumentTarget;
  content: string;
  outputPath: string;
  projectRootPath: string;
  setContent: (content: string, path?: string) => void;
  setPreviewState: (hasPreview: boolean) => void;
  setPaneMode: (mode: "preview") => void;
  appendTerminalOutput: (line: string) => void;
}) {
  try {
    const savedDocument = target === "prd"
      ? await generatePrdDocument({ workspaceRoot: projectRootPath, outputPath, content })
      : await generateSpecDocument({ workspaceRoot: projectRootPath, outputPath, content });

    await deleteDocumentPreview({ workspaceRoot: projectRootPath, target });
    setContent(savedDocument.content, savedDocument.sourcePath);
    setPreviewState(false);
    setPaneMode("preview");
    appendTerminalOutput(
      stampLog(target, `Saved ${target.toUpperCase()} preview to ${savedDocument.fileName}.`)
    );
  } catch (error) {
    appendTerminalOutput(
      stampLog(
        "error",
        error instanceof Error ? error.message : `Unable to save the ${target.toUpperCase()} preview.`
      )
    );
  }
}

async function discardPreviewDocument({
  target,
  projectRootPath,
  fallbackPath,
  setContent,
  setPreviewState,
  setPaneMode,
  appendTerminalOutput
}: {
  target: DocumentTarget;
  projectRootPath: string;
  fallbackPath: string;
  setContent: (content: string, path?: string) => void;
  setPreviewState: (hasPreview: boolean) => void;
  setPaneMode: (mode: "preview") => void;
  appendTerminalOutput: (line: string) => void;
}) {
  try {
    await deleteDocumentPreview({ workspaceRoot: projectRootPath, target });
    const context = await loadProjectContext(projectRootPath);
    const canonicalDocument = target === "prd" ? context.prdDocument : context.specDocument;

    setContent(canonicalDocument?.content ?? "", canonicalDocument?.sourcePath ?? fallbackPath);
    setPreviewState(false);
    setPaneMode("preview");
    appendTerminalOutput(stampLog(target, `Discarded ${target.toUpperCase()} preview.`));
  } catch (error) {
    appendTerminalOutput(
      stampLog(
        "error",
        error instanceof Error
          ? error.message
          : `Unable to discard the ${target.toUpperCase()} preview.`
      )
    );
  }
}
