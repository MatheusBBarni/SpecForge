import type { ComponentProps } from "react";

import type { ConfigurationScreen } from "./ConfigurationScreen";

type ConfigurationScreenProps = ComponentProps<typeof ConfigurationScreen>;
type StoreOwnedProp =
  | "cursorApiKeyInput"
  | "environment"
  | "cursorModels"
  | "workspaceRootName"
  | "workspaceRootPath"
  | "settingsPath"
  | "hasSavedSettings"
  | "isProjectLoading"
  | "isSaving"
  | "errorMessage"
  | "selectedModel"
  | "selectedReasoning"
  | "prdPrompt"
  | "specPrompt"
  | "executionAgentDescription"
  | "prdPath"
  | "specPath"
  | "supportingDocumentsValue"
  | "recentProjects";

type PropDrillingStillPresent = Extract<keyof ConfigurationScreenProps, StoreOwnedProp>;

const configurationScreenDoesNotAcceptStoreOwnedProps: PropDrillingStillPresent extends never
  ? true
  : never = true;

void configurationScreenDoesNotAcceptStoreOwnedProps;
