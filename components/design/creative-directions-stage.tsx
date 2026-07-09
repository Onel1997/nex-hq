"use client";

import type { DesignDirection, DesignDirectionScores } from "@/lib/design/design-directions";
import {
  PRESENTATION_MIN_THINKING_MS,
  TeamPresentationThinking,
} from "@/components/design/directions-thinking";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface CreativeDirectionsStageProps {
  directions?: DesignDirection[];
  loading?: boolean;
  hasConcept: boolean;
  compareMode: boolean;
  activeDirectionId?: string | null;
  onActiveDirectionChange?: (directionId: string) => void;
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

const CAROUSEL_SLIDE_PX = 32;
const CAROUSEL_TRANSITION = {
  duration: 0.26,
  ease: [0.22, 1, 0.36, 1] as const,
};

const STORY_COLLAPSE_CHARS = 200;

const PREVIEW_PARTICLES = [
  { left: "12%", top: "18%", delay: "0s", size: 2 },
  { left: "78%", top: "24%", delay: "1.2s", size: 1.5 },
  { left: "45%", top: "62%", delay: "0.6s", size: 2.5 },
  { left: "88%", top: "71%", delay: "2.1s", size: 1.5 },
  { left: "22%", top: "82%", delay: "1.8s", size: 2 },
  { left: "62%", top: "14%", delay: "0.9s", size: 1.5 },
  { left: "34%", top: "38%", delay: "2.4s", size: 2 },
  { left: "91%", top: "44%", delay: "1.5s", size: 1.5 },
] as const;

function DirectionPreviewHero({ title }: { title: string }) {
  return (
    <div className="cs-pitch-hero" aria-label={`${title} artwork preview`}>
      <div className="cs-pitch-hero-frame">
        <div className="cs-pitch-hero-texture" aria-hidden />
        <div className="cs-pitch-hero-checker" aria-hidden />
        <div className="cs-pitch-hero-particles" aria-hidden>
          {PREVIEW_PARTICLES.map((particle, index) => (
            <span
              key={index}
              className="cs-pitch-hero-particle"
              style={{
                left: particle.left,
                top: particle.top,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDelay: particle.delay,
              }}
            />
          ))}
        </div>
        <div className="cs-pitch-hero-mount" aria-hidden />
        <div className="cs-pitch-hero-glow" aria-hidden />
        <div className="cs-pitch-hero-empty">
          <span className="cs-pitch-hero-empty-kicker">Collection Concept</span>
          <span className="cs-pitch-hero-empty-label">Awaiting Artwork</span>
        </div>
      </div>
    </div>
  );
}

function PitchStory({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > STORY_COLLAPSE_CHARS;

  return (
    <section className="cs-pitch-story">
      <div className={cn("cs-pitch-story-body", !expanded && isLong && "is-clamped")}>
        <p>{text}</p>
        {!expanded && isLong ? <div className="cs-pitch-story-fade" aria-hidden /> : null}
        {isLong && !expanded ? (
          <button
            type="button"
            className="cs-pitch-story-more cs-pitch-story-more--inline"
            onClick={() => setExpanded(true)}
          >
            Read more
          </button>
        ) : null}
      </div>
      {isLong && expanded ? (
        <button
          type="button"
          className="cs-pitch-story-more"
          onClick={() => setExpanded(false)}
        >
          Show less
        </button>
      ) : null}
    </section>
  );
}

function buildFashionChips(direction: DesignDirection): string[] {
  const sources = [
    direction.mood,
    direction.typography,
    direction.composition,
    direction.colorSystem,
    direction.printStyle,
    direction.fashionLanguage,
    direction.trendAlignment,
  ];

  const chips: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    if (!source) continue;
    const parts = source
      .split(/[,·—/|]+|\s+&\s+|\s+with\s+/i)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of parts) {
      const words = part.split(/\s+/);
      const chip =
        words.length <= 3
          ? part
          : words
              .filter((word) => word.length > 2)
              .slice(0, 2)
              .join(" ");

      const normalized = chip.replace(/\s+/g, " ").trim();
      const key = normalized.toLowerCase();
      if (normalized.length >= 3 && normalized.length <= 28 && !seen.has(key)) {
        seen.add(key);
        chips.push(normalized);
      }
    }
  }

  return chips.slice(0, 10);
}

function productionReadiness(scores: DesignDirectionScores): number {
  return Math.max(0, Math.min(100, 100 - scores.printComplexity));
}

