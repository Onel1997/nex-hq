"use client";

import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import {
  WorkspaceContextPanel,
  WorkspaceTimeline,
} from "@/components/workspace/workspace-context-panel";
import { useWorkspaceContext } from "@/components/workspace/use-workspace-context";
import { AgentStatusBadge } from "@/components/shared/agent-status-badge";
import { AGENT_CATALOG, type AgentId } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import {
  getAgentStudioName,
  getAgentWorkspaceRoute,
} from "@/lib/workspace/agent-routes";
import { cn } from "@/lib/utils";
import { ChevronRight, Home, Loader2, Play } from "lucide-react";
import Link from "next/link";

interface WorkspaceShellProps {
  agentId: AgentId;
  children: React.ReactNode;
  onRun?: () => void;
  runLabel?: string;
  runLoading?: boolean;
  runDisabled?: boolean;
  className?: string;
  hideHeader?: boolean;
  contextPanel?: React.ReactNode;
}

export function WorkspaceShell({
  agentId,
  children,
  onRun,
  runLabel = "Run Agent",
  runLoading = false,
  runDisabled = false,
  className,
  hideHeader = false,
  contextPanel,
}: WorkspaceShellProps) {
  const { data, loading } = useWorkspaceContext(agentId);
  const accent = getAgentColor(agentId);
  const agent = AGENT_CATALOG[agentId];
  const studioName = getAgentStudioName(agentId);

  return (
    <div
      className={cn("workspace-shell", className)}
      style={{ "--workspace-accent": accent } as React.CSSProperties}
    >
      <WorkspaceNav activeAgentId={agentId} />

      <div className="workspace-main">
        {!hideHeader ? (
          <header className="workspace-header">
            <nav className="workspace-breadcrumbs" aria-label="Breadcrumb">
              <Link href="/" className="workspace-breadcrumb-link">
                <Home className="size-3.5" />
                <span>Facility</span>
              </Link>
              <ChevronRight className="size-3.5 opacity-40" />
              <Link
                href={getAgentWorkspaceRoute(agentId)}
                className="workspace-breadcrumb-link workspace-breadcrumb-current"
              >
                {studioName}
              </Link>
            </nav>

            <div className="workspace-header-meta">
              <div className="workspace-header-status">
                <AgentStatusBadge
                  status={agent.status}
                  showPulse={agent.status === "active"}
                />
                {data ? (
                  <span
                    className={cn(
                      "workspace-ops-badge",
                      `workspace-ops-badge-${data.opsState}`,
                    )}
                  >
                    {data.opsState}
                  </span>
                ) : null}
              </div>

              {onRun ? (
                <button
                  type="button"
                  className="workspace-run-button"
                  onClick={onRun}
                  disabled={runDisabled || runLoading}
                >
                  {runLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  {runLabel}
                </button>
              ) : null}
            </div>
          </header>
        ) : null}

        <div className="workspace-body">
          <main className="workspace-center">{children}</main>
          {contextPanel ?? (
            <WorkspaceContextPanel data={data} loading={loading} />
          )}
        </div>

        <WorkspaceTimeline agentId={agentId} data={data} />
      </div>
    </div>
  );
}
