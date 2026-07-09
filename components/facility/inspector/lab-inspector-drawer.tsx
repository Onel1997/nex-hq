"use client";

import { AgentMemoryPanel } from "@/components/facility/inspector/agent-memory-panel";
import { AgentMetricsGrid } from "@/components/facility/inspector/agent-metric-card";
import { AgentReportList } from "@/components/facility/inspector/agent-report-list";
import { AgentSection } from "@/components/facility/inspector/agent-section";
import { AgentTimeline } from "@/components/facility/inspector/agent-timeline";
import { CeoIntelligencePanel } from "@/components/facility/inspector/labs/ceo-intelligence";
import { ContentIntelligencePanel } from "@/components/facility/inspector/labs/content-intelligence";
import { DesignIntelligencePanel } from "@/components/facility/inspector/labs/design-intelligence";
import { ImageIntelligencePanel } from "@/components/facility/inspector/labs/image-intelligence";
import { MarketingIntelligencePanel } from "@/components/facility/inspector/labs/marketing-intelligence";
import { ResearchIntelligencePanel } from "@/components/facility/inspector/labs/research-intelligence";
import { ShopifyCatalogBrief } from "@/components/facility/inspector/labs/shopify-catalog-brief";
import { ShopifyIntelligencePanel } from "@/components/facility/inspector/labs/shopify-intelligence";
import { ShopifyLiveProducts } from "@/components/facility/inspector/labs/shopify-live-products";
import type { AgentId } from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import type { LabInspectorData, LabSnapshot } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, FlaskConical, Loader2, X } from "lucide-react";
import Link from "next/link";
import { memo, type ReactNode } from "react";
import {
  getAgentStudioName,
  getAgentWorkspaceRoute,
} from "@/lib/workspace/agent-routes";

const LAB_INTEL_SECTIONS: Partial<
  Record<
    AgentId,
    { title: string; render: (data: LabInspectorData, open: boolean) => ReactNode }
  >
> = {
  research: {
    title: "Research Intelligence",
    render: (data) => (
      <ResearchIntelligencePanel reports={data.fullReports} />
    ),
  },
  designer: {
    title: "Creative Direction",
    render: (data, open) => (
      <>
        <ShopifyCatalogBrief open={open} variant="designer" />
        <DesignIntelligencePanel reports={data.fullReports} />
      </>
    ),
  },
  marketing: {
    title: "Campaign Control",
    render: (data, open) => (
      <>
        <ShopifyCatalogBrief open={open} variant="marketing" />
        <MarketingIntelligencePanel reports={data.fullReports} />
      </>
    ),
  },
  content: {
    title: "Content Pipeline",
    render: (data) => (
      <ContentIntelligencePanel
        reports={data.fullReports}
        tasks={data.taskQueue}
      />
    ),
  },
  image: {
    title: "Visual Assets",
    render: (data, open) => (
      <>
        <ShopifyCatalogBrief open={open} variant="image" />
        <ImageIntelligencePanel reports={data.fullReports} />
      </>
    ),
  },
  shopify: {
    title: "Live Products",
    render: (_data, open) => (
      <>
        <ShopifyCatalogBrief open={open} variant="shopify" />
        <ShopifyLiveProducts open={open} />
      </>
    ),
  },
  ceo: {
    title: "Executive Intelligence",
    render: (data, open) => (
      <>
        <ShopifyCatalogBrief open={open} variant="ceo" />
        <CeoIntelligencePanel
          reports={data.fullReports}
          tasks={data.taskQueue}
          events={data.recentEvents}
        />
      </>
    ),
  },
};

interface LabInspectorDrawerProps {
  open: boolean;
  agentId: AgentId | null;
  lab: LabSnapshot | null;
  data: LabInspectorData | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onEnterWorkspace?: (agentId: AgentId) => void;
}

