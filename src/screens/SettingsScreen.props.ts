import type { ComponentProps } from "react";

import type { SettingsScreen } from "./SettingsScreen";

type SettingsScreenProps = ComponentProps<typeof SettingsScreen>;
type StoreOwnedProp = "agentStatus" | "settingsViewProps";

type PropDrillingStillPresent = Extract<keyof SettingsScreenProps, StoreOwnedProp>;

const settingsScreenDoesNotAcceptStoreOwnedProps: PropDrillingStillPresent extends never
  ? true
  : never = true;

void settingsScreenDoesNotAcceptStoreOwnedProps;
