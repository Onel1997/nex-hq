"use client";

import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { CreativeDirectorMessage } from "@/lib/design/design-mission-store";
import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Loader2,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Type,
} from "lucide-react";

const DIRECTOR_SUGGESTIONS: Array<{ label: string; prompt: string }> = [
  { label: "Improve luxury feeling", prompt: "Make typography more premium and increase the luxury feeling" },
  { label: "Reduce typography", prompt: "Reduce visual weight and simplify typography" },
  { label: "Increase emotional impact", prompt: "Increase emotional impact and editorial presence" },
  { label: "More editorial", prompt: "Make the composition more editorial and refined" },
  { label: "Create Version 2", prompt: "Create a refined Version 2 with elevated restraint" },
  { label: "Generate alternate composition", prompt: "Generate an alternate composition with fresh layout" },
  { label: "Improve print efficiency", prompt: "Improve print efficiency and production clarity" },
];

interface InsightBlock {
  title: string;
  body: string;
}

function buildDirectorInsights(
  brief: DesignStudioBrief,
  concept?: DesignConcept,
): InsightBlock[] {
  if (!concept) {
    return [
      {
        title: "Why this design works",
        body: "Generate an AI Design Concept to receive senior creative director feedback on luxury positioning and commercial potential.",
      },
    ];
  }

  return [
    {
      title: "Why this design works",
      body: `${concept.creativeDirection.summary} The ${concept.heroFocus.dominantElement} anchors scroll-stop appeal while ${concept.negativeSpaceProfile.profile} negative space preserves wearability.`,
    },
    {
      title: "Luxury positioning",
      body: `${concept.fashionLanguage.luxurySignals.join(", ")}. Price band: ${concept.commercialIntention.priceBand}.`,
    },
    {
      title: "Target audience",
      body: concept.commercialIntention.buyerHook,
    },
    {
      title: "Trend alignment",
      body: `${concept.creativeDirection.fashionSystem} · ${concept.creativeDirection.emotion}`,
    },
    {
      title: "Fashion references",
      body: `${concept.compositionLanguage.pattern} with ${concept.symbolLanguage.primarySymbols.join(", ")}.`,
    },
    {
      title: "Brand consistency",
      body: `Collection role: ${concept.creativeDirection.collectionRole}. DNA alignment with ${brief.title} at ${brief.dnaScore ?? "—"}% brand fit.`,
    },
    {
      title: "Typography review",
      body: `${concept.typographyLanguage.direction}. Headline: ${concept.typographyLanguage.headlineTreatment}`,
    },
    {
      title: "Composition review",
      body: `${concept.compositionLanguage.balance} balance · ${concept.compositionLanguage.focalStrategy} focal strategy.`,
    },
    {
      title: "Negative space review",
      body: `${concept.negativeSpaceProfile.targetRatio} target ratio. ${concept.negativeSpaceProfile.rules.slice(0, 2).join(" ")}`,
    },
    {
      title: "Print readability",
      body: concept.productionNotes.printReadiness.slice(0, 2).join(" · ") || brief.productionMethod,
    },
    {
      title: "Commercial improvement suggestions",
      body: concept.commercialIntention.wouldBuySignals.slice(0, 3).join(" · "),
    },
    {
      title: "Possible Version 2 ideas",
      body: "Elevate restraint — reduce ornament density, increase hero typography scale, tighten color palette to two tones.",
    },
    {
      title: "Possible Version 3 ideas",
      body: "Editorial remix — asymmetric composition, cropped hero type, stronger symbol contrast for campaign drops.",
    },
  ];
}

interface CreativeDirectorRichPanelProps {
  open: boolean;
  onToggleOpen: () => void;
  brief: DesignStudioBrief;
  concept?: DesignConcept;
  messages: CreativeDirectorMessage[];
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onSuggestion: (prompt: string) => void;
}

export function CreativeDirectorRichPanel({
  open,
  onToggleOpen,
  brief,
  concept,
  messages,
  input,
  loading,
  onInputChange,
  onSend,
  onSuggestion,
}: CreativeDirectorRichPanelProps) {
  const insights = buildDirectorInsights(brief, concept);

  return (
    <section className="cw-v2-director" aria-label="Creative Director">
      <button
        type="button"
        className="cw-v2-director-toggle"
        onClick={onToggleOpen}
        aria-expanded={open}
      >
        <div className="cw-v2-director-toggle-head">
          <Sparkles className="size-4 text-[#d9b46b]" />
          <div>
            <h2>Creative Director</h2>
            <p>Senior creative reasoning · revisions · version ideas</p>
          </div>
        </div>
        <ChevronRight className={cn("size-4", open && "is-open")} />
      </button>

      <div className={cn("cw-v2-director-body-wrap", open && "is-open")} aria-hidden={!open}>
        <div className="cw-v2-director-body">
          <div className="cw-v2-director-insights">
            {insights.map((insight) => (
              <article key={insight.title} className="cw-v2-director-insight">
                <h3>{insight.title}</h3>
                <p>{insight.body}</p>
              </article>
            ))}
          </div>

          <div className="cw-v2-director-actions">
            <p className="cw-v2-director-actions-label">
              <TrendingUp className="size-3.5" /> Quick revisions
            </p>
            <div className="cw-v2-director-chips">
              {DIRECTOR_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  className="cw-v2-director-chip"
                  onClick={() => onSuggestion(suggestion.prompt)}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>

          {messages.length > 0 || loading ? (
            <div className="cw-v2-director-thread">
              {messages.map((message) => (
                <div key={message.id} className={cn("cw-v2-director-msg", message.role)}>
                  {message.content}
                </div>
              ))}
              {loading ? (
                <div className="cw-v2-director-msg assistant">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : null}
            </div>
          ) : null}

          <form
            className="cw-v2-director-input"
            onSubmit={(event) => {
              event.preventDefault();
              onSend();
            }}
          >
            <input
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="Ask the Creative Director for feedback…"
            />
            <button type="submit" disabled={loading || !input.trim()}>
              <MessageSquare className="size-4" />
            </button>
          </form>

          {concept ? (
            <p className="cw-v2-director-footnote">
              <Type className="size-3.5" />
              Typography share target: {concept.typographyLanguage.compositionShare}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
