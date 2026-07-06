"use client";

import {
  AnalysisBadge,
  AnalysisBarMeter,
  AnalysisScoreMeter,
  ColorSwatchRow,
  FocalPointMap,
  PrintCoveragePreview,
  TypographyChipList,
} from "@/components/design/v2/inspector/analysis-primitives";
import type { ArtworkAnalysisResult } from "@/lib/design/artwork-analysis";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ArtworkAnalysisPanelProps {
  analysis: ArtworkAnalysisResult;
}

export function ArtworkAnalysisOverview({ analysis }: ArtworkAnalysisPanelProps) {
  if (analysis.status === "analyzing") {
    return (
      <div className="dsv2-analysis-loading">
        <Loader2 className="size-4 animate-spin" />
        <span>Running creative director analysis…</span>
      </div>
    );
  }

  if (analysis.status === "idle" || analysis.status === "unavailable" || analysis.status === "error") {
    return <p className="dsv2-inspector-placeholder">{analysis.composition.summary}</p>;
  }

  return (
    <div className="dsv2-analysis-overview">
      <div className="dsv2-meter-grid">
        <AnalysisScoreMeter label="Composition" value={analysis.composition.qualityScore} delay={0} compact />
        <AnalysisScoreMeter label="Luxury" value={analysis.commercial.luxuryFeel} delay={40} compact />
        <AnalysisScoreMeter label="Commercial" value={analysis.commercial.commercialPotential} delay={80} compact />
        <AnalysisScoreMeter label="Brand DNA" value={analysis.brandDna.overallScore} delay={120} compact />
      </div>
      <p className="dsv2-analysis-summary">{analysis.graphicStyle.summary}</p>
      <div className="dsv2-badge-row">
        {analysis.graphicStyle.badges.slice(0, 4).map((badge) => (
          <AnalysisBadge key={badge} tone={badge === "Luxury" || badge === "Editorial" ? "luxury" : "accent"}>
            {badge}
          </AnalysisBadge>
        ))}
      </div>
    </div>
  );
}

export function TypographyAnalysisPanel({ analysis }: ArtworkAnalysisPanelProps) {
  if (analysis.status !== "complete") {
    return <p className="dsv2-inspector-placeholder">{analysis.typography.summary}</p>;
  }

  return (
    <div className="dsv2-analysis-section">
      <div className="dsv2-badge-row">
        <AnalysisBadge tone="luxury">{analysis.typography.style}</AnalysisBadge>
        <AnalysisBadge>{analysis.typography.alignment}</AnalysisBadge>
        <AnalysisBadge>{analysis.typography.letterSpacing} spacing</AnalysisBadge>
      </div>
      <TypographyChipList blocks={analysis.typography.blocks} />
      <AnalysisBarMeter label="Hierarchy" value={analysis.typography.hierarchyScore} />
      <p className="dsv2-analysis-caption">{analysis.typography.summary}</p>
    </div>
  );
}

export function ColorPalettePanel({ analysis }: ArtworkAnalysisPanelProps) {
  if (analysis.status !== "complete") {
    return <p className="dsv2-inspector-placeholder">{analysis.colorPalette.summary}</p>;
  }

  return (
    <div className="dsv2-analysis-section">
      <ColorSwatchRow swatches={analysis.colorPalette.swatches} />
      <div className="dsv2-meter-grid dsv2-meter-grid--duo">
        <AnalysisScoreMeter label="Contrast" value={analysis.colorPalette.contrastScore} compact />
        <AnalysisScoreMeter label="Print" value={analysis.colorPalette.printFriendliness} delay={40} compact />
      </div>
      <p className="dsv2-analysis-caption">{analysis.colorPalette.summary}</p>
    </div>
  );
}

export function CompositionPanel({ analysis }: ArtworkAnalysisPanelProps) {
  if (analysis.status !== "complete") {
    return <p className="dsv2-inspector-placeholder">{analysis.composition.summary}</p>;
  }

  return (
    <div className="dsv2-analysis-section">
      <FocalPointMap
        x={analysis.composition.focalPoint.x}
        y={analysis.composition.focalPoint.y}
        label={analysis.composition.focalPoint.label}
      />
      <div className="dsv2-meter-grid dsv2-meter-grid--duo">
        <AnalysisScoreMeter label="Balance" value={analysis.composition.balanceScore} compact />
        <AnalysisScoreMeter label="Symmetry" value={analysis.composition.symmetryScore} delay={40} compact />
      </div>
      <div className="dsv2-info-list dsv2-info-list--flat">
        <div className="dsv2-info-row">
          <dt>Negative space</dt>
          <dd>{analysis.composition.negativeSpacePercent}%</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Visual weight</dt>
          <dd>{analysis.composition.visualWeight}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Reading flow</dt>
          <dd>{analysis.composition.readingDirection}</dd>
        </div>
      </div>
      <p className="dsv2-analysis-caption">{analysis.composition.summary}</p>
    </div>
  );
}

