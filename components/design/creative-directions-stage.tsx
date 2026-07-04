"use client";

import type { DesignDirection, DesignDirectionScores } from "@/lib/design/design-directions";
import {
  PRESENTATION_MIN_THINKING_MS,
  TeamPresentationThinking,
} from "@/components/design/directions-thinking";
import { cn } from "@/lib/utils";
import {
  Archive,
  Check,
  Copy,
  Factory,
  GitCompare,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

type PresentationPhase =
  | "intro"
  | "dim"
  | "thinking"
  | "presenting"
  | "reveal"
  | "gallery";

const ESTIMATED_ITEMS = [
  "3–5 creative directions",
  "Commercial review",
  "Brand positioning",
  "Print readiness",
  "Audience alignment",
] as const;

const REVEAL_STAGGER_MS = 720;

function truncateStory(text: string, maxSentences = 2): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return sentences.slice(0, maxSentences).join(" ");
}

function productionReadiness(scores: DesignDirectionScores): number {
  return Math.max(0, Math.min(100, 100 - scores.printComplexity));
}

function buildFashionTags(direction: DesignDirection) {
  return [
    { label: "Typography", value: direction.typography },
    { label: "Composition", value: direction.composition },
    { label: "Mood", value: direction.mood },
    { label: "Color", value: direction.colorSystem },
    { label: "Print", value: direction.printStyle },
    { label: "Silhouette", value: direction.fashionLanguage },
    { label: "Editorial", value: direction.trendAlignment },
  ];
}

function DirectionPreviewHero({
  colors,
  title,
}: {
  colors: string[];
  title: string;
}) {
  return (
    <div className="cs-pitch-hero" aria-hidden>
      <div className="cs-pitch-hero-canvas">
        <div className="cs-dir-preview-gradient">
          {colors.map((color, index) => (
            <span
              key={`${color}-${index}`}
              className="cs-dir-preview-swatch"
              style={{ background: color, flex: index === 0 ? 2.4 : 1 }}
            />
          ))}
        </div>
        <div className="cs-pitch-hero-vignette" />
        <div className="cs-pitch-hero-shine" />
        <div className="cs-pitch-hero-type">{title.slice(0, 1)}</div>
      </div>
    </div>
  );
}

function PitchScore({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: number;
  accent?: "commercial" | "brand" | "original" | "production" | "conversion";
}) {
  return (
    <div className={cn("cs-pitch-score", accent && `is-${accent}`)}>
      <Icon className="size-3 cs-pitch-score-icon" aria-hidden />
      <span className="cs-pitch-score-value">{value}</span>
      <span className="cs-pitch-score-label">{label}</span>
    </div>
  );
}