const SCORE_RING_RADIUS = 16;
const SCORE_RING_CIRCUMFERENCE = 2 * Math.PI * SCORE_RING_RADIUS;

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
  const clamped = Math.max(0, Math.min(100, value));
  const offset = SCORE_RING_CIRCUMFERENCE - (clamped / 100) * SCORE_RING_CIRCUMFERENCE;

  return (
    <div
      className={cn("cs-pitch-score", accent && `is-${accent}`)}
      title={`${label}: ${clamped}`}
      aria-label={`${label} ${clamped} out of 100`}
    >
      <div className="cs-pitch-score-ring" aria-hidden>
        <svg viewBox="0 0 40 40" className="cs-pitch-score-ring-svg">
          <circle className="cs-pitch-score-ring-track" cx="20" cy="20" r={SCORE_RING_RADIUS} />
          <circle
            className="cs-pitch-score-ring-fill"
            cx="20"
            cy="20"
            r={SCORE_RING_RADIUS}
            strokeDasharray={SCORE_RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <Icon className="size-2.5 cs-pitch-score-icon" />
        <span className="cs-pitch-score-value">{clamped}</span>
      </div>
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
  variant = "grid",
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
  variant?: "focus" | "grid";
  onSelect: (id: string) => void;
  onRegenerate: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleCompare: (id: string) => void;
  regenerating?: boolean;
}) {
  const isSelecting = selectingId === direction.id;
  const isWinner = direction.selected || isSelecting;
  const isFaded = variant === "grid" && hasWinner && !isWinner;
  const fashionChips = buildFashionChips(direction);
  const story = direction.designStory || direction.philosophy;

  return (
    <article
      id={`pitch-card-${direction.id}`}
      className={cn(
        "cs-dir-presentation-card cs-pitch-card",
        variant === "focus" && "cs-pitch-card--focus",
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
      <DirectionPreviewHero title={direction.title} />

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
            label="Brand"
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

        <PitchStory text={story} />

        <div className="cs-pitch-tags" aria-label="Fashion language">
          {fashionChips.map((chip) => (
            <span key={chip} className="cs-pitch-tag-chip">
              {chip}
            </span>
          ))}
        </div>

        <div className="cs-pitch-actions">
          {isWinner ? (
            <button
              type="button"
              className="cs-btn cs-pitch-select-btn is-selected"
              disabled
              aria-label="Selected direction"
            >
              <Check className="size-3.5" />
              Selected Direction
            </button>
          ) : !selectingId ? (
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

function PitchCarousel({
  directions,
  focusIndex,
  onFocusChange,
  compareMode,
  selectingId,
  hasWinner,
  onSelect,
  onRegenerate,
  onDuplicate,
  onToggleCompare,
  regenerating,
}: {
  directions: DesignDirection[];
  focusIndex: number;
  onFocusChange: (index: number) => void;
  compareMode: boolean;
  selectingId: string | null;
  hasWinner: boolean;
  onSelect: (id: string) => void;
  onRegenerate: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleCompare: (id: string) => void;
  regenerating?: boolean;
}) {
  const direction = directions[focusIndex];
  const slideDirRef = useRef<1 | -1>(1);
  const prevFocusRef = useRef(focusIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (focusIndex === prevFocusRef.current) return;
    slideDirRef.current = focusIndex > prevFocusRef.current ? 1 : -1;
    prevFocusRef.current = focusIndex;
    setIsTransitioning(false);
  }, [focusIndex]);

  useEffect(() => {
    if (!isTransitioning) return;
    const timer = window.setTimeout(() => setIsTransitioning(false), 400);
    return () => window.clearTimeout(timer);
  }, [isTransitioning, focusIndex]);

  const navigate = useCallback(
    (index: number) => {
      if (!directions.length || index === focusIndex || isTransitioning) return;
      slideDirRef.current = index > focusIndex ? 1 : -1;
      setIsTransitioning(true);
      onFocusChange(index);
    },
    [directions.length, focusIndex, isTransitioning, onFocusChange],
  );

  const goNext = useCallback(() => {
    if (!directions.length) return;
    const nextIndex = (focusIndex + 1) % directions.length;
    navigate(nextIndex);
  }, [directions.length, focusIndex, navigate]);

  const goPrev = useCallback(() => {
    if (!directions.length) return;
    const prevIndex = (focusIndex - 1 + directions.length) % directions.length;
    navigate(prevIndex);
  }, [directions.length, focusIndex, navigate]);

  if (!direction) return null;

  const slideDir = slideDirRef.current;

  return (
    <div className="cs-pitch-carousel">
      <div className="cs-pitch-carousel-rail">
        <button
          type="button"
          className="cs-pitch-carousel-nav"
          onClick={goPrev}
          disabled={isTransitioning || directions.length <= 1}
          aria-label="Previous direction"
        >
          <ChevronLeft className="size-5" />
        </button>

        <div className="cs-pitch-carousel-stage">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={direction.id}
              className="cs-pitch-carousel-slide"
              layout={false}
              initial={{ opacity: 0, x: slideDir * CAROUSEL_SLIDE_PX }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: slideDir * -CAROUSEL_SLIDE_PX }}
              transition={CAROUSEL_TRANSITION}
              onAnimationComplete={(definition) => {
                if (definition === "animate") setIsTransitioning(false);
              }}
            >
              <DirectionPresentationCard
                direction={direction}
                variant="focus"
                compareMode={compareMode}
                selectingId={selectingId}
                hasWinner={hasWinner}
                onSelect={onSelect}
                onRegenerate={onRegenerate}
                onDuplicate={onDuplicate}
                onToggleCompare={onToggleCompare}
                regenerating={regenerating}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          type="button"
          className="cs-pitch-carousel-nav"
          onClick={goNext}
          disabled={isTransitioning || directions.length <= 1}
          aria-label="Next direction"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="cs-pitch-carousel-footer">
        <span className="cs-pitch-carousel-count">
          Direction {focusIndex + 1} of {directions.length}
        </span>
        <div className="cs-pitch-carousel-dots" role="tablist" aria-label="Direction navigation">
          {directions.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === focusIndex}
              aria-label={`View ${item.title}`}
              className={cn("cs-pitch-carousel-dot", index === focusIndex && "is-active")}
              disabled={isTransitioning}
              onClick={() => navigate(index)}
            />
          ))}
        </div>
      </div>
    </div>
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
  activeDirectionId,
  onActiveDirectionChange,
  onGenerate,
  onSelect,
  onRegenerate,
  onDuplicate,
  onToggleCompare,
  onOpenCompare: _onOpenCompare,
  onToggleCompareMode,
}: CreativeDirectionsStageProps) {
  const hasDirections = Boolean(directions?.length);
  const activeDirections = useMemo(
    () => directions?.filter((direction) => !direction.archived) ?? [],
    [directions],
  );
  const selected = directions?.find((d) => d.selected);

  const [phase, setPhase] = useState<PresentationPhase>(() =>
    hasDirections ? "gallery" : "intro",
  );
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [revealedCount, setRevealedCount] = useState(() =>
    hasDirections ? activeDirections.length : 0,
  );
  const [pitchReadyBanner, setPitchReadyBanner] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const thinkingStartRef = useRef<number | null>(null);
  const revealStartedRef = useRef(false);
  const galleryScrollRef = useRef<HTMLDivElement>(null);
  const reportedDirectionIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!selected) return;
    const selectedIndex = activeDirections.findIndex((d) => d.id === selected.id);
    if (selectedIndex < 0) return;
    setFocusIndex(selectedIndex);
    reportedDirectionIdRef.current = selected.id;
    onActiveDirectionChange?.(selected.id);
  }, [selected, activeDirections, onActiveDirectionChange]);

  useEffect(() => {
    if (focusIndex >= activeDirections.length) {
      setFocusIndex(Math.max(0, activeDirections.length - 1));
    }
  }, [activeDirections.length, focusIndex]);

  const handleFocusChange = useCallback((index: number) => {
    const target = activeDirections[index];
    if (!target) return;

    const scrollTop = galleryScrollRef.current?.scrollTop ?? 0;
    setFocusIndex(index);
    reportedDirectionIdRef.current = target.id;
    onActiveDirectionChange?.(target.id);
    requestAnimationFrame(() => {
      if (galleryScrollRef.current) {
        galleryScrollRef.current.scrollTop = scrollTop;
      }
    });
  }, [activeDirections, onActiveDirectionChange]);

  useEffect(() => {
    if (!activeDirectionId) return;
    const index = activeDirections.findIndex((d) => d.id === activeDirectionId);
    if (index < 0) return;

    setFocusIndex((current) => {
      if (current === index) return current;
      const target = activeDirections[index];
      reportedDirectionIdRef.current = target?.id ?? null;
      return index;
    });
  }, [activeDirectionId, activeDirections]);

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
          <div className="cs-directions-stage-actions cs-pitch-stage-toolbar">
            {phase === "gallery" && !selectingId ? (
              <button
                type="button"
                className={cn("cs-pitch-toolbar-btn", compareMode && "is-active")}
                onClick={onToggleCompareMode}
                aria-pressed={compareMode}
              >
                <GitCompare className="size-3.5" />
                <span>{compareMode ? "Exit Compare" : "Compare"}</span>
              </button>
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
            {phase === "gallery" && !compareMode ? (
              <PitchCarousel
                directions={activeDirections}
                focusIndex={focusIndex}
                onFocusChange={handleFocusChange}
                compareMode={false}
                selectingId={selectingId}
                hasWinner={hasWinner}
                onSelect={handleSelect}
                onRegenerate={onRegenerate}
                onDuplicate={onDuplicate}
                onToggleCompare={onToggleCompare}
                regenerating={loading}
              />
            ) : (
              <div
                className={cn(
                  "cs-dir-grid cs-dir-grid--presentation cs-pitch-gallery",
                  compareMode && phase === "gallery" && "cs-pitch-gallery--compare",
                  phase === "reveal" && !compareMode && "cs-pitch-gallery--focus",
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
                      variant={phase === "reveal" && !compareMode ? "focus" : "grid"}
                      onSelect={handleSelect}
                      onRegenerate={onRegenerate}
                      onDuplicate={onDuplicate}
                      onToggleCompare={onToggleCompare}
                      regenerating={loading}
                    />
                  );
                })}
              </div>
            )}

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
