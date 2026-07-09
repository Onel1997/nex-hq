"use client";

import { FacilityDepartmentShell } from "@/components/facility/facility-department-shell";
import { FacilityDegradedBanner } from "@/components/facility/facility-degraded-banner";
import { useFacilityStream } from "@/components/facility/hooks/use-facility-stream";
import {
  AGENT_CATALOG,
  AGENT_IDS,
  type AgentId,
} from "@/lib/constants/agents";
import { getAgentColor } from "@/lib/facility/facility-theme";
import {
  AGENT_STUDIO_NAMES,
  AGENT_WORKSPACE_ROUTES,
  COMMERCE_LAB_ROUTE,
} from "@/lib/workspace/agent-routes";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Crown,
  Loader2,
  Megaphone,
  Palette,
  PenLine,
  Search,
  ShoppingBag,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

const AGENT_ICONS: Record<AgentId, LucideIcon> = {
  ceo: Crown,
  research: Search,
  designer: Palette,
  content: PenLine,
  image: Wand2,
  marketing: Megaphone,
  shopify: ShoppingBag,
};

const OPS_LABELS: Record<string, string> = {
  idle: "Standby",
  queued: "Queued",
  executing: "Active",
  review: "Review",
  approved: "Approved",
  error: "Error",
};

export function AgentWingCenter() {
  const { data, loading, quotaWarning } = useFacilityStream();

  useEffect(() => {
    console.log("[NexHQ Load] agent wing init start");
  }, []);

  useEffect(() => {
    if (!loading) {
      console.log("[NexHQ Load] agent wing init complete");
    }
  }, [loading]);

  return (
    <FacilityDepartmentShell
      wingId="agents"
      title="Agent Wing"
      icon={Users}
      subtitle="Laboratory pods — status, missions, confidence, and output connections for every agent."
      className="facility-dept-shell-agent-overview"
      headerActions={
        loading ? <Loader2 className="size-4 animate-spin text-[var(--facility-glow-gold)]" /> : null
      }
    >
      <FacilityDegradedBanner show={quotaWarning} />
      {loading && !data ? (
        <div className="facility-wing-loading facility-wing-loading-inline" aria-hidden>
          <Loader2 className="size-5 animate-spin" />
          <p>Scanning agent wing…</p>
        </div>
      ) : null}
      <div className="facility-wing-grid" aria-busy={loading && !data}>
          {AGENT_IDS.map((id) => {
            const agent = AGENT_CATALOG[id];
            const lab = data?.labs[id];
            const color = getAgentColor(id);
            const Icon = AGENT_ICONS[id];
            const href = AGENT_WORKSPACE_ROUTES[id];

            return (
              <Link
                key={id}
                href={href}
                className="facility-agent-pod"
                style={{ "--pod-accent": color } as React.CSSProperties}
              >
                <div className="facility-agent-pod-viewport">
                  <div className="facility-agent-pod-glow" />
                  <Icon className="facility-agent-pod-icon" strokeWidth={1.5} />
                </div>

                <div className="facility-agent-pod-body">
                  <div className="facility-agent-pod-head">
                    <h3>{AGENT_STUDIO_NAMES[id]}</h3>
                    <span
                      className={cn(
                        "facility-agent-pod-status",
                        lab && `facility-agent-pod-status-${lab.opsState}`,
                      )}
                    >
                      {lab ? OPS_LABELS[lab.opsState] ?? lab.opsState : agent.status}
                    </span>
                  </div>

                  <p className="facility-agent-pod-role">{agent.role}</p>

                  {lab?.activeTask ? (
                    <div className="facility-agent-pod-mission">
                      <span className="facility-agent-pod-mission-label">Active mission</span>
                      <span>{lab.activeTask.title}</span>
                    </div>
                  ) : (
                    <p className="facility-agent-pod-activity">
                      {lab?.presence.currentActivity ?? "Awaiting deployment"}
                    </p>
                  )}

                  <div className="facility-agent-pod-meta">
                    <span>
                      Confidence{" "}
                      <strong>{lab?.presence.confidence ?? "—"}%</strong>
                    </span>
                    {lab?.presence.progress != null ? (
                      <span>
                        Progress <strong>{lab.presence.progress}%</strong>
                      </span>
                    ) : null}
                  </div>

                  <div className="facility-agent-pod-connections">
                    <span className="facility-agent-pod-connections-label">Outputs</span>
                    <div className="facility-agent-pod-chips">
                      {agent.capabilities.slice(0, 3).map((cap) => (
                        <span key={cap}>{cap}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          <Link
            href={COMMERCE_LAB_ROUTE}
            className="facility-agent-pod facility-agent-pod-commerce"
            style={{ "--pod-accent": "#F97316" } as React.CSSProperties}
          >
            <div className="facility-agent-pod-viewport">
              <div className="facility-agent-pod-glow" />
              <BarChart3 className="facility-agent-pod-icon" strokeWidth={1.5} />
            </div>
            <div className="facility-agent-pod-body">
              <div className="facility-agent-pod-head">
                <h3>Commerce Lab</h3>
                <span className="facility-agent-pod-status facility-agent-pod-status-executing">
                  Active
                </span>
              </div>
              <p className="facility-agent-pod-role">Business Intelligence</p>
              <p className="facility-agent-pod-activity">
                Analyzing historical commerce data
              </p>
              <div className="facility-agent-pod-meta">
                <span>
                  Confidence <strong>92%</strong>
                </span>
              </div>
            </div>
          </Link>
        </div>
    </FacilityDepartmentShell>
  );
}
