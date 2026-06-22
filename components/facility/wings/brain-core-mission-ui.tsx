"use client";

import type { CeoMissionReview, MissionDecisionRecord, MissionIntelligenceState } from "@/lib/facility/brain-core-missions";
import { formatEta } from "@/lib/facility/brain-core-missions";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Shield, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

export function MissionPanel({
  mission,
}: {
  mission: NonNullable<MissionIntelligenceState["activeMission"]>;
}) {
  return (
    <aside className="bc-mission-panel" aria-label="Active mission">
      <header className="bc-mission-panel-header">
        <Shield className="size-3.5" />
        <span>Active Mission</span>
      </header>
      <h3 className="bc-mission-title">{mission.definition.title}</h3>
      <dl className="bc-mission-stats">
        <div>
          <dt>Status</dt>
          <dd>{mission.statusLabel}</dd>
        </div>
        <div>
          <dt>Current Agent</dt>
          <dd>{mission.currentAgentLabel}</dd>
        </div>
        <div>
          <dt>Progress</dt>
          <dd>
            {mission.stageIndex} / {mission.totalStages} stages
          </dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd className="bc-mission-confidence">{mission.confidence}%</dd>
        </div>
        <div>
          <dt>Estimated Completion</dt>
          <dd className="bc-mission-eta">
            <Clock className="size-3" />
            {formatEta(mission.estimatedSecondsRemaining)}
          </dd>
        </div>
      </dl>
      <div className="bc-mission-progress-bar" aria-hidden>
        <span
          className="bc-mission-progress-fill"
          style={{
            width: `${(mission.stageIndex / mission.totalStages) * 100}%`,
          }}
        />
      </div>
    </aside>
  );
}

export function CeoReviewOverlay({ review }: { review: CeoMissionReview }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [review.missionTitle, review.confidence, review.decision]);

  return (
    <aside
      className={cn("bc-ceo-review", "bc-ceo-review-visible", expanded && "bc-ceo-review-expanded")}
      aria-label="Mission review"
      aria-expanded={expanded}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onClick={() => setExpanded((value) => !value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setExpanded((value) => !value);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="bc-ceo-review-card">
        <div className="bc-ceo-review-summary">
          <div className="bc-ceo-review-summary-main">
            <span className="bc-ceo-review-badge">Mission Review</span>
            <h3>{review.missionTitle}</h3>
          </div>
          <div className="bc-ceo-review-summary-meta">
            <span className="bc-ceo-review-confidence">{review.confidence}%</span>
            <span
              className={cn(
                "bc-ceo-review-verdict",
                `bc-verdict-${review.decision.toLowerCase()}`,
              )}
            >
              {review.decision}
            </span>
            <ChevronDown className="bc-ceo-review-chevron" aria-hidden />
          </div>
        </div>

        <div className="bc-ceo-review-details" aria-hidden={!expanded}>
          <dl className="bc-ceo-review-grid">
            <div>
              <dt>Supporting Agents</dt>
              <dd>{review.supportingAgents}</dd>
            </div>
            <div>
              <dt>Recommendation</dt>
              <dd className={cn("bc-verdict", `bc-verdict-${review.recommendation.toLowerCase()}`)}>
                {review.recommendation}
              </dd>
            </div>
            <div>
              <dt>Decision</dt>
              <dd className={cn("bc-verdict", `bc-verdict-${review.decision.toLowerCase()}`)}>
                {review.decision}
              </dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{review.confidence}%</dd>
            </div>
          </dl>
        </div>
      </div>
    </aside>
  );
}

export function DecisionHistoryPanel({ records }: { records: MissionDecisionRecord[] }) {
  return (
    <section className="bc-decision-history" aria-label="Decision history">
      <header className="bc-panel-header">
        <CheckCircle2 className="size-4" />
        <h2>Decision History</h2>
      </header>
      <ul className="bc-decision-history-list">
        {records.map((record) => (
          <li
            key={record.id}
            className={cn("bc-decision-history-item", `bc-verdict-${record.verdict.toLowerCase()}`)}
          >
            <span className="bc-decision-history-verdict">{record.verdict}</span>
            <div>
              <p>{record.missionTitle}</p>
              <span>{record.confidence}% confidence</span>
            </div>
            <VerdictIcon verdict={record.verdict} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function VerdictIcon({ verdict }: { verdict: MissionDecisionRecord["verdict"] }) {
  if (verdict === "APPROVED") return <CheckCircle2 className="size-3.5 bc-verdict-approved" />;
  if (verdict === "DECLINED") return <XCircle className="size-3.5 bc-verdict-declined" />;
  return <AlertTriangle className="size-3.5 bc-verdict-review" />;
}

export function EmergencyBanner({ message }: { message: string }) {
  return (
    <div className="bc-emergency-banner" role="alert">
      <AlertTriangle className="size-3.5" />
      <span>{message}</span>
      <span className="bc-emergency-routing">CEO alert routing active</span>
    </div>
  );
}
