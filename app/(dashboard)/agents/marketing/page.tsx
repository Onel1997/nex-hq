import type { Metadata } from "next";
import { MarketingInterface } from "@/components/marketing/marketing-interface";
import { ActiveWorkspaceBadge } from "@/components/shared/active-workspace-badge";
import { AgentStatusBadge } from "@/components/shared/agent-status-badge";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.marketing.page.title,
};

export default function MarketingAgentPage() {
  return (
    <CommandSurface>
      <PageHeader
        title={dict.marketing.page.title}
        description={dict.marketing.page.description}
      >
        <ActiveWorkspaceBadge />
        <AgentStatusBadge status="active" showPulse />
      </PageHeader>

      <MarketingInterface />
    </CommandSurface>
  );
}