function DirectionPresentationCard({
  direction,
  compareMode,
  selectingId,
  hasWinner,
  isEntering,
  revealIndex,
  onSelect,
  onRegenerate,
  onDuplicate,
  onToggleCompare,
  regenerating,
}: {
  direction: DesignDirection;
  compareMode: boolean;
  selectingId: string | null;
  hasWinner: boolean;
  isEntering?: boolean;
  revealIndex?: number;
  onSelect: (id: string) => void;
  onRegenerate: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleCompare: (id: string) => void;
  regenerating?: boolean;
}) {
  const isSelecting = selectingId === direction.id;
  const isWinner = direction.selected || isSelecting;
  const isFaded = hasWinner && !isWinner;
  const fashionTags = buildFashionTags(direction);
  const story = truncateStory(direction.designStory || direction.philosophy);

  return (
    <article
      id={`pitch-card-${direction.id}`}
      className={cn(
        "cs-dir-presentation-card cs-pitch-card",
        isWinner && "is-winner",
        isSelecting && "is-expanding",
        isFaded && "is-faded",
        isEntering && "is-entering",
        direction.compareSelected && "is-compare",
        direction.archived && !direction.selected && "is-archived",
      )}
      style={
        isEntering && revealIndex != null
          ? { animationDelay: `${revealIndex * 80}ms` }
          : undefined
      }
    >
      <DirectionPreviewHero colors={direction.thumbnailColors} title={direction.title} />

      <div className="cs-pitch-card-body">
        <header className="cs-pitch-card-head">
          <h3>{direction.title}</h3>
          {isWinner ? (
            <span className="cs-pitch-selected-badge">
              <Check className="size-3" />
              Selected
            </span>
          ) : direction.compareSelected ? (
            <span className="cs-dir-compare-mark">Compare</span>
          ) : null}
        </header>

        <div className="cs-pitch-scores" aria-label="Direction scores">
          <PitchScore
            icon={TrendingUp}
            label="Commercial"
            value={direction.scores.commercial}
            accent="commercial"
          />
          <PitchScore
            icon={Target}
            label="Brand Fit"
            value={direction.scores.brandFit}
            accent="brand"
          />
          <PitchScore
            icon={Sparkles}
            label="Originality"
            value={direction.scores.originality}
            accent="original"
          />
          <PitchScore
            icon={Factory}
            label="Production"
            value={productionReadiness(direction.scores)}
            accent="production"
          />
          <PitchScore
            icon={Zap}
            label="Conversion"
            value={direction.scores.conversionPotential}
            accent="conversion"
          />
        </div>

        <section className="cs-pitch-story">
          <h4>Design Story</h4>
          <p title={direction.designStory || direction.philosophy}>{story}</p>
        </section>

        <details className="cs-pitch-tags-fold">
          <summary>Fashion Language</summary>
          <div className="cs-pitch-tags">
            {fashionTags.map(({ label, value }) => (
              <span key={label} className="cs-pitch-tag-chip" title={`${label}: ${value}`}>
                {label}
              </span>
            ))}
          </div>
        </details>

        <div className="cs-pitch-actions">
          {!isWinner && !selectingId ? (
            <button
              type="button"
              className="cs-btn cs-btn-primary cs-pitch-select-btn"
              onClick={() => onSelect(direction.id)}
            >
              <Trophy className="size-3.5" />
              Select Direction
            </button>
          ) : null}
          <div className="cs-pitch-secondary-actions">
            <button
              type="button"
              className="cs-btn cs-btn-compact cs-btn-ghost"
              onClick={() => onRegenerate(direction.id)}
              disabled={regenerating}
              title="Regenerate"
            >
              <RefreshCw className="size-3.5" />
            </button>
            <button
              type="button"
              className="cs-btn cs-btn-compact cs-btn-ghost"
              onClick={() => onDuplicate(direction.id)}
              title="Duplicate"
            >
              <Copy className="size-3.5" />
            </button>
            {compareMode ? (
              <button
                type="button"
                className={cn(
                  "cs-btn cs-btn-compact cs-btn-ghost",
                  direction.compareSelected && "cs-btn-accent",
                )}
                onClick={() => onToggleCompare(direction.id)}
                title="Compare"
              >
                <GitCompare className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function PresentationIntro({ onPresent, disabled }: { onPresent: () => void; disabled?: boolean }) {
  return (
    <div className="cs-presentation-room">
      <div className="cs-presentation-room-vignette" aria-hidden />
      <div className="cs-presentation-room-spotlight" aria-hidden />
      <div className="cs-presentation-panel">
        <p className="cs-presentation-panel-kicker">Creative Pitch Meeting</p>
        <h2 className="cs-presentation-panel-title">Design Directions</h2>
        <p className="cs-presentation-panel-lead">
          Your AI Creative Team is ready to present 3–5 unique creative directions based on your
          research, brand DNA, target audience and commercial opportunities.
        </p>
        <div className="cs-presentation-estimate">
          <p className="cs-presentation-estimate-label">Today&apos;s pitch includes</p>
          <ul>
            {ESTIMATED_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className="cs-btn cs-presentation-cta"
          disabled={disabled}
          onClick={onPresent}
        >
          <Sparkles className="size-4" />
          Present Design Directions
        </button>
      </div>
    </div>
  );
}

function PresentationTheater({
  phase,
  revealedCount,
  totalCount,
}: {
  phase: PresentationPhase;
  revealedCount: number;
  totalCount: number;
}) {
  const isCinematic = phase === "dim" || phase === "thinking" || phase === "presenting";
  const isReveal = phase === "reveal";

  return (
    <div
      className={cn(
        "cs-presentation-theater",
        phase === "dim" && "is-dim",
        isCinematic && "is-active",
      )}
    >
      <div className="cs-presentation-theater-dim" aria-hidden />
      <div className="cs-presentation-theater-spotlight" aria-hidden />

      {phase === "thinking" ? (
        <div className="cs-presentation-theater-content cs-presentation-theater-content--thinking">
          <TeamPresentationThinking active />
        </div>
      ) : null}

      {phase === "presenting" ? (
        <div className="cs-presentation-theater-content cs-presentation-theater-content--presenting">
          <p className="cs-presentation-presenting-kicker">AI Creative Team</p>
          <p className="cs-presentation-presenting-label">
            Finishing today&apos;s creative pitch…
          </p>
        </div>
      ) : null}

      {isReveal && revealedCount < totalCount ? (
        <div className="cs-presentation-reveal-indicator" aria-live="polite">
          <span className="cs-presentation-reveal-label">
            Revealing direction {revealedCount + 1}
          </span>
          <span className="cs-presentation-reveal-arrow" aria-hidden>
            ↓
          </span>
        </div>
      ) : null}
    </div>
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

  const [phase, setPhase] = useState<PresentationPhase>(() =>
    hasDirections ? "gallery" : "intro",
  );
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [revealedCount, setRevealedCount] = useState(() =>
    hasDirections ? activeDirections.length : 0,
  );
  const [pitchReadyBanner, setPitchReadyBanner] = useState(false);
  const thinkingStartRef = useRef<number | null>(null);
  const revealStartedRef = useRef(false);
  const galleryScrollRef = useRef<HTMLDivElement>(null);

  const hasWinner = Boolean(selected || selectingId);
  const isCinematic =
    phase === "dim" || phase === "thinking" || phase === "presenting" || phase === "reveal";
  const showGallery = phase === "gallery" || (phase === "reveal" && revealedCount > 0);
  const showHeader = phase === "gallery" || (phase === "reveal" && revealedCount > 0);

  const handlePresent = useCallback(() => {
    thinkingStartRef.current = Date.now();
    revealStartedRef.current = false;
    setPitchReadyBanner(false);
    setRevealedCount(0);
    setPhase("dim");
    onGenerate();

    window.setTimeout(() => setPhase("thinking"), 650);
  }, [onGenerate]);

  useEffect(() => {
    if (phase !== "thinking") return;
    if (!hasDirections || loading) return;

    const start = thinkingStartRef.current ?? Date.now();
    const elapsed = Date.now() - start;
    const wait = Math.max(0, PRESENTATION_MIN_THINKING_MS - elapsed);

    const timer = window.setTimeout(() => {
      setPhase("presenting");
      window.setTimeout(() => {
        if (!revealStartedRef.current) {
          revealStartedRef.current = true;
          setPhase("reveal");
          setRevealedCount(0);
        }
      }, 1100);
    }, wait);

    return () => window.clearTimeout(timer);
  }, [phase, hasDirections, loading]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const total = activeDirections.length;
    if (total === 0) return;

    if (revealedCount >= total) {
      const timer = window.setTimeout(() => {
        setPhase("gallery");
        setPitchReadyBanner(true);
        window.setTimeout(() => setPitchReadyBanner(false), 4800);
      }, 500);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setRevealedCount((count) => count + 1);
    }, REVEAL_STAGGER_MS);

    return () => window.clearTimeout(timer);
  }, [phase, revealedCount, activeDirections.length]);

  const handleSelect = useCallback(
    (directionId: string) => {
      if (selectingId || phase !== "gallery") return;
      setSelectingId(directionId);
      window.setTimeout(() => {
        onSelect(directionId);
        setSelectingId(null);
      }, 1600);
    },
    [onSelect, selectingId, phase],
  );

  if (!hasConcept) {
    return (
      <main className="cs-directions-stage cs-directions-presentation" aria-label="Design direction review">
        <div className="cs-directions-center-scroll cs-nexhq-scroll">
          <div className="cs-directions-intro">
          <Sparkles className="size-8 text-[#52c2c2]/50" />
          <h3>Creative Brief Required</h3>
          <p>Generate an AI Design Concept to begin the design direction review.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={cn(
        "cs-directions-stage cs-directions-presentation",
        isCinematic && "is-cinematic",
        selectingId && "is-selecting",
        hasWinner && "has-winner",
        phase === "gallery" && "is-gallery",
      )}
      aria-label="Design direction review"
    >
      {showHeader ? (
        <div className="cs-directions-stage-top">
          <header className="cs-directions-stage-head cs-pitch-stage-head">
          <div>
            <p className="cs-dir-stage-kicker">Creative Pitch · {activeDirections.length} Directions</p>
            <h2>Design Directions</h2>
            <p className="cs-pitch-stage-sub">
              {pitchReadyBanner
                ? "The AI Creative Team has finished preparing today's creative pitch."
                : "Review each direction and select the concept to develop into Master Artwork."}
            </p>
          </div>
          <div className="cs-directions-stage-actions">
            {phase === "gallery" && !selectingId ? (
              <>
                <button
                  type="button"
                  className={cn("cs-btn cs-btn-compact", compareMode && "cs-btn-accent")}
                  onClick={onToggleCompareMode}
                >
                  <GitCompare className="size-3.5" />
                  {compareMode ? "Exit Compare" : "Compare"}
                </button>
                {compareMode && compareCount >= 2 ? (
                  <button
                    type="button"
                    className="cs-btn cs-btn-primary cs-btn-compact"
                    onClick={onOpenCompare}
                  >
                    View Comparison ({compareCount})
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
          </header>

          {phase === "gallery" ? (
            selectingId ? (
              <div className="cs-dir-winner-banner cs-dir-winner-banner--animating">
                <Check className="size-4" />
                <span>
                  Selected Creative Direction —{" "}
                  <strong>{activeDirections.find((d) => d.id === selectingId)?.title}</strong>
                </span>
              </div>
            ) : selected ? (
              <div className="cs-dir-winner-banner">
                <Trophy className="size-4" />
                <span>
                  Winning Direction — <strong>{selected.title}</strong>
                </span>
              </div>
            ) : compareMode ? (
              <div className="cs-dir-winner-banner cs-dir-winner-banner--compare">
                <GitCompare className="size-4" />
                Select 2 or more directions to compare side-by-side.
              </div>
            ) : null
          ) : null}
        </div>
      ) : null}

      <div ref={galleryScrollRef} className="cs-directions-center-scroll cs-nexhq-scroll">
        {phase === "intro" ? (
          <PresentationIntro onPresent={handlePresent} disabled={loading} />
        ) : null}

        {isCinematic ? (
          <PresentationTheater
            phase={phase}
            revealedCount={revealedCount}
            totalCount={activeDirections.length}
          />
        ) : null}

        {showGallery || phase === "reveal" ? (
          <>
            <div
              className={cn(
                "cs-dir-grid cs-dir-grid--presentation cs-pitch-gallery",
                phase === "reveal" && "is-revealing",
              )}
            >
              {activeDirections.map((direction, index) => {
                const isVisible =
                  phase === "gallery" || (phase === "reveal" && index < revealedCount);
                if (!isVisible) return null;

                return (
                  <DirectionPresentationCard
                    key={direction.id}
                    direction={direction}
                    compareMode={compareMode && phase === "gallery"}
                    selectingId={selectingId}
                    hasWinner={hasWinner}
                    isEntering={phase === "reveal" && index === revealedCount - 1}
                    revealIndex={index}
                    onSelect={handleSelect}
                    onRegenerate={onRegenerate}
                    onDuplicate={onDuplicate}
                    onToggleCompare={onToggleCompare}
                    regenerating={loading}
                  />
                );
              })}
            </div>

            {phase === "gallery" &&
            (directions?.filter((d) => d.archived).length ?? 0) > 0 ? (
              <details className="cs-dir-archived">
                <summary>
                  <Archive className="size-3.5" />
                  Archived directions ({directions!.filter((d) => d.archived).length})
                </summary>
                <div className="cs-dir-grid cs-dir-grid--presentation cs-pitch-gallery cs-dir-grid--archived">
                  {directions!
                    .filter((d) => d.archived)
                    .map((direction) => (
                      <DirectionPresentationCard
                        key={direction.id}
                        direction={direction}
                        compareMode={false}
                        selectingId={null}
                        hasWinner={false}
                        onSelect={handleSelect}
                        onRegenerate={onRegenerate}
                        onDuplicate={onDuplicate}
                        onToggleCompare={onToggleCompare}
                      />
                    ))}
                </div>
              </details>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
