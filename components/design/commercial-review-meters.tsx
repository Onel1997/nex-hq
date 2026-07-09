"use client";

import type { DesignHealthScores } from "@/lib/design/design-mission-store";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { MasterArtworkViewModel } from "@/lib/design/master-artwork";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface MeterSpec {
  key: string;
  label: string;
  value: number;
}

function buildMeters(
  health: DesignHealthScores,
  concept: DesignConcept | undefined,
  masterScore?: number,
): MeterSpec[] {
  const overall =
    masterScore ??
    concept?.confidence ??
    Math.round(
      (health.luxury + health.commercialPotential + health.originality + health.printQuality) / 4,
    );

  return [
    { key: "luxury", label: "Luxury Positioning", value: health.luxury },
    { key: "commercial", label: "Commercial", value: health.commercialPotential },
    { key: "originality", label: "Originality", value: health.originality },
    { key: "print", label: "Print", value: health.printQuality },
    {
      key: "manufacturing",
      label: "Manufacturing",
      value: Math.max(0, 100 - health.manufacturingComplexity),
    },
    { key: "brandFit", label: "Brand Fit", value: health.brandConsistency },
    {
      key: "virality",
      label: "Virality",
      value: Math.round(health.commercialPotential * 0.55 + health.originality * 0.45),
    },
    { key: "conversion", label: "Conversion", value: health.commercialPotential },
    { key: "overall", label: "Overall", value: overall },
  ];
}

function ScoreMeter({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  const [animated, setAnimated] = useState(0);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimated(value), 80 + delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return (
    <div className="cs-meter">
      <svg className="cs-meter-ring" viewBox="0 0 44 44" aria-hidden>
        <circle className="cs-meter-track" cx="22" cy="22" r={radius} />
        <circle
          className="cs-meter-fill"
          cx="22"
          cy="22"
          r={radius}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <span className="cs-meter-value">{animated}</span>
      <span className="cs-meter-label">{label}</span>
    </div>
  );
}

interface CommercialReviewMetersProps {
  health: DesignHealthScores;
  concept?: DesignConcept;
  masterArtworkView?: MasterArtworkViewModel;
  commercialScore?: number;
  className?: string;
  compact?: boolean;
}

export function CommercialReviewMeters({
  health,
  concept,
  masterArtworkView,
  commercialScore,
  className,
  compact = false,
}: CommercialReviewMetersProps) {
  const masterScore =
    masterArtworkView?.state.commercialScore ?? commercialScore ?? undefined;
  const allMeters = buildMeters(health, concept, masterScore);
  const meters = compact
    ? allMeters.filter((meter) =>
        ["overall", "luxury", "commercial", "print"].includes(meter.key),
      )
    : allMeters;

  return (
    <div className={cn("cs-meters-grid", compact && "cs-meters-grid--compact", className)}>
      {meters.map((meter, index) => (
        <ScoreMeter
          key={meter.key}
          label={meter.label}
          value={meter.value}
          delay={index * 40}
        />
      ))}
    </div>
  );
}
