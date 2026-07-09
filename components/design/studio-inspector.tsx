"use client";

import type { DesignStudioBrief, IntelligenceHandoffContext } from "@/agents/design/studio-brief";
import type {
  DesignHealthScores,
  DesignIteration,
  DesignMissionAssets,
  DesignVersionEntry,
} from "@/lib/design/design-mission-store";
import type { DesignConcept, DesignConceptReview, RenderPlan } from "@/lib/design/ai-designer/types";
import type { DesignDirection } from "@/lib/design/design-directions";
import type { MasterArtworkViewModel } from "@/lib/design/master-artwork";
import { CommercialReviewMeters } from "@/components/design/commercial-review-meters";
import { DesignLabCollapse } from "@/components/design/design-lab-workspace";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  ChevronDown,
  ClipboardList,
  Factory,
  History,
  Palette,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";

function truncateInsight(text: string, maxLines = 3): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, maxLines).join(" ");
}

function DirectorCard({
  title,
  icon: Icon,
  insight,
  score,
  defaultOpen = false,
}: {
  title: string;
  icon: typeof Sparkles;
  insight: string;
  score?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("cs-director-card", open && "is-open")}>
      <button
        type="button"
        className="cs-director-card-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="cs-director-card-leading">
          <span className="cs-director-icon-wrap">
            <Icon className="size-3" />
          </span>
          <span className="cs-director-card-title">{title}</span>
        </span>
        <span className="cs-director-card-meta">
          {score ? <span className="cs-director-score">{score}</span> : null}
          <ChevronDown className={cn("cs-director-chevron", open && "is-open")} />
        </span>
      </button>
      {open ? (
        <p className="cs-director-insight">{truncateInsight(insight)}</p>
      ) : (
        <p className="cs-director-insight cs-director-insight--peek">{truncateInsight(insight, 2)}</p>
      )}
    </section>
  );
}

interface StudioInspectorProps {
  brief: DesignStudioBrief;
  concept?: DesignConcept;
  review?: DesignConceptReview;
  renderPlan?: RenderPlan;
  assets: DesignMissionAssets;
  health: DesignHealthScores;
  masterArtworkView: MasterArtworkViewModel;
  commercialScore?: number;
  collectionName?: string;
  intelligenceContext?: IntelligenceHandoffContext;
  versionHistory: DesignVersionEntry[];
  activeIteration: DesignIteration;
  selectedDirection?: DesignDirection;
  advancedTools?: ReactNode;
}

