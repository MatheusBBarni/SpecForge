import { Button } from "@heroui/react";
import { type ComponentProps, memo } from "react";
import { SECONDARY_BUTTON_CLASS } from "../components/SettingsPrimitives";
import { SettingsView } from "../components/SettingsView";
import { StatusPill } from "../components/StatusPill";
import type { AgentStatus } from "../types";

interface SettingsScreenProps {
  agentStatus: AgentStatus;
  onRefresh: () => void;
  settingsViewProps: ComponentProps<typeof SettingsView>;
}

export const SettingsScreen = memo(function SettingsScreen({
  agentStatus,
  onRefresh,
  settingsViewProps
}: SettingsScreenProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 bg-[linear-gradient(180deg,var(--bg-panel-strong),transparent)] px-5 py-4 backdrop-blur-xl">
        <div>
          <h1 className="m-0 text-xl font-semibold text-[var(--text-main)]">Settings</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={agentStatus} />
          <Button className={SECONDARY_BUTTON_CLASS} onPress={onRefresh}>
            Refresh
          </Button>
        </div>
      </header>

      <div className="px-5 pb-5">
        <SettingsView {...settingsViewProps} />
      </div>
    </section>
  );
});
