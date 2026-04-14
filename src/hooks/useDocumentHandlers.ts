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
  generatePrdDocument,
  generateSpecDocument,
  pickDocument
} from "../lib/runtime";
import {
  type ImportableFile, 
  parseWorkspaceDocument
} from "../lib/workspaceImport";
import type { AgentStoreSlice, ProjectStoreSlice, SettingsStoreSlice } from "./useAppStoreSlices";
import type { AppDerivedState } from "./useAppView";

interface UseDocumentHandlersOptions {
  agentState: AgentStoreSlice;
  derivedState: AppDerivedState;
  desktopRuntime: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  pendingImportTargetRef: React.MutableRefObject<DocumentTarget>;
  prdGenerationPrompt: string;
  projectRootPath: string;
  projectState: ProjectStoreSlice;
  setIsImporting: (value: boolean) => void;
  setPrdGenerationError: (value: string) => void;
  setPrdGenerationPrompt: (value: string) => void;
  setSpecGenerationError: (value: string) => void;
  setSpecGenerationPrompt: (value: string) => void;
  settingsState: SettingsStoreSlice;
  specGenerationPrompt: string;
}

export function useDocumentHandlers({
  agentState,
  derivedState,
  desktopRuntime,
  fileInputRef,
  pendingImportTargetRef,
  prdGenerationPrompt,
  projectRootPath,
  projectState,
  setIsImporting,
  setPrdGenerationError,
  setPrdGenerationPrompt,
  setSpecGenerationError,
  setSpecGenerationPrompt,
  settingsState,
  specGenerationPrompt
}: UseDocumentHandlersOptions) {
  const assignDocument = useCallback(
    (target: DocumentTarget, content: string, path: string) => {
      startTransition(() => {
        if (target === "prd") {
          projectState.setPrdContent(content, path);
          projectState.setPrdPaneMode("preview");
          return;
        }

        projectState.setSpecContent(content, path);
        projectState.setSpecPaneMode("preview");
      });

      if (target === "prd") {
        setPrdGenerationPrompt("");
        setPrdGenerationError("");
        return;
      }

      setSpecGenerationPrompt("");
      setSpecGenerationError("");
    },
    [projectState, setPrdGenerationError, setPrdGenerationPrompt, setSpecGenerationError, setSpecGenerationPrompt]
  );

  const handleOpenImportFile = useCallback(
    async (target: DocumentTarget) => {
      pendingImportTargetRef.current = target;

      if (desktopRuntime) {
        setIsImporting(true);

        try {
          const document = await pickDocument();

          if (document) {
            assignDocument(target, document.content, document.sourcePath);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "The selected file could not be imported.";

          if (target === "prd") {
            setPrdGenerationError(message);
          } else {
            setSpecGenerationError(message);
          }
        } finally {
          setIsImporting(false);
        }

        return;
      }

      fileInputRef.current?.click();
    },
    [assignDocument, desktopRuntime, fileInputRef, pendingImportTargetRef, setIsImporting, setPrdGenerationError, setSpecGenerationError]
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
        const message =
          error instanceof Error ? error.message : "The selected file could not be imported.";

        if (pendingImportTargetRef.current === "prd") {
          setPrdGenerationError(message);
        } else {
          setSpecGenerationError(message);
        }
      } finally {
        event.target.value = "";
      }
    },
    [assignDocument, pendingImportTargetRef, setPrdGenerationError, setSpecGenerationError]
  );

  const handleGeneratePrd = useCallback(async () => {
    const trimmedPrompt = prdGenerationPrompt.trim();

    if (!desktopRuntime) {
      setPrdGenerationError("AI PRD generation requires the desktop runtime.");
      return;
    }

    if (!projectRootPath.trim()) {
      setPrdGenerationError("Choose a project folder before generating a PRD.");
      return;
    }

    if (!derivedState.currentProjectSettings.prdPath.toLowerCase().endsWith(".md")) {
      setPrdGenerationError("Configure the PRD path as a Markdown file before generating.");
      return;
    }

    if (!trimmedPrompt) {
      setPrdGenerationError("Add the product context you want the AI to consider.");
      return;
    }

    setPrdGenerationError("");
    agentState.setStatus("generating_prd");
    agentState.appendTerminalOutput(
      stampLog(
        "prd",
        `Generating a PRD draft with ${getModelLabel(projectState.selectedModel)} (${getReasoningLabel(projectState.selectedModel, projectState.selectedReasoning)} reasoning).`
      )
    );

    try {
      await waitForNextPaint();

      const generatedPrd = await generatePrdDocument({
        workspaceRoot: projectRootPath,
        outputPath: derivedState.currentProjectSettings.prdPath,
        promptTemplate: derivedState.currentProjectSettings.prdPrompt,
        userPrompt: trimmedPrompt,
        provider: derivedState.selectedModelProvider,
        model: projectState.selectedModel,
        reasoning: projectState.selectedReasoning,
        claudePath: settingsState.claudePath,
        codexPath: settingsState.codexPath
      });

      startTransition(() => {
        projectState.setPrdContent(generatedPrd.content, generatedPrd.sourcePath);
        projectState.setPrdPaneMode("preview");
      });
      setPrdGenerationPrompt("");
      agentState.setStatus("idle");
      agentState.appendTerminalOutput(
        stampLog(
          "prd",
          `PRD draft generated, saved to ${generatedPrd.fileName}, and loaded into the review pane.`
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate a PRD.";
      setPrdGenerationError(message);
      agentState.setStatus("error");
      agentState.appendTerminalOutput(stampLog("error", message));
    }
  }, [
    agentState,
    derivedState.currentProjectSettings,
    derivedState.selectedModelProvider,
    desktopRuntime,
    prdGenerationPrompt,
    projectRootPath,
    projectState,
    setPrdGenerationError,
    setPrdGenerationPrompt,
    settingsState
  ]);

  const handleGenerateSpec = useCallback(async () => {
    const trimmedPrompt = specGenerationPrompt.trim();

    if (!desktopRuntime) {
      setSpecGenerationError("AI spec generation requires the desktop runtime.");
      return;
    }

    if (!projectRootPath.trim()) {
      setSpecGenerationError("Choose a project folder before generating a spec.");
      return;
    }

    if (!projectState.prdContent.trim()) {
      setSpecGenerationError("Load or generate a PRD before drafting a specification.");
      return;
    }

    if (!derivedState.currentProjectSettings.specPath.toLowerCase().endsWith(".md")) {
      setSpecGenerationError("Configure the spec path as a Markdown file before generating.");
      return;
    }

    if (!trimmedPrompt) {
      setSpecGenerationError("Add the technical guidance you want the AI to consider.");
      return;
    }

    setSpecGenerationError("");
    agentState.setStatus("generating_spec");
    agentState.appendTerminalOutput(
      stampLog(
        "spec",
        `Generating a technical specification with ${getModelLabel(projectState.selectedModel)} (${getReasoningLabel(projectState.selectedModel, projectState.selectedReasoning)} reasoning).`
      )
    );

    try {
      await waitForNextPaint();

      const generatedSpec = await generateSpecDocument({
        workspaceRoot: projectRootPath,
        outputPath: derivedState.currentProjectSettings.specPath,
        prdContent: projectState.prdContent,
        promptTemplate: derivedState.currentProjectSettings.specPrompt,
        userPrompt: trimmedPrompt,
        provider: derivedState.selectedModelProvider,
        model: projectState.selectedModel,
        reasoning: projectState.selectedReasoning,
        claudePath: settingsState.claudePath,
        codexPath: settingsState.codexPath
      });

      startTransition(() => {
        projectState.setSpecContent(generatedSpec.content, generatedSpec.sourcePath);
        projectState.setSpecPaneMode("preview");
      });
      setSpecGenerationPrompt("");
      agentState.setStatus("idle");
      agentState.appendTerminalOutput(
        stampLog(
          "spec",
          `Specification draft generated, saved to ${generatedSpec.fileName}, and loaded into the review pane.`
        )
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate a specification.";
      setSpecGenerationError(message);
      agentState.setStatus("error");
      agentState.appendTerminalOutput(stampLog("error", message));
    }
  }, [
    agentState,
    derivedState.currentProjectSettings,
    derivedState.selectedModelProvider,
    desktopRuntime,
    projectRootPath,
    projectState,
    setSpecGenerationError,
    setSpecGenerationPrompt,
    settingsState,
    specGenerationPrompt
  ]);

  return {
    assignDocument,
    handleOpenImportFile,
    handleFileSelection,
    handleGeneratePrd,
    handleGenerateSpec
  };
}
