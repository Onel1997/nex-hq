import type { Metadata } from "next";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsPanels } from "@/components/settings/settings-panels";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <CommandSurface>
      <PageHeader
        title="Settings"
        description="Configure your headquarters — system, AI models, and integrations."
      />

      <SettingsPanels />
    </CommandSurface>
  );
}
