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
import { CollapsibleInspectorSection } from "@/components/design/collapsible-inspector-section";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Layers,
  MessageSquare,
  Palette,
  Printer,
  Sparkles,
  Type,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface MasterArtworkInspectorProps {
  brief: DesignStudioBrief;
  concept?: DesignConcept;
  direction?: DesignDirection;
  health: DesignHealthScores;
  view: MasterArtworkViewModel;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  revealToken?: number;
}

function buildScoreMilestones(target: number): number[] {
  const clamped = Math.max(0, Math.min(100, Math.round(target)));
  const start = Math.max(0, clamped - 22);
  const midA = start + Math.round((clamped - start) * 0.35);
  const midB = start + Math.round((clamped - start) * 0.68);
  return Array.from(new Set([start, midA, midB, clamped])).sort((a, b) => a - b);
}

function ScoreRing({
  label,
  value,
  delay = 0,
  accent,
  animateSequence = false,
}: {
  label: string;
  value: number;
  delay?: number;
  accent?: boolean;
  animateSequence?: boolean;
}) {
  const [animated, setAnimated] = useState(0);
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    if (!animateSequence) {
      const timer = window.setTimeout(() => setAnimated(value), 80 + delay);
      return () => window.clearTimeout(timer);
    }

    const milestones = buildScoreMilestones(value);
    let step = 0;
    setAnimated(milestones[0] ?? 0);
    let interval: number | undefined;

    const startTimer = window.setTimeout(() => {
      interval = window.setInterval(() => {
        step += 1;
        if (step < milestones.length) {
          setAnimated(milestones[step] ?? value);
        } else if (interval !== undefined) {
          window.clearInterval(interval);
        }
      }, 340);
    }, 120 + delay);

    return () => {
      window.clearTimeout(startTimer);
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
    };
  }, [value, delay, animateSequence]);

  return (
    <div className={cn("ma-score-ring", accent && "is-accent", animateSequence && "is-animating")}>
      <svg viewBox="0 0 36 36" aria-hidden>
        <circle className="ma-score-track" cx="18" cy="18" r={radius} />
        <circle
          className="ma-score-fill"
          cx="18"
          cy="18"
          r={radius}
          style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
        />
      </svg>
      <span className="ma-score-value">{animated}</span>
      <span className="ma-score-label">{label}</span>
    </div>
  );
}