export function StudioInspector({
  brief,
  concept,
  review,
  renderPlan,
  assets,
  health,
  masterArtworkView,
  commercialScore,
  collectionName,
  intelligenceContext,
  versionHistory,
  activeIteration,
  selectedDirection,
  advancedTools,
}: StudioInspectorProps) {
  const teamInsight = useCallback(
    (role: string, fallback: string) => {
      const match = selectedDirection?.teamInsights.find((item) => item.role.includes(role));
      return match?.insight ?? fallback;
    },
    [selectedDirection?.teamInsights],
  );

  const directors = useMemo(() => {
    const overall =
      masterArtworkView.state.commercialScore ??
      commercialScore ??
      review?.score ??
      concept?.confidence;

    return [
      {
        id: "creative",
        title: "Creative Director",
        icon: Wand2,
        score: concept ? `${concept.confidence}%` : undefined,
        insight: concept
          ? teamInsight("Creative Director", concept.creativeDirection.summary)
          : "Generate a concept to receive creative direction on brand positioning and editorial tone.",
        defaultOpen: true,
      },
      {
        id: "commercial",
        title: "Commercial Director",
        icon: Briefcase,
        score: overall != null ? `${overall}%` : `${health.commercialPotential}%`,
        insight: teamInsight(
          "Commercial Director",
          concept
            ? `${concept.commercialIntention.buyerHook} Conversion potential at ${health.commercialPotential}%.`
            : "Commercial scoring unlocks after concept generation.",
        ),
      },
      {
        id: "brand",
        title: "Brand Director",
        icon: Palette,
        score: `${health.brandConsistency}%`,
        insight: teamInsight(
          "Research Director",
          concept
            ? `${concept.creativeDirection.collectionRole}. Brand DNA alignment at ${brief.dnaScore ?? health.brandConsistency}%.`
            : intelligenceContext?.executiveSummary ??
              `${brief.title} — brand fit pending concept review.`,
        ),
      },
      {
        id: "production",
        title: "Production Director",
        icon: Factory,
        score: `${health.printQuality}%`,
        insight: teamInsight(
          "Print Engineer",
          concept
            ? `${concept.productionNotes.method} · ${brief.productionMethod}. Print quality ${health.printQuality}%, complexity ${health.manufacturingComplexity}%.`
            : `Production method: ${brief.productionMethod}. Print readiness ${brief.printReadinessScore}%.`,
        ),
      },
    ];
  }, [
    brief,
    commercialScore,
    concept,
    health,
    masterArtworkView.state.commercialScore,
    review?.score,
    teamInsight,
    intelligenceContext?.executiveSummary,
  ]);

  const copyPrompt = useCallback(() => {
    const prompt = concept?.imagePrompt.primary ?? brief.imagePrompt;
    void navigator.clipboard.writeText(prompt);
  }, [brief.imagePrompt, concept?.imagePrompt.primary]);

  return (
    <aside className="cs-sidebar cs-sidebar-right" aria-label="AI creative team">
      <header className="cs-inspector-top">
        <p className="cs-team-kicker">AI Creative Team</p>
      </header>

      <div className="cs-inspector-scroll cs-nexhq-scroll">
        <div className="cs-director-stack">
          {directors.map((director) => (
            <DirectorCard
              key={director.id}
              title={director.title}
              icon={director.icon}
              insight={director.insight}
              score={director.score}
              defaultOpen={director.defaultOpen}
            />
          ))}
        </div>

        <details className="cs-compact-details">
          <summary>
            <Sparkles className="size-3" />
            Commercial Review
          </summary>
          <CommercialReviewMeters
            health={health}
            concept={concept}
            masterArtworkView={masterArtworkView}
            commercialScore={commercialScore}
            compact
          />
        </details>

        <details className="cs-compact-details">
          <summary>
            <ClipboardList className="size-3" />
            Metadata
          </summary>
          <dl className="cs-meta-grid">
            {intelligenceContext ? (
              <>
                <div><dt>Source</dt><dd>{intelligenceContext.sourceType}</dd></div>
                <div><dt>Report ID</dt><dd>{intelligenceContext.sourceReportId}</dd></div>
              </>
            ) : null}
            <div><dt>Collection</dt><dd>{collectionName ?? "—"}</dd></div>
            <div><dt>Version</dt><dd>{activeIteration.label}</dd></div>
            <div><dt>Product</dt><dd>{intelligenceContext?.productName ?? brief.product}</dd></div>
            <div><dt>Color</dt><dd>{brief.color}</dd></div>
          </dl>
          {intelligenceContext?.keyFindings.length ? (
            <div className="cs-meta-block">
              <p className="cs-meta-block-label">Key findings</p>
              <ul className="cs-meta-list">
                {intelligenceContext.keyFindings.slice(0, 4).map((finding) => (
                  <li key={finding}>{finding}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {intelligenceContext?.recommendations.length ? (
            <div className="cs-meta-block">
              <p className="cs-meta-block-label">Recommendations</p>
              <ul className="cs-meta-list">
                {intelligenceContext.recommendations.slice(0, 4).map((rec) => (
                  <li key={rec}>{rec}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {intelligenceContext?.connectedDepartments.length ? (
            <div className="cs-meta-block">
              <p className="cs-meta-block-label">Connected departments</p>
              <p className="cs-meta-inline">
                {intelligenceContext.connectedDepartments.join(" · ")}
              </p>
            </div>
          ) : null}
        </details>

        <details className="cs-compact-details">
          <summary>
            <History className="size-3" />
            Version Notes
          </summary>
          <ul className="cs-version-notes">
            {versionHistory.slice(0, 5).map((entry) => (
              <li key={entry.id}>
                <span>{entry.label}</span>
                <time>
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
            {versionHistory.length === 0 ? (
              <li className="cs-muted">No version events yet.</li>
            ) : null}
          </ul>
        </details>

        {concept ? (
          <details className="cs-compact-details">
            <summary>
              <History className="size-3" />
              Prompt
            </summary>
            <pre className="cs-prompt-block">{concept.imagePrompt.primary}</pre>
            <button type="button" className="cs-btn cs-btn-compact" onClick={copyPrompt}>
              Copy prompt
            </button>
            {renderPlan ? (
              <p className="cs-muted">{renderPlan.deliverables.length} deliverables planned.</p>
            ) : null}
          </details>
        ) : null}

        {advancedTools ? (
          <DesignLabCollapse title="Advanced Tools" meta="SVG · Render · Mockup" defaultOpen={false}>
            {advancedTools}
          </DesignLabCollapse>
        ) : null}
      </div>
    </aside>
  );
}