export const LabInspectorDrawer = memo(function LabInspectorDrawer({
  open,
  agentId,
  lab,
  data,
  loading,
  error,
  onClose,
  onEnterWorkspace,
}: LabInspectorDrawerProps) {
  const displayName = data?.agentName ?? lab?.label ?? agentId;
  const studioName = agentId ? getAgentStudioName(agentId) : null;
  const workspaceRoute = agentId ? getAgentWorkspaceRoute(agentId) : null;
  const activeTasks =
    data?.taskQueue.filter((t) => t.status !== "completed" && t.status !== "failed") ??
    [];
  const accent = agentId ? getAgentColor(agentId) : undefined;
  const intelSection = agentId ? LAB_INTEL_SECTIONS[agentId] : undefined;

  return (
    <AnimatePresence>
      {open && agentId ? (
        <>
          <motion.button
            type="button"
            className="facility-inspector-backdrop"
            aria-label="Close laboratory"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="facility-inspector-drawer facility-lab-room"
            style={
              accent
                ? ({ "--agent-accent": accent } as React.CSSProperties)
                : undefined
            }
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="facility-lab-room-ambient" aria-hidden />

            <header className="facility-inspector-header facility-lab-room-header">
              <div className="facility-lab-room-title-block">
                <div
                  className="facility-lab-room-badge"
                  style={accent ? { color: accent } : undefined}
                >
                  <FlaskConical className="size-3.5" />
                  <span>Laboratory Chamber</span>
                </div>
                <h2 className="facility-inspector-title">{displayName}</h2>
                {data?.role ? (
                  <p className="facility-inspector-role">{data.role}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="facility-inspector-close"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="facility-inspector-body">
              {loading && !data ? (
                <div className="facility-inspector-loading">
                  <Loader2 className="size-5 animate-spin" />
                  <span>Opening laboratory…</span>
                </div>
              ) : error ? (
                <p className="facility-inspector-error">{error}</p>
              ) : data ? (
                <>
                  <div
                    className={cn(
                      "facility-lab-room-livebar",
                      `facility-lab-room-livebar-${data.opsState}`,
                    )}
                  >
                    <span className="facility-lab-room-livebar-pulse" aria-hidden />
                    <span className="facility-lab-room-livebar-label">
                      {data.opsState === "executing"
                        ? "Agent is working"
                        : data.opsState === "review"
                          ? "Awaiting review"
                          : data.opsState === "queued"
                            ? "Task queued"
                            : data.opsState === "approved"
                              ? "Mission complete"
                              : data.opsState === "error"
                                ? "Attention needed"
                                : "Standing by"}
                    </span>
                    {data.opsState === "executing" ? (
                      <span className="facility-lab-room-livebar-dots" aria-hidden>
                        <i /><i /><i />
                      </span>
                    ) : null}
                  </div>

                  {intelSection ? (
                    <AgentSection title={intelSection.title} agentId={agentId}>
                      {intelSection.render(data, open)}
                      {agentId === "shopify" ? (
                        <ShopifyIntelligencePanel reports={data.fullReports} />
                      ) : null}
                    </AgentSection>
                  ) : null}

                  <AgentSection title="Current Mission" agentId={agentId}>
                    <div className="facility-lab-room-card">
                      <p className="facility-inspector-text">
                        {data.currentTask?.title ?? "No active mission assigned"}
                      </p>
                      <div className="facility-inspector-status-row">
                        <span
                          className={cn(
                            "facility-inspector-status",
                            `facility-inspector-status-${data.opsState}`,
                          )}
                        >
                          {data.opsState}
                        </span>
                      </div>
                    </div>
                  </AgentSection>

                  <AgentSection
                    title="Active Tasks"
                    agentId={agentId}
                    empty={activeTasks.length === 0}
                    emptyMessage="No active tasks"
                  >
                    <ul className="facility-inspector-list facility-lab-room-list">
                      {activeTasks.map((task) => (
                        <li
                          key={task.id}
                          className="facility-inspector-list-item facility-lab-room-list-item"
                        >
                          <span>{task.title}</span>
                          <span
                            className="facility-inspector-meta"
                            data-status={task.status}
                          >
                            {task.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </AgentSection>

                  <AgentSection
                    title="Recent Reports"
                    agentId={agentId}
                    empty={data.reports.length === 0}
                    emptyMessage="No reports submitted"
                  >
                    <AgentReportList reports={data.reports} />
                  </AgentSection>

                  <AgentSection
                    title="Knowledge Memory"
                    agentId={agentId}
                    empty={
                      data.reports.length === 0 &&
                      data.taskQueue.length === 0 &&
                      data.knowledgeRefs.length === 0
                    }
                    emptyMessage="No knowledge linked"
                  >
                    <AgentMemoryPanel
                      reports={data.reports}
                      tasks={data.taskQueue}
                      knowledgeRefs={data.knowledgeRefs}
                    />
                  </AgentSection>

                  <AgentSection title="Agent Metrics" agentId={agentId}>
                    <AgentMetricsGrid agentId={agentId} metrics={data.metrics} />
                  </AgentSection>

                  <AgentSection
                    title="Timeline Activity"
                    agentId={agentId}
                    className="facility-lab-room-timeline"
                  >
                    <AgentTimeline items={data.timeline} agentId={agentId} />
                  </AgentSection>
                </>
              ) : null}
            </div>

            {agentId && workspaceRoute ? (
              <footer className="facility-inspector-workspace-actions">
                <div className="facility-inspector-workspace-status">
                  <span className="facility-inspector-workspace-status-dot" />
                  <span>
                    {data?.opsState === "executing"
                      ? "Workspace active"
                      : "Workspace ready"}
                  </span>
                </div>
                <Link
                  href={workspaceRoute}
                  className="facility-inspector-studio-button"
                >
                  <ExternalLink className="size-3.5" />
                  Open Studio
                </Link>
                <button
                  type="button"
                  className="facility-inspector-enter-lab"
                  onClick={() => onEnterWorkspace?.(agentId)}
                >
                  Enter {studioName ?? "Lab"}
                </button>
              </footer>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
});
