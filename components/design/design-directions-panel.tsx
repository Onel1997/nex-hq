"use client";

import type { DesignDirection } from "@/lib/design/design-directions";
import { cn } from "@/lib/utils";
import { Archive, CheckCircle2, Loader2, Sparkles } from "lucide-react";

interface DesignDirectionsPanelProps {
  directions?: DesignDirection[];
  loading?: boolean;
  hasConcept: boolean;
  onGenerate: () => void;
  onSelect: (directionId: string) => void;
}

function DirectionThumbnail({ colors }: { colors: string[] }) {
  return (
    <div className="cw-v2-direction-thumb" aria-hidden>
      {colors.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="cw-v2-direction-thumb-swatch"
          style={{ background: color, flex: index === 0 ? 1.4 : 1 }}
        />
      ))}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="cw-v2-direction-score">
      <span className="cw-v2-direction-score-label">{label}</span>
      <div className="cw-v2-direction-score-track">
        <span className="cw-v2-direction-score-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="cw-v2-direction-score-value">{value}%</span>
    </div>
  );
}

export function DesignDirectionsPanel({
  directions,
  loading,
  hasConcept,
  onGenerate,
  onSelect,
}: DesignDirectionsPanelProps) {
  const hasDirections = Boolean(directions?.length);
  const selected = directions?.find((direction) => direction.selected);

  return (
    <section className="cw-v2-directions" aria-label="Design directions">
      <header className="cw-v2-directions-header">
        <div>
          <p className="cw-v2-kicker">Fashion Creative Team</p>
          <h2 className="cw-v2-section-title">Design Directions</h2>
          <p className="cw-v2-section-subtitle">
            Generate 3–5 unique creative directions. Commercial review scores each automatically — select one winner to continue.
          </p>
        </div>
        <button
          type="button"
          className="cw-btn cw-btn-primary cw-v2-directions-generate"
          disabled={!hasConcept || loading}
          onClick={onGenerate}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Generate Design Directions
        </button>
      </header>

      {!hasConcept ? (
        <p className="cw-v2-empty-hint">Generate an AI Design Concept first — directions build on the creative briefing.</p>
      ) : !hasDirections ? (
        <p className="cw-v2-empty-hint">Press Generate to explore minimal, typography-led, streetwear, graphic, and vintage directions.</p>
      ) : (
        <>
          {selected ? (
            <p className="cw-v2-directions-selected-note">
              <CheckCircle2 className="size-4" />
              Selected direction: <strong>{selected.title}</strong> — ready for Master Artwork generation.
            </p>
          ) : (
            <p className="cw-v2-directions-selected-note cw-v2-directions-selected-note--pending">
              Select one direction to continue to Master Artwork.
            </p>
          )}
          <div className="cw-v2-directions-grid">
            {directions!.map((direction) => (
              <article
                key={direction.id}
                className={cn(
                  "cw-v2-direction-card",
                  direction.selected && "is-selected",
                  direction.archived && !direction.selected && "is-archived",
                )}
              >
                <DirectionThumbnail colors={direction.thumbnailColors} />
                <div className="cw-v2-direction-body">
                  <div className="cw-v2-direction-head">
                    <h3>{direction.title}</h3>
                    {direction.selected ? (
                      <span className="cw-v2-direction-badge is-winner">Winner</span>
                    ) : direction.archived ? (
                      <span className="cw-v2-direction-badge is-archived">
                        <Archive className="size-3" /> Archived
                      </span>
                    ) : null}
                  </div>
                  <p className="cw-v2-direction-story">{direction.designStory}</p>
                  <p className="cw-v2-direction-fashion">{direction.fashionLanguage}</p>
                  <div className="cw-v2-direction-scores">
                    <ScoreBar label="Commercial" value={direction.scores.commercial} />
                    <ScoreBar label="Originality" value={direction.scores.originality} />
                    <ScoreBar label="Print Complexity" value={direction.scores.printComplexity} />
                    <ScoreBar label="Conversion" value={direction.scores.conversionPotential} />
                  </div>
                  {!direction.selected ? (
                    <button
                      type="button"
                      className="cw-btn cw-btn-secondary cw-v2-direction-select"
                      onClick={() => onSelect(direction.id)}
                    >
                      Select Direction
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