export function PrintAnalysisPanel({ analysis }: ArtworkAnalysisPanelProps) {
  if (analysis.status !== "complete") {
    return <p className="dsv2-inspector-placeholder">{analysis.print.summary}</p>;
  }

  return (
    <div className="dsv2-analysis-section">
      <PrintCoveragePreview
        coveragePercent={analysis.print.coveragePercent}
        placement={analysis.print.placement}
      />
      <div className="dsv2-info-list dsv2-info-list--flat">
        <div className="dsv2-info-row">
          <dt>Placement</dt>
          <dd>{analysis.print.placement}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Coverage</dt>
          <dd>{analysis.print.coverageLabel}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Max print size</dt>
          <dd>{analysis.print.maxPrintSize}</dd>
        </div>
      </div>
      <p className="dsv2-analysis-caption">{analysis.print.summary}</p>
    </div>
  );
}

export function CommercialAnalysisPanel({ analysis }: ArtworkAnalysisPanelProps) {
  if (analysis.status !== "complete") {
    return <p className="dsv2-inspector-placeholder">{analysis.commercial.summary}</p>;
  }

  const meters = [
    { label: "Luxury Feel", value: analysis.commercial.luxuryFeel },
    { label: "Commercial Potential", value: analysis.commercial.commercialPotential },
    { label: "Brand Consistency", value: analysis.commercial.brandConsistency },
    { label: "Trend Potential", value: analysis.commercial.trendPotential },
    { label: "Production Risk", value: 100 - analysis.commercial.productionRisk },
    { label: "Manufacturing Ease", value: 100 - analysis.commercial.manufacturingDifficulty },
  ];

  return (
    <div className="dsv2-analysis-section">
      <div className="dsv2-meter-grid">
        {meters.map((meter, index) => (
          <AnalysisScoreMeter
            key={meter.label}
            label={meter.label}
            value={meter.value}
            delay={index * 30}
            compact
          />
        ))}
      </div>
      <p className="dsv2-analysis-caption">{analysis.commercial.summary}</p>
    </div>
  );
}

export function BrandDnaPanel({ analysis }: ArtworkAnalysisPanelProps) {
  if (analysis.status !== "complete") {
    return <p className="dsv2-inspector-placeholder">{analysis.brandDna.summary}</p>;
  }

  return (
    <div className="dsv2-analysis-section">
      <AnalysisBarMeter label="Milaene DNA Match" value={analysis.brandDna.overallScore} />
      <div className="dsv2-dna-traits">
        {analysis.brandDna.traits.map((trait) => (
          <div key={trait.label} className="dsv2-dna-trait">
            <div className="dsv2-dna-trait-head">
              <span>{trait.label}</span>
              <span>{trait.score}</span>
            </div>
            <div className="dsv2-bar-meter-track">
              <div
                className={cn("dsv2-bar-meter-fill", trait.match && "is-match")}
                style={{ width: `${trait.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="dsv2-analysis-caption">{analysis.brandDna.summary}</p>
    </div>
  );
}

export function CreativeInsightsPanel({ analysis }: ArtworkAnalysisPanelProps) {
  if (analysis.status !== "complete") {
    return <p className="dsv2-inspector-placeholder">{analysis.creative.storytelling}</p>;
  }

  return (
    <div className="dsv2-analysis-section">
      <div className="dsv2-info-list dsv2-info-list--flat">
        <div className="dsv2-info-row">
          <dt>Target audience</dt>
          <dd>{analysis.creative.targetAudience}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Emotion</dt>
          <dd>{analysis.creative.emotion}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Complexity</dt>
          <dd>{analysis.creative.complexity}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Visual hierarchy</dt>
          <dd>{analysis.creative.visualHierarchy}</dd>
        </div>
      </div>
      <p className="dsv2-analysis-caption">{analysis.creative.storytelling}</p>
    </div>
  );
}

export function SuggestionsPanel({ analysis }: ArtworkAnalysisPanelProps) {
  if (analysis.suggestions.length === 0) {
    return <p className="dsv2-inspector-placeholder">No optional suggestions — artwork reads production-ready.</p>;
  }

  return (
    <ul className="dsv2-suggestions">
      {analysis.suggestions.map((suggestion) => (
        <li key={suggestion.id}>{suggestion.message}</li>
      ))}
    </ul>
  );
}