function CommercialReviewContent({
  scores,
  animateSequence,
}: {
  scores: MasterArtworkCommercialScores;
  animateSequence?: boolean;
}) {
  const meters = [
    { key: "luxury", label: "Premium Appeal", value: scores.luxury },
    { key: "originality", label: "Originality", value: scores.originality },
    { key: "print", label: "Print Quality", value: scores.printQuality },
    { key: "brand", label: "Brand Fit", value: scores.brandFit },
    { key: "trend", label: "Trend Potential", value: scores.trendPotential },
    { key: "virality", label: "Virality", value: scores.virality },
    { key: "mfg", label: "Mfg. Simplicity", value: scores.manufacturingSimplicity },
    { key: "conversion", label: "Conversion", value: scores.conversionPotential },
    { key: "overall", label: "Overall", value: scores.overall, accent: true },
  ] as const;

  return (
    <div className="ma-score-grid">
      {meters.map((meter, index) => (
        <ScoreRing
          key={meter.key}
          label={meter.label}
          value={meter.value}
          delay={index * 40}
          accent={"accent" in meter && meter.accent}
          animateSequence={animateSequence && ("accent" in meter && meter.accent)}
        />
      ))}
    </div>
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
  collapsed = false,
  onCollapsedChange,
  revealToken = 0,
}: MasterArtworkInspectorProps) {
  const [scoreAnimate, setScoreAnimate] = useState(false);

  useEffect(() => {
    if (!revealToken || !view.hasArtwork) {
      setScoreAnimate(false);
      return;
    }
    setScoreAnimate(false);
    const timer = window.setTimeout(() => setScoreAnimate(true), 2300);
    return () => window.clearTimeout(timer);
  }, [revealToken, view.hasArtwork]);
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

  const productionNotes = concept
    ? `${concept.productionNotes.method} · ${brief.productionMethod}`
    : `${brief.productionMethod} · ${brief.materialEffects}`;

  const copyPrompt = useCallback(() => {
    const prompt = concept?.imagePrompt.primary ?? brief.imagePrompt;
    void navigator.clipboard.writeText(prompt);
  }, [brief.imagePrompt, concept?.imagePrompt.primary]);

  if (collapsed) {
    return (
      <aside
        className="ma-inspector ma-inspector--collapsed cs-sidebar cs-sidebar-right"
        aria-label="Artwork inspector"
      >
        <button
          type="button"
          className="ma-panel-collapse ma-panel-collapse--right"
          onClick={() => onCollapsedChange?.(false)}
          aria-label="Expand inspector"
          title="Expand inspector"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <div className="ma-inspector-collapsed">
          <Briefcase className="size-4" />
          <span className="ma-inspector-collapsed-score">{scores.overall}%</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="ma-inspector cs-sidebar cs-sidebar-right" aria-label="Artwork inspector">
      <header className="ma-inspector-top">
        <p className="ma-inspector-kicker">Inspector</p>
        <button
          type="button"
          className="ma-panel-collapse ma-panel-collapse--inline"
          onClick={() => onCollapsedChange?.(true)}
          aria-label="Collapse inspector"
          title="Collapse"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </header>

      <div className="ma-inspector-scroll cs-nexhq-scroll">
        <CollapsibleInspectorSection
          id="ma-commercial-title"
          title="Scores"
          icon={Briefcase}
          defaultOpen
        >
          <CommercialReviewContent scores={scores} animateSequence={scoreAnimate} />
        </CollapsibleInspectorSection>

        <CollapsibleInspectorSection
          id="ma-print-title"
          title="Print Readiness"
          icon={Printer}
          defaultOpen={false}
        >
          <p className={cn("ma-readiness", view.state.printReady && "is-ready")}>{printReadiness}</p>
          {view.state.sourceType === "vector-artwork" ? (
            <div className="ma-quality-badges">
              {view.state.kittlBenchmarkScore != null ? (
                <p className="ma-kittl-score">
                  Kittl Benchmark Score: <strong>{view.state.kittlBenchmarkScore}</strong>
                </p>
              ) : null}
              {view.state.textSafe ? (
                <p className="ma-text-safe-badge ma-text-safe-badge--inspector">Text Safe</p>
              ) : null}
              {view.state.printReadyDraft ? (
                <p className="ma-print-ready-badge ma-print-ready-badge--inspector">Print Ready Draft</p>
              ) : null}
              {view.state.qualityTemplateLabel ? (
                <InspectorField
                  icon={Sparkles}
                  label="Composition Template"
                  value={view.state.qualityTemplateLabel}
                />
              ) : null}
            </div>
          ) : null}
          {(view.state.transparentBackground ?? view.state.transparency ?? view.hasArtwork) ? (
            <p className="ma-transparent-badge ma-transparent-badge--inspector">
              Transparent Artwork ✓
            </p>
          ) : null}
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
        </CollapsibleInspectorSection>

        <CollapsibleInspectorSection
          id="ma-director-title"
          title="AI Creative Director"
          icon={MessageSquare}
          defaultOpen={false}
        >
          <div className="ma-feedback-stack">
            <FeedbackRow label="Why this works" text={feedback.whyItWorks} />
            <FeedbackRow label="Typography note" text={feedback.typographyNote} icon={Type} />
            <FeedbackRow label="Composition note" text={feedback.compositionNote} icon={Layers} />
            <FeedbackRow label="Print risk" text={feedback.printRisk} icon={AlertTriangle} />
            <FeedbackRow label="Commercial opportunity" text={feedback.commercialOpportunity} />
            <FeedbackRow label="Suggested next version" text={feedback.suggestedNextVersion} />
          </div>
        </CollapsibleInspectorSection>

        <CollapsibleInspectorSection
          id="ma-metadata-title"
          title="Metadata"
          icon={ClipboardList}
          defaultOpen={false}
        >
          <dl className="ma-meta-grid">
            <div>
              <dt>Design</dt>
              <dd>{brief.title}</dd>
            </div>
            <div>
              <dt>Product</dt>
              <dd>{brief.product}</dd>
            </div>
            <div>
              <dt>Color</dt>
              <dd>{brief.color}</dd>
            </div>
            <div>
              <dt>Placement</dt>
              <dd>{view.state.placement ?? brief.placement}</dd>
            </div>
            <div>
              <dt>Resolution</dt>
              <dd>{view.state.resolution ?? view.state.resolutionLabel ?? "—"}</dd>
            </div>
            <div>
              <dt>DPI</dt>
              <dd>{view.state.dpi != null ? `${view.state.dpi}` : "—"}</dd>
            </div>
          </dl>
        </CollapsibleInspectorSection>

        <CollapsibleInspectorSection
          id="ma-production-title"
          title="Production Notes"
          icon={Printer}
          defaultOpen={false}
        >
          <p className="ma-field-value ma-field-value--block">{productionNotes}</p>
          <InspectorField
            icon={Printer}
            label="Print method"
            value={view.state.printMethod ?? direction?.printStyle ?? brief.productionMethod}
          />
        </CollapsibleInspectorSection>

        <CollapsibleInspectorSection id="ma-prompt-title" title="Prompt" icon={Sparkles} defaultOpen={false}>
          <pre className="ma-prompt-block">
            {concept?.imagePrompt.primary ?? brief.imagePrompt}
          </pre>
          <button type="button" className="cs-btn cs-btn-compact ma-prompt-copy" onClick={copyPrompt}>
            Copy prompt
          </button>
        </CollapsibleInspectorSection>

      </div>
    </aside>
  );
}
