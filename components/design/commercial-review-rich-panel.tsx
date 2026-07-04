"use client";

import type { DesignHealthScores } from "@/lib/design/design-mission-store";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { MasterArtworkViewModel } from "@/lib/design/master-artwork";
import { cn } from "@/lib/utils";

interface CommercialReviewRichPanelProps {
  health: DesignHealthScores;
  concept?: DesignConcept;
  masterArtworkView?: MasterArtworkViewModel;
  commercialScore?: number;
  className?: string;
}

interface ScoreDimension {
  key: string;
  label: string;
  value: number;
}

function buildDimensions(
  health: DesignHealthScores,
  concept: DesignConcept | undefined,
  masterScore?: number,
): ScoreDimension[] {
  const overall =
    masterScore ??
    concept?.confidence ??
    Math.round(
      (health.luxury +
        health.originality +
        health.printQuality +
        health.commercialPotential) /
        4,
    );

  return [
    { key: "luxury", label: "Luxury", value: health.luxury },
    { key: "originality", label: "Originality", value: health.originality },
    { key: "printQuality", label: "Print Quality", value: health.printQuality },
    { key: "brandFit", label: "Brand Fit", value: health.brandConsistency },
    { key: "trendPotential", label: "Trend Potential", value: health.trendAlignment },
    { key: "virality", label: "Virality", value: Math.round(health.commercialPotential * 0.55 + health.originality * 0.45) },
    {
      key: "manufacturing",
      label: "Manufacturing Simplicity",
      value: Math.max(0, 100 - health.manufacturingComplexity),
    },
    { key: "conversion", label: "Conversion Potential", value: health.commercialPotential },
    { key: "overall", label: "Overall Production Score", value: overall },
  ];
}

function scoreTier(value: number): string {
  if (value >= 90) return "is-excellent";
  if (value >= 80) return "is-strong";
  if (value >= 70) return "is-good";
  return "is-fair";
}

export function CommercialReviewRichPanel({
  health,
  concept,
  masterArtworkView,
  commercialScore,
  className,
}: CommercialReviewRichPanelProps) {
  const masterScore =
    masterArtworkView?.state.commercialScore ?? commercialScore ?? undefined;
  const dimensions = buildDimensions(health, concept, masterScore);

  return (
    <section className={cn("cw-v2-commercial", className)} aria-label="Commercial review">
      <header className="cw-v2-commercial-header">
        <p className="cw-v2-kicker">Commercial Director</p>
        <h2 className="cw-v2-section-title">Commercial Review</h2>
        <p className="cw-v2-section-subtitle">
          Multi-dimensional scoring across luxury positioning, production readiness, and conversion potential.
        </p>
      </header>

      <div className="cw-v2-commercial-grid">
        {dimensions.map((dimension) => (
          <div
            key={dimension.key}
            className={cn(
              "cw-v2-commercial-dimension",
              dimension.key === "overall" && "is-overall",
              scoreTier(dimension.value),
            )}
          >
            <span className="cw-v2-commercial-label">{dimension.label}</span>
            <span className="cw-v2-commercial-value">{dimension.value}%</span>
            <div className="cw-v2-commercial-track">
              <span
                className="cw-v2-commercial-fill"
                style={{ width: `${dimension.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {masterArtworkView?.state.printReadiness ? (
        <p className="cw-v2-commercial-note">
          Print readiness: {masterArtworkView.state.printReadiness}
        </p>
      ) : null}
    </section>
  );
}
