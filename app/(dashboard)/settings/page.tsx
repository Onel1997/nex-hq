import type { Metadata } from "next";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsPanels } from "@/components/settings/settings-panels";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.navigation.settings,
};

export default function SettingsPage() {
  return (
    <CommandSurface>
      <PageHeader
        title={dict.settings.page.title}
        description={dict.settings.page.description}
      />

      <SettingsPanels />
    </CommandSurface>
  );
}
