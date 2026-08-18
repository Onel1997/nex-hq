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
import { ownerAnalysisLabel } from "@/lib/ux/owner-terminology";
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
        <span>Erweiterte Artwork-Analyse läuft…</span>
      </div>
    );
  }

  if (analysis.status === "idle" || analysis.status === "unavailable" || analysis.status === "error") {
    return <p className="dsv2-inspector-placeholder">{analysis.composition.summary}</p>;
  }

  return (
    <div className="dsv2-analysis-overview">
      <div className="dsv2-meter-grid">
        <AnalysisScoreMeter label="Komposition" value={analysis.composition.qualityScore} delay={0} compact />
        <AnalysisScoreMeter label="Premiumwirkung" value={analysis.commercial.luxuryFeel} delay={40} compact />
        <AnalysisScoreMeter label="Kommerziell" value={analysis.commercial.commercialPotential} delay={80} compact />
        <AnalysisScoreMeter label="Marken-DNA" value={analysis.brandDna.overallScore} delay={120} compact />
      </div>
      <p className="dsv2-analysis-summary">{analysis.graphicStyle.summary}</p>
      <div className="dsv2-badge-row">
        {analysis.graphicStyle.badges.slice(0, 4).map((badge) => (
          <AnalysisBadge key={badge} tone={badge === "Luxury" || badge === "Editorial" ? "luxury" : "accent"}>
            {ownerAnalysisLabel(badge)}
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
        <AnalysisBadge tone="luxury">{ownerAnalysisLabel(analysis.typography.style)}</AnalysisBadge>
        <AnalysisBadge>{ownerAnalysisLabel(analysis.typography.alignment)}</AnalysisBadge>
        <AnalysisBadge>{ownerAnalysisLabel(analysis.typography.letterSpacing)} Laufweite</AnalysisBadge>
      </div>
      <TypographyChipList blocks={analysis.typography.blocks} />
      <AnalysisBarMeter label="Hierarchie" value={analysis.typography.hierarchyScore} />
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
        <AnalysisScoreMeter label="Kontrast" value={analysis.colorPalette.contrastScore} compact />
        <AnalysisScoreMeter label="Druckeignung" value={analysis.colorPalette.printFriendliness} delay={40} compact />
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
        label={ownerAnalysisLabel(analysis.composition.focalPoint.label)}
      />
      <div className="dsv2-meter-grid dsv2-meter-grid--duo">
        <AnalysisScoreMeter label="Balance" value={analysis.composition.balanceScore} compact />
        <AnalysisScoreMeter label="Symmetrie" value={analysis.composition.symmetryScore} delay={40} compact />
      </div>
      <div className="dsv2-info-list dsv2-info-list--flat">
        <div className="dsv2-info-row">
          <dt>Negativraum</dt>
          <dd>{analysis.composition.negativeSpacePercent}%</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Visuelles Gewicht</dt>
          <dd>{ownerAnalysisLabel(analysis.composition.visualWeight)}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Lesefluss</dt>
          <dd>{ownerAnalysisLabel(analysis.composition.readingDirection)}</dd>
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
        placement={ownerAnalysisLabel(analysis.print.placement)}
      />
      <div className="dsv2-info-list dsv2-info-list--flat">
        <div className="dsv2-info-row">
          <dt>Platzierung</dt>
          <dd>{ownerAnalysisLabel(analysis.print.placement)}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Flächenabdeckung</dt>
          <dd>{ownerAnalysisLabel(analysis.print.coverageLabel)}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Maximale Druckgröße</dt>
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
    { label: "Premiumwirkung", value: analysis.commercial.luxuryFeel },
    { label: "Kommerzielles Potenzial", value: analysis.commercial.commercialPotential },
    { label: "Markenkonsistenz", value: analysis.commercial.brandConsistency },
    { label: "Trendpotenzial", value: analysis.commercial.trendPotential },
    { label: "Produktionssicherheit", value: 100 - analysis.commercial.productionRisk },
    { label: "Einfache Fertigung", value: 100 - analysis.commercial.manufacturingDifficulty },
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
      <AnalysisBarMeter label="Übereinstimmung mit Milaene-DNA" value={analysis.brandDna.overallScore} />
      <div className="dsv2-dna-traits">
        {analysis.brandDna.traits.map((trait) => (
          <div key={trait.label} className="dsv2-dna-trait">
            <div className="dsv2-dna-trait-head">
              <span>{ownerAnalysisLabel(trait.label)}</span>
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
          <dt>Zielgruppe</dt>
          <dd>{analysis.creative.targetAudience}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Emotion</dt>
          <dd>{analysis.creative.emotion}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Komplexität</dt>
          <dd>{analysis.creative.complexity}</dd>
        </div>
        <div className="dsv2-info-row">
          <dt>Visuelle Hierarchie</dt>
          <dd>{analysis.creative.visualHierarchy}</dd>
        </div>
      </div>
      <p className="dsv2-analysis-caption">{analysis.creative.storytelling}</p>
    </div>
  );
}

export function SuggestionsPanel({ analysis }: ArtworkAnalysisPanelProps) {
  if (analysis.suggestions.length === 0) {
    return <p className="dsv2-inspector-placeholder">Keine optionalen Hinweise – das Artwork wirkt produktionsbereit.</p>;
  }

  return (
    <ul className="dsv2-suggestions">
      {analysis.suggestions.map((suggestion) => (
        <li key={suggestion.id}>{suggestion.message}</li>
      ))}
    </ul>
  );
}
