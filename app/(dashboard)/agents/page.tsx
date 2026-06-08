import type { Metadata } from "next";
import { AgentOverview } from "@/components/agents/agent-overview";
import { AgentRoster } from "@/components/agents/agent-card";
import { AgentStatusBadge } from "@/components/shared/agent-status-badge";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "Agents",
};

export default function AgentsPage() {
  return (
    <CommandSurface>
      <PageHeader
        title="Agent Network"
        description="Your AI creative team — orchestrated by the CEO Agent, aligned to the Milaene vision."
      >
        <AgentStatusBadge status="active" showPulse />
        <AgentStatusBadge status="planned" />
      </PageHeader>

      <AgentOverview />
      <AgentRoster />
    </CommandSurface>
  );
}
