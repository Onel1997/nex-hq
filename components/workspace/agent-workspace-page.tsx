"use client";

import { ResearchContextPanel } from "@/components/research/research-context-panel";
import { ResearchIntelligenceFeed } from "@/components/research/research-intelligence-feed";
import { AgentStudio } from "@/components/workspace/agent-studio";
import { useWorkspaceContext } from "@/components/workspace/use-workspace-context";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { AGENT_STUDIO_SECTIONS } from "@/lib/workspace/agent-routes";
import type { AgentId } from "@/lib/constants/agents";
import type { ReactNode } from "react";

interface AgentWorkspacePageProps {
  agentId: AgentId;
  children: ReactNode;
}

function ResearchWorkspaceShell({ children }: { children: ReactNode }) {
  const { data, loading } = useWorkspaceContext("research");

  return (
    <WorkspaceShell
      agentId="research"
      className="research-hq-shell"
      contextPanel={<ResearchContextPanel data={data} loading={loading} />}
      timeline={<ResearchIntelligenceFeed data={data} />}
    >
      <AgentStudio agentId="research" header={children} hideSections />
    </WorkspaceShell>
  );
}

export function AgentWorkspacePage({ agentId, children }: AgentWorkspacePageProps) {
  const isCeo = agentId === "ceo";
  const isResearch = agentId === "research";

  if (isResearch) {
    return <ResearchWorkspaceShell>{children}</ResearchWorkspaceShell>;
  }

  return (
    <WorkspaceShell
      agentId={agentId}
      className={isCeo ? "ceo-command-shell" : undefined}
    >
      <AgentStudio
        agentId={agentId as keyof typeof AGENT_STUDIO_SECTIONS}
        header={children}
        hideSections={isCeo}
      />
    </WorkspaceShell>
  );
}
