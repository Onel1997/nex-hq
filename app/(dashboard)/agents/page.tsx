import type { Metadata } from "next";
import { AgentOverview } from "@/components/agents/agent-overview";
import { AgentRoster } from "@/components/agents/agent-card";
import { AgentStatusBadge } from "@/components/shared/agent-status-badge";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.navigation.agents,
};

export default function AgentsPage() {
  return (
    <CommandSurface>
      <PageHeader
        title={dict.agents.page.title}
        description={dict.agents.page.description}
      >
        <AgentStatusBadge status="active" showPulse />
        <AgentStatusBadge status="planned" />
      </PageHeader>

      <AgentOverview />
      <AgentRoster />
    </CommandSurface>
  );
}
