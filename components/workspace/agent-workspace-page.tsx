"use client";

import { AgentStudio } from "@/components/workspace/agent-studio";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import type { AgentId } from "@/lib/constants/agents";
import { AGENT_STUDIO_SECTIONS } from "@/lib/workspace/agent-routes";
import type { ReactNode } from "react";

interface AgentWorkspacePageProps {
  agentId: AgentId;
  children: ReactNode;
}

export function AgentWorkspacePage({ agentId, children }: AgentWorkspacePageProps) {
  const isCeo = agentId === "ceo";

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
