import type { Metadata } from "next";
import { ResearchInterface } from "@/components/research/research-interface";
import { ActiveWorkspaceBadge } from "@/components/shared/active-workspace-badge";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { AgentStatusBadge } from "@/components/shared/agent-status-badge";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.research.page.title,
};

export default function ResearchAgentPage() {
  return (
    <CommandSurface>
      <PageHeader
        title={dict.research.page.title}
        description={dict.research.page.description}
      >
        <ActiveWorkspaceBadge />
        <AgentStatusBadge status="active" showPulse />
      </PageHeader>

      <ResearchInterface />
    </CommandSurface>
  );
}
