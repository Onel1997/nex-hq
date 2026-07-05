"use client";

import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { DesignDirection } from "@/lib/design/design-directions";
import type { DesignHealthScores } from "@/lib/design/design-mission-store";
import type { MasterArtworkViewModel } from "@/lib/design/master-artwork";
import {
  buildMasterArtworkCommercialScores,
  buildMasterArtworkDirectorFeedback,
  type MasterArtworkCommercialScores,
} from "@/lib/design/master-artwork-feedback";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Briefcase,
  Layers,
  MessageSquare,
  Palette,
  Printer,
  Sparkles,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface MasterArtworkInspectorProps {
  brief: DesignStudioBrief;
  concept?: DesignConcept;
  direction?: DesignDirection;
  health: DesignHealthScores;
  view: MasterArtworkViewModel;
}

function ScoreRing({
  label,
  value,
  delay = 0,
  accent,
}: {
  label: string;
  value: number;
  delay?: number;
  accent?: boolean;
}) {
  const [animated, setAnimated] = useState(0);
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimated(value), 60 + delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return (
    <div className={cn("ma-score-ring", accent && "is-accent")}>
      <svg viewBox="0 0 40 40" aria-hidden>
        <circle className="ma-score-track" cx="20" cy="20" r={radius} />
        <circle
          className="ma-score-fill"
          cx="20"
          cy="20"
          r={radius}
          style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
        />
      </svg>
      <span className="ma-score-value">{animated}</span>
      <span className="ma-score-label">{label}</span>
    </div>
  );
}

function CommercialReviewPanel({ scores }: { scores: MasterArtworkCommercialScores }) {
  const meters = [
    { key: "luxury", label: "Premium Appeal", value: scores.luxury },
    { key: "originality", label: "Originality", value: scores.originality },
    { key: "print", label: "Print Quality", value: scores.printQuality },
    { key: "brand", label: "Brand Fit", value: scores.brandFit },
    { key: "trend", label: "Trend Potential", value: scores.trendPotential },
    { key: "virality", label: "Virality", value: scores.virality },
    { key: "mfg", label: "Manufacturing Simplicity", value: scores.manufacturingSimplicity },
    { key: "conversion", label: "Conversion Potential", value: scores.conversionPotential },
    { key: "overall", label: "Overall", value: scores.overall, accent: true },
  ] as const;

  return (
    <section className="ma-inspector-section" aria-labelledby="ma-commercial-title">
      <header className="ma-inspector-head">
        <Briefcase className="size-3.5" />
        <h3 id="ma-commercial-title">Commercial Review</h3>
      </header>
      <div className="ma-score-grid">
        {meters.map((meter, index) => (
          <ScoreRing
            key={meter.key}
            label={meter.label}
            value={meter.value}
            delay={index * 35}
            accent={"accent" in meter && meter.accent}
          />
        ))}
      </div>
    </section>
  );
}

function InspectorField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Type;
  label: string;
  value: string;
}) {
  return (
    <div className="ma-field">
      <span className="ma-field-label">
        <Icon className="size-3" />
        {label}
      </span>
      <p className="ma-field-value">{value}</p>
    </div>
  );
}

function FeedbackRow({
  label,
  text,
  icon: Icon,
}: {
  label: string;
  text: string;
  icon?: typeof AlertTriangle;
}) {
  return (
    <div className="ma-feedback-row">
      <span className="ma-feedback-label">
        {Icon ? <Icon className="size-3" /> : null}
        {label}
      </span>
      <p>{text}</p>
    </div>
  );
}

export function MasterArtworkInspector({
  brief,
  concept,
  direction,
  health,
  view,
}: MasterArtworkInspectorProps) {
  const scores = useMemo(
    () => buildMasterArtworkCommercialScores(health, direction, view, concept),
    [health, direction, view, concept],
  );

  const feedback = useMemo(
    () => buildMasterArtworkDirectorFeedback(brief, direction, concept, view, health),
    [brief, direction, concept, view, health],
  );

  const printReadiness =
    view.state.printReadiness ??
    (view.state.printReady ? "Print ready" : `${brief.printReadinessScore}% brief score`);

  return (
    <aside className="ma-inspector cs-sidebar cs-sidebar-right" aria-label="Artwork inspector">
      <header className="ma-inspector-top">
        <p className="ma-inspector-kicker">Artwork Inspector</p>
      </header>

      <div className="ma-inspector-scroll cs-nexhq-scroll">
        <CommercialReviewPanel scores={scores} />

        <section className="ma-inspector-section">
          <header className="ma-inspector-head">
            <Printer className="size-3.5" />
            <h3>Print Readiness</h3>
          </header>
          <p className={cn("ma-readiness", view.state.printReady && "is-ready")}>{printReadiness}</p>
          <InspectorField
            icon={Layers}
            label="Composition"
            value={direction?.composition ?? concept?.compositionLanguage.pattern ?? brief.geometry}
          />
          <InspectorField
            icon={Type}
            label="Typography"
            value={direction?.typography ?? concept?.typographyLanguage.direction ?? brief.typography}
          />
          <InspectorField
            icon={Palette}
            label="Color"
            value={direction?.colorSystem ?? brief.colorPalette.map((c) => c.name).join(" · ")}
          />
          <InspectorField
            icon={Printer}
            label="Production Notes"
            value={
              concept
                ? `${concept.productionNotes.method} · ${brief.productionMethod}`
                : `${brief.productionMethod} · ${brief.materialEffects}`
            }
          />
        </section>

        <section className="ma-inspector-section">
          <header className="ma-inspector-head">
            <MessageSquare className="size-3.5" />
            <h3>AI Creative Director</h3>
          </header>
          <div className="ma-feedback-stack">
            <FeedbackRow label="Why this works" text={feedback.whyItWorks} />
            <FeedbackRow label="Typography note" text={feedback.typographyNote} icon={Type} />
            <FeedbackRow label="Composition note" text={feedback.compositionNote} icon={Layers} />
            <FeedbackRow
              label="Print risk"
              text={feedback.printRisk}
              icon={AlertTriangle}
            />
            <FeedbackRow label="Commercial opportunity" text={feedback.commercialOpportunity} />
            <FeedbackRow label="Suggested next version" text={feedback.suggestedNextVersion} />
          </div>
        </section>

        {!view.hasArtwork ? (
          <div className="ma-inspector-hint">
            <Sparkles className="size-4" />
            <p>Generate artwork to unlock full production metadata and approval.</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
