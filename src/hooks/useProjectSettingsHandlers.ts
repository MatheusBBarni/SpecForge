import { useCallback } from "react";

import { normalizeProjectRelativePath, parseSupportingDocumentPaths } from "../lib/projectConfig";
import type { ProjectStoreSlice } from "./useAppStoreSlices";

interface SaveCurrentProjectSettingsOptions {
  reloadProject?: boolean;
  navigateToChat?: boolean;
}

type SaveCurrentProjectSettings = (
  options?: SaveCurrentProjectSettingsOptions
) => Promise<void>;

interface UseProjectSettingsHandlersOptions {
  saveCurrentProjectSettings: SaveCurrentProjectSettings;
  scheduleProjectSettingsSave: (reloadProject?: boolean) => void;
  setConfiguredPrdPath: ProjectStoreSlice["setConfiguredPrdPath"];
  setConfiguredSpecPath: ProjectStoreSlice["setConfiguredSpecPath"];
  setPrdPromptTemplate: ProjectStoreSlice["setPrdPromptTemplate"];
  setReasoningProfile: ProjectStoreSlice["setReasoningProfile"];
  setSelectedModel: ProjectStoreSlice["setSelectedModel"];
  setSpecPromptTemplate: ProjectStoreSlice["setSpecPromptTemplate"];
  setSupportingDocumentPaths: ProjectStoreSlice["setSupportingDocumentPaths"];
}

export function useProjectSettingsHandlers({
  saveCurrentProjectSettings,
  scheduleProjectSettingsSave,
  setConfiguredPrdPath,
  setConfiguredSpecPath,
  setPrdPromptTemplate,
  setReasoningProfile,
  setSelectedModel,
  setSpecPromptTemplate,
  setSupportingDocumentPaths
}: UseProjectSettingsHandlersOptions) {
  const handleProjectModelChange = useCallback(
    (model: Parameters<ProjectStoreSlice["setSelectedModel"]>[0]) => {
      setSelectedModel(model);
      scheduleProjectSettingsSave(false);
    },
    [scheduleProjectSettingsSave, setSelectedModel]
  );

  const handleProjectReasoningChange = useCallback(
    (reasoning: Parameters<ProjectStoreSlice["setReasoningProfile"]>[0]) => {
      setReasoningProfile(reasoning);
      scheduleProjectSettingsSave(false);
    },
    [scheduleProjectSettingsSave, setReasoningProfile]
  );

  const handlePrdPromptTemplateChange = useCallback(
    (value: string) => {
      setPrdPromptTemplate(value);
      scheduleProjectSettingsSave(false);
    },
    [scheduleProjectSettingsSave, setPrdPromptTemplate]
  );

  const handleSpecPromptTemplateChange = useCallback(
    (value: string) => {
      setSpecPromptTemplate(value);
      scheduleProjectSettingsSave(false);
    },
    [scheduleProjectSettingsSave, setSpecPromptTemplate]
  );

  const handleConfiguredPrdPathChange = useCallback(
    (value: string) => {
      setConfiguredPrdPath(normalizeProjectRelativePath(value));
      scheduleProjectSettingsSave(true);
    },
    [scheduleProjectSettingsSave, setConfiguredPrdPath]
  );

  const handleConfiguredSpecPathChange = useCallback(
    (value: string) => {
      setConfiguredSpecPath(normalizeProjectRelativePath(value));
      scheduleProjectSettingsSave(true);
    },
    [scheduleProjectSettingsSave, setConfiguredSpecPath]
  );

  const handleSupportingDocumentsChange = useCallback(
    (value: string) => {
      setSupportingDocumentPaths(parseSupportingDocumentPaths(value));
      scheduleProjectSettingsSave(false);
    },
    [scheduleProjectSettingsSave, setSupportingDocumentPaths]
  );

  const handleSaveConfigurationAndContinue = useCallback(() => {
    void saveCurrentProjectSettings({ reloadProject: true, navigateToChat: true });
  }, [saveCurrentProjectSettings]);

  return {
    handleProjectModelChange,
    handleProjectReasoningChange,
    handlePrdPromptTemplateChange,
    handleSpecPromptTemplateChange,
    handleConfiguredPrdPathChange,
    handleConfiguredSpecPathChange,
    handleSupportingDocumentsChange,
    handleSaveConfigurationAndContinue
  };
}

export type ProjectSettingsHandlers = ReturnType<typeof useProjectSettingsHandlers>;
