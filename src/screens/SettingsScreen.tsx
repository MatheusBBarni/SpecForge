import { Button } from "@heroui/react";
import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { SECONDARY_BUTTON_CLASS } from "../components/SettingsPrimitives";
import { SettingsView } from "../components/SettingsView";
import { StatusPill } from "../components/StatusPill";
import { buildConfigPathDisplay } from "../lib/appState";
import { formatSupportingDocumentPaths } from "../lib/projectConfig";
import { useAgentStore } from "../store/useAgentStore";
import { useProjectStore } from "../store/useProjectStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useWorkspaceUiStore } from "../store/useWorkspaceUiStore";
import type { ModelId, ReasoningProfileId, ThemeMode } from "../types";

interface SettingsScreenProps {
  onRefresh: () => void;
  onThemeChange: (theme: ThemeMode) => void;
  onCursorApiKeyInputChange: (value: string) => void;
  onSaveCursorApiKey: () => void;
  onDeleteCursorApiKey: () => void;
  onModelChange: (model: ModelId) => void;
  onReasoningChange: (reasoning: ReasoningProfileId) => void;
  onPrdPromptChange: (value: string) => void;
  onSpecPromptChange: (value: string) => void;
  onExecutionAgentDescriptionChange: (value: string) => void;
  onPrdPathChange: (value: string) => void;
  onSpecPathChange: (value: string) => void;
  onSupportingDocumentsChange: (value: string) => void;
}

export const SettingsScreen = memo(function SettingsScreen({
  onRefresh,
  onThemeChange,
  onCursorApiKeyInputChange,
  onSaveCursorApiKey,
  onDeleteCursorApiKey,
  onModelChange,
  onReasoningChange,
  onPrdPromptChange,
  onSpecPromptChange,
  onExecutionAgentDescriptionChange,
  onPrdPathChange,
  onSpecPathChange,
  onSupportingDocumentsChange
}: SettingsScreenProps) {
  const agentStatus = useAgentStore((state) => state.status);
  const {
    annotations,
    executionAgentDescription,
    prdPath,
    prdPrompt,
    selectedModel,
    selectedReasoning,
    specPath,
    specPrompt,
    supportingDocumentsValue
  } = useProjectStore(
    useShallow((state) => ({
      annotations: state.annotations,
      executionAgentDescription: state.executionAgentDescription,
      prdPath: state.configuredPrdPath,
      prdPrompt: state.prdPromptTemplate,
      selectedModel: state.selectedModel,
      selectedReasoning: state.selectedReasoning,
      specPath: state.configuredSpecPath,
      specPrompt: state.specPromptTemplate,
      supportingDocumentsValue: formatSupportingDocumentPaths(state.supportingDocumentPaths)
    }))
  );
  const {
    cursorApiKeyInput,
    environment,
    theme
  } = useSettingsStore(
    useShallow((state) => ({
      cursorApiKeyInput: state.cursorApiKeyInput,
      environment: state.environment,
      theme: state.theme
    }))
  );
  const {
    configPath,
    cursorModels,
    projectErrorMessage,
    projectStatusMessage,
    workspaceRootName
  } = useWorkspaceUiStore(
    useShallow((state) => ({
      configPath: buildConfigPathDisplay(state.projectConfigPath, state.projectRootName),
      cursorModels: state.cursorModels,
      projectErrorMessage: state.projectErrorMessage,
      projectStatusMessage: state.projectStatusMessage,
      workspaceRootName: state.projectRootName
    }))
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-end gap-4 bg-[linear-gradient(180deg,var(--bg-panel-strong),transparent)] px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={agentStatus} />
          <Button className={SECONDARY_BUTTON_CLASS} onPress={onRefresh}>
            Refresh
          </Button>
        </div>
      </header>

      <div className="px-5 pb-5">
        <SettingsView
          annotations={annotations}
          configPath={configPath}
          cursorApiKeyInput={cursorApiKeyInput}
          cursorModels={cursorModels}
          environment={environment}
          executionAgentDescription={executionAgentDescription}
          onCursorApiKeyInputChange={onCursorApiKeyInputChange}
          onDeleteCursorApiKey={onDeleteCursorApiKey}
          onExecutionAgentDescriptionChange={onExecutionAgentDescriptionChange}
          onModelChange={onModelChange}
          onPrdPathChange={onPrdPathChange}
          onPrdPromptChange={onPrdPromptChange}
          onReasoningChange={onReasoningChange}
          onSaveCursorApiKey={onSaveCursorApiKey}
          onSpecPathChange={onSpecPathChange}
          onSpecPromptChange={onSpecPromptChange}
          onSupportingDocumentsChange={onSupportingDocumentsChange}
          onThemeChange={onThemeChange}
          prdPath={prdPath}
          prdPrompt={prdPrompt}
          projectErrorMessage={projectErrorMessage}
          projectStatusMessage={projectStatusMessage}
          selectedModel={selectedModel}
          selectedReasoning={selectedReasoning}
          specPath={specPath}
          specPrompt={specPrompt}
          supportingDocumentsValue={supportingDocumentsValue}
          theme={theme}
          workspaceRootName={workspaceRootName}
        />
      </div>
    </section>
  );
});
