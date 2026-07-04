"use client";

import type { DesignDirection } from "@/lib/design/design-directions";
import { compareDirections } from "@/lib/design/design-directions";
import { cn } from "@/lib/utils";
import { Columns2, Trophy, X } from "lucide-react";
import { useMemo } from "react";

interface DirectionCompareModalProps {
  directions: DesignDirection[];
  onClose: () => void;
  onSelectWinner: (directionId: string) => void;
}

function CompareMetricRow({
  label,
  values,
  winnerIndex,
  directionLabels,
}: {
  label: string;
  values: number[];
  winnerIndex: number;
  directionLabels: string[];
}) {
  return (
    <div className="cs-compare-metric">
      <span className="cs-compare-metric-label">{label}</span>
      <div className="cs-compare-metric-values">
        {values.map((value, i) => (
          <div
            key={directionLabels[i]}
            className={cn("cs-compare-metric-cell", i === winnerIndex && "is-winner")}
          >
            <span className="cs-compare-metric-num">{value}%</span>
            {i === winnerIndex ? <Trophy className="size-3" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DirectionCompareModal({
  directions,
  onClose,
  onSelectWinner,
}: DirectionCompareModalProps) {
  const comparison = useMemo(() => compareDirections(directions), [directions]);
  const winner = directions[comparison.overallWinnerIndex];

  return (
    <div className="cs-compare-overlay" role="dialog" aria-label="Compare directions">
      <div className="cs-compare-modal cs-compare-modal--directions">
        <header className="cs-compare-modal-head">
          <h2>
            <Columns2 className="size-5" />
            Direction Comparison
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </header>

        <div className="cs-compare-directions-header">
          {directions.map((direction) => (
            <div key={direction.id} className="cs-compare-direction-col-head">
              <div className="cs-compare-direction-preview">
                {direction.thumbnailColors.map((color, i) => (
                  <span key={i} style={{ background: color }} />
                ))}
              </div>
              <h3>{direction.title}</h3>
              <p>{direction.philosophy}</p>
            </div>
          ))}
        </div>

        <div className="cs-compare-metrics">
          {comparison.metrics.map((metric) => (
            <CompareMetricRow
              key={metric.key}
              label={metric.label}
              values={metric.values}
              winnerIndex={metric.winnerIndex}
              directionLabels={directions.map((d) => d.title)}
            />
          ))}

          <div className="cs-compare-audience">
            <span className="cs-compare-metric-label">Target Audience</span>
            <div className="cs-compare-audience-values">
              {directions.map((d) => (
                <p key={d.id}>{d.targetAudience}</p>
              ))}
            </div>
          </div>
        </div>

        <footer className="cs-compare-footer">
          <div className="cs-compare-overall">
            <Trophy className="size-5 text-[#52c2c2]" />
            <div>
              <span>Overall Winner</span>
              <strong>{winner?.title}</strong>
            </div>
          </div>
          <div className="cs-compare-footer-actions">
            <button type="button" className="cs-btn" onClick={onClose}>
              Close
            </button>
            {winner ? (
              <button
                type="button"
                className="cs-btn cs-btn-primary"
                onClick={() => onSelectWinner(winner.id)}
              >
                <Trophy className="size-3.5" />
                Select {winner.title}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}
