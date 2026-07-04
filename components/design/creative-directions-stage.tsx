"use client";

import type { DesignDirection } from "@/lib/design/design-directions";
import { cn } from "@/lib/utils";
import {
  Archive,
  Check,
  Copy,
  GitCompare,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

interface CreativeDirectionsStageProps {
  directions?: DesignDirection[];
  loading?: boolean;
  hasConcept: boolean;
  compareMode: boolean;
  onGenerate: () => void;
  onSelect: (directionId: string) => void;
  onRegenerate: (directionId: string) => void;
  onDuplicate: (directionId: string) => void;
  onToggleCompare: (directionId: string) => void;
  onOpenCompare: () => void;
  onToggleCompareMode: () => void;
}

function DirectionPreviewLarge({ colors, title }: { colors: string[]; title: string }) {
  return (
    <div className="cs-dir-preview-large" aria-hidden>
      <div className="cs-dir-preview-gradient">
        {colors.map((color, index) => (
          <span
            key={`${color}-${index}`}
            className="cs-dir-preview-swatch"
            style={{ background: color, flex: index === 0 ? 2 : 1 }}
          />
        ))}
      </div>
      <div className="cs-dir-preview-label">{title}</div>
    </div>
  );
}

function ScoreMeter({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="cs-dir-meter">
      <span className="cs-dir-meter-label">{label}</span>
      <div className="cs-dir-meter-track">
        <span
          className="cs-dir-meter-fill"
          style={{ width: `${value}%`, background: accent }}
        />
      </div>
      <span className="cs-dir-meter-value">{value}%</span>
    </div>
  );
}

function TeamInsightsList({ insights }: { insights: DesignDirection["teamInsights"] }) {
  return (
    <div className="cs-dir-team">
      <header className="cs-dir-team-head">
        <Users className="size-3.5" />
        <span>AI Fashion Team</span>
      </header>
      <ul className="cs-dir-team-list">
        {insights.map((item) => (
          <li key={item.role} className="cs-dir-team-item">
            <div className="cs-dir-team-role">
              <strong>{item.role}</strong>
              <span>{item.focus}</span>
            </div>
            <p>{item.insight}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DirectionCard({
  direction,
  compareMode,
  onSelect,
  onRegenerate,
  onDuplicate,
  onToggleCompare,
  regenerating,
}: {
  direction: DesignDirection;
  compareMode: boolean;
  onSelect: (id: string) => void;
  onRegenerate: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleCompare: (id: string) => void;
  regenerating?: boolean;
}) {
  return (
    <article
      className={cn(
        "cs-dir-card",
        direction.selected && "is-selected",
        direction.compareSelected && "is-compare",
        direction.archived && !direction.selected && "is-archived",
      )}
    >
      <DirectionPreviewLarge colors={direction.thumbnailColors} title={direction.title} />

      <div className="cs-dir-card-body">
        <header className="cs-dir-card-head">
          <div>
            <p className="cs-dir-card-kicker">Creative Direction</p>
            <h3>{direction.title}</h3>
          </div>
          {direction.selected ? (
            <span className="cs-badge cs-badge-winner">
              <Trophy className="size-3" /> Winner
            </span>
          ) : direction.compareSelected ? (
            <span className="cs-badge cs-badge-compare">
              <Check className="size-3" /> Compare
            </span>
          ) : null}
        </header>

        <p className="cs-dir-philosophy">{direction.philosophy}</p>
        <p className="cs-dir-story">{direction.designStory}</p>

        <div className="cs-dir-meta-grid">
          <div>
            <span>Target Audience</span>
            <p>{direction.targetAudience}</p>
          </div>
          <div>
            <span>Trend Alignment</span>
            <p>{direction.trendAlignment}</p>
          </div>
          <div>
            <span>Color System</span>
            <p>{direction.colorSystem}</p>
          </div>
          <div>
            <span>Composition</span>
            <p>{direction.composition}</p>
          </div>
        </div>

        <div className="cs-dir-scores-grid">
          <ScoreMeter label="Luxury" value={direction.scores.luxury} accent="rgb(217 180 107)" />
          <ScoreMeter label="Commercial" value={direction.scores.commercial} accent="rgb(110 231 183)" />
          <ScoreMeter label="Originality" value={direction.scores.originality} accent="rgb(147 197 253)" />
          <ScoreMeter label="Print Complexity" value={direction.scores.printComplexity} accent="rgb(251 191 36)" />
          <ScoreMeter label="Conversion" value={direction.scores.conversionPotential} accent="rgb(167 139 250)" />
          <ScoreMeter
            label="Manufacturing"
            value={direction.scores.manufacturingDifficulty}
            accent="rgb(248 113 113)"
          />
        </div>

        <TeamInsightsList insights={direction.teamInsights} />

        <div className="cs-dir-actions">
          {!direction.selected ? (
            <button
              type="button"
              className="cs-btn cs-btn-primary"
              onClick={() => onSelect(direction.id)}
            >
              <Trophy className="size-3.5" />
              Select
            </button>
          ) : null}
          <button
            type="button"
            className="cs-btn"
            onClick={() => onRegenerate(direction.id)}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Regenerate
          </button>
          <button type="button" className="cs-btn" onClick={() => onDuplicate(direction.id)}>
            <Copy className="size-3.5" />
            Duplicate
          </button>
          {compareMode ? (
            <button
              type="button"
              className={cn("cs-btn", direction.compareSelected && "cs-btn-accent")}
              onClick={() => onToggleCompare(direction.id)}
            >
              <GitCompare className="size-3.5" />
              {direction.compareSelected ? "Selected" : "Compare"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function CreativeDirectionsStage({
  directions,
  loading,
  hasConcept,
  compareMode,
  onGenerate,
  onSelect,
  onRegenerate,
  onDuplicate,
  onToggleCompare,
  onOpenCompare,
  onToggleCompareMode,
}: CreativeDirectionsStageProps) {
  const hasDirections = Boolean(directions?.length);
  const activeDirections = directions?.filter((d) => !d.archived) ?? [];
  const compareCount = activeDirections.filter((d) => d.compareSelected).length;
  const selected = directions?.find((d) => d.selected);

  return (
    <main className="cs-directions-stage" aria-label="Creative directions">
      <header className="cs-directions-stage-head">
        <div>
          <p className="cs-dir-stage-kicker">AI Fashion Creative Team</p>
          <h2>Design Directions</h2>
          <p className="cs-dir-stage-sub">
            Five senior creative directors pitch distinct collection identities — compare, then select your winner.
          </p>
        </div>
        <div className="cs-directions-stage-actions">
          {hasDirections ? (
            <>
              <button
                type="button"
                className={cn("cs-btn", compareMode && "cs-btn-accent")}
                onClick={onToggleCompareMode}
              >
                <GitCompare className="size-3.5" />
                {compareMode ? "Exit Compare" : "Compare Mode"}
              </button>
              {compareMode && compareCount >= 2 ? (
                <button type="button" className="cs-btn cs-btn-primary" onClick={onOpenCompare}>
                  View Comparison ({compareCount})
                </button>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            className="cs-btn cs-btn-primary"
            disabled={!hasConcept || loading}
            onClick={onGenerate}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Generate Directions
          </button>
        </div>
      </header>

      {!hasConcept ? (
        <div className="cs-directions-empty">
          <Sparkles className="size-8 text-[#d9b46b]/60" />
          <p>Generate an AI Design Concept first — directions build on the creative briefing.</p>
        </div>
      ) : !hasDirections ? (
        <div className="cs-directions-empty">
          <Sparkles className="size-8 text-[#d9b46b]/60" />
          <p>Press Generate to explore luxury, editorial, graphic, heritage, and fashion art directions.</p>
        </div>
      ) : (
        <>
          {selected ? (
            <p className="cs-dir-selected-banner">
              <Trophy className="size-4" />
              Selected: <strong>{selected.title}</strong> — generating Master Artwork from this creative source.
            </p>
          ) : compareMode ? (
            <p className="cs-dir-selected-banner cs-dir-selected-banner--compare">
              <GitCompare className="size-4" />
              Select 2 or more directions to compare side-by-side.
            </p>
          ) : null}
          <div className="cs-dir-grid">
            {activeDirections.map((direction) => (
              <DirectionCard
                key={direction.id}
                direction={direction}
                compareMode={compareMode}
                onSelect={onSelect}
                onRegenerate={onRegenerate}
                onDuplicate={onDuplicate}
                onToggleCompare={onToggleCompare}
                regenerating={loading}
              />
            ))}
          </div>
          {(directions?.filter((d) => d.archived).length ?? 0) > 0 ? (
            <details className="cs-dir-archived">
              <summary>
                <Archive className="size-3.5" />
                Archived directions ({directions!.filter((d) => d.archived).length})
              </summary>
              <div className="cs-dir-grid cs-dir-grid--archived">
                {directions!
                  .filter((d) => d.archived)
                  .map((direction) => (
                    <DirectionCard
                      key={direction.id}
                      direction={direction}
                      compareMode={false}
                      onSelect={onSelect}
                      onRegenerate={onRegenerate}
                      onDuplicate={onDuplicate}
                      onToggleCompare={onToggleCompare}
                    />
                  ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </main>
  );
}
