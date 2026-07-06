"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function AnalysisScoreMeter({
  label,
  value,
  delay = 0,
  compact = false,
}: {
  label: string;
  value: number;
  delay?: number;
  compact?: boolean;
}) {
  const [animated, setAnimated] = useState(0);
  const radius = compact ? 14 : 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimated(value), 80 + delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return (
    <div className={cn("dsv2-meter", compact && "is-compact")}>
      <svg className="dsv2-meter-ring" viewBox="0 0 40 40" aria-hidden>
        <circle className="dsv2-meter-track" cx="20" cy="20" r={radius} />
        <circle
          className="dsv2-meter-fill"
          cx="20"
          cy="20"
          r={radius}
          style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
        />
      </svg>
      <span className="dsv2-meter-value">{animated}</span>
      <span className="dsv2-meter-label">{label}</span>
    </div>
  );
}

export function AnalysisBarMeter({
  label,
  value,
  delay = 0,
}: {
  label: string;
  value: number;
  delay?: number;
}) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimated(value), 80 + delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return (
    <div className="dsv2-bar-meter">
      <div className="dsv2-bar-meter-head">
        <span>{label}</span>
        <span>{animated}</span>
      </div>
      <div className="dsv2-bar-meter-track">
        <div className="dsv2-bar-meter-fill" style={{ width: `${animated}%` }} />
      </div>
    </div>
  );
}

export function AnalysisBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "luxury" | "warning";
}) {
  return <span className={cn("dsv2-analysis-badge", `tone-${tone}`)}>{children}</span>;
}

export function ColorSwatchRow({
  swatches,
}: {
  swatches: Array<{ hex: string; role: string; percentage: number }>;
}) {
  if (swatches.length === 0) {
    return <p className="dsv2-inspector-placeholder">No colors extracted.</p>;
  }

  return (
    <div className="dsv2-swatch-grid">
      {swatches.map((swatch) => (
        <div key={`${swatch.hex}-${swatch.role}`} className="dsv2-swatch-card">
          <span className="dsv2-swatch-chip" style={{ backgroundColor: swatch.hex }} />
          <div className="dsv2-swatch-meta">
            <span className="dsv2-swatch-role">{swatch.role}</span>
            <span className="dsv2-swatch-hex">{swatch.hex}</span>
            <span className="dsv2-swatch-pct">{swatch.percentage}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TypographyChipList({
  blocks,
}: {
  blocks: Array<{ role: string; content: string; fontFamily?: string; fontSize?: number }>;
}) {
  if (blocks.length === 0) {
    return <p className="dsv2-inspector-placeholder">No typography layers detected.</p>;
  }

  return (
    <div className="dsv2-typo-chips">
      {blocks.slice(0, 5).map((block, index) => (
        <div key={`${block.role}-${index}`} className="dsv2-typo-chip">
          <span className="dsv2-typo-chip-role">{block.role}</span>
          <span className="dsv2-typo-chip-text">{block.content}</span>
          {block.fontFamily || block.fontSize ? (
            <span className="dsv2-typo-chip-meta">
              {[block.fontFamily, block.fontSize ? `${block.fontSize}px` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PrintCoveragePreview({
  coveragePercent,
  placement,
}: {
  coveragePercent: number;
  placement: string;
}) {
  const fill = Math.max(8, Math.min(92, coveragePercent));

  return (
    <div className="dsv2-print-preview">
      <div className="dsv2-print-garment" aria-hidden>
        <div
          className="dsv2-print-zone"
          style={{ width: `${fill}%`, height: `${Math.min(fill * 1.1, 75)}%` }}
        />
      </div>
      <div className="dsv2-print-preview-meta">
        <span>{placement}</span>
        <span>{coveragePercent}% coverage</span>
      </div>
    </div>
  );
}

export function FocalPointMap({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  return (
    <div className="dsv2-focal-map" aria-label={`Focal point: ${label}`}>
      <div className="dsv2-focal-grid" />
      <span
        className="dsv2-focal-dot"
        style={{ left: `${x}%`, top: `${y}%` }}
      />
      <span className="dsv2-focal-label">{label}</span>
    </div>
  );
}
