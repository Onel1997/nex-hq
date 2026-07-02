"use client";

import {
  FASHION_PRODUCTION_PIPELINE,
  type FashionProductionStepId,
  type MissionAssetStatus,
} from "@/lib/image/image-studio-assets";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface CanvasPlaceholderProps {
  hasBlueprint?: boolean;
  garmentLabel?: string;
  aspectHint?: "portrait" | "landscape" | "square";
}

/** Living canvas atmosphere — blueprint, silhouette, construction guides. No motion. */
export function CanvasPlaceholder({
  hasBlueprint = false,
  garmentLabel = "Garment",
  aspectHint = "portrait",
}: CanvasPlaceholderProps) {
  return (
    <div className="is-canvas-alive" aria-hidden>
      <div className="is-canvas-texture" />
      <div className="is-canvas-atmosphere" />
      <div className="is-canvas-vignette" />
      <div className="is-canvas-spotlight-luxury" />
      {hasBlueprint ? <div className="is-canvas-blueprint-wash" /> : null}

      <svg
        className="is-alive-svg"
        viewBox="0 0 960 640"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Construction grid */}
        <defs>
          <pattern id="is-blueprint-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="rgba(74,222,154,0.04)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        {hasBlueprint ? (
          <rect width="960" height="640" fill="url(#is-blueprint-grid)" opacity="0.6" />
        ) : null}

        {/* Rule of thirds */}
        <line x1="320" y1="0" x2="320" y2="640" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
        <line x1="640" y1="0" x2="640" y2="640" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
        <line x1="0" y1="213" x2="960" y2="213" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
        <line x1="0" y1="427" x2="960" y2="427" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />

        {/* Frame guides — where assets will land */}
        <rect x="120" y="72" width="200" height="250" rx="3" stroke="rgba(74,222,154,0.14)" strokeWidth="1" strokeDasharray="6 4" />
        <rect x="380" y="72" width="200" height="250" rx="3" stroke="rgba(74,222,154,0.1)" strokeWidth="1" strokeDasharray="6 4" />
        <rect x="250" y="360" width="460" height="180" rx="3" stroke="rgba(201,165,92,0.12)" strokeWidth="1" strokeDasharray="6 4" />

        {/* Corner marks */}
        {[
          [120, 72], [320, 72], [120, 322], [320, 322],
          [380, 72], [580, 72], [380, 322], [580, 322],
        ].map(([x, y], i) => (
          <g key={i}>
            <line x1={x} y1={y} x2={x + (x < 400 ? 12 : -12)} y2={y} stroke="rgba(242,239,232,0.08)" strokeWidth="1" />
            <line x1={x} y1={y} x2={x} y2={y + (y < 200 ? 12 : -12)} stroke="rgba(242,239,232,0.08)" strokeWidth="1" />
          </g>
        ))}

        {/* Garment silhouette */}
        <path
          d="M420 140 L375 178 L352 158 L328 188 L346 208 L362 196 C362 196 368 360 368 408 C368 432 386 448 480 448 C574 448 592 432 592 408 C592 360 598 196 598 196 L614 208 L632 188 L608 158 L585 178 L540 140 C528 128 432 128 420 140Z"
          stroke="rgba(242,239,232,0.1)"
          strokeWidth="1.25"
          fill="rgba(255,255,255,0.02)"
        />
        <path
          d="M420 140 L462 158 L480 148 L498 158 L540 140"
          stroke="rgba(242,239,232,0.06)"
          strokeWidth="0.75"
        />
        <ellipse cx="480" cy="268" rx="48" ry="62" stroke="rgba(74,222,154,0.05)" strokeWidth="0.75" strokeDasharray="3 5" />

        {/* Blueprint construction lines */}
        {hasBlueprint ? (
          <>
            <line x1="480" y1="140" x2="480" y2="448" stroke="rgba(74,222,154,0.06)" strokeWidth="0.75" />
            <line x1="380" y1="268" x2="580" y2="268" stroke="rgba(74,222,154,0.06)" strokeWidth="0.75" />
            <circle cx="480" cy="268" r="100" stroke="rgba(74,222,154,0.05)" strokeWidth="0.75" strokeDasharray="4 8" />
            <text x="480" y="500" textAnchor="middle" fill="rgba(74,222,154,0.25)" fontSize="11" fontFamily="monospace" letterSpacing="0.2em">
              BLUEPRINT STAGED
            </text>
          </>
        ) : null}
      </svg>

      <div className="is-alive-labels">
        <span className="is-alive-tag">{garmentLabel}</span>
        <span className="is-alive-tag is-alive-tag--muted">{aspectHint}</span>
        {hasBlueprint ? (
          <span className="is-alive-tag is-alive-tag--emerald">AI Designer · Ready</span>
        ) : null}
      </div>
    </div>
  );
}

/** Small thumbnail placeholder for asset sidebar cards. */
export function AssetPreviewPlaceholder({
  slotId,
  imageUrl,
  active,
}: {
  slotId: string;
  imageUrl?: string;
  active?: boolean;
}) {
  if (imageUrl) {
    return (
      <span className={cn("is-asset-thumb", active && "is-asset-thumb--active")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" />
      </span>
    );
  }

  return (
    <span className={cn("is-asset-thumb is-asset-thumb--empty", active && "is-asset-thumb--active")}>
      <svg viewBox="0 0 24 30" fill="none" className="is-asset-thumb-svg">
        <rect x="1" y="1" width="22" height="28" rx="2" stroke="currentColor" strokeWidth="0.75" opacity="0.35" />
        <path
          d="M8 8 L12 6 L16 8 L15 18 C15 19 13 20 12 20 C11 20 9 19 9 18 Z"
          stroke="currentColor"
          strokeWidth="0.6"
          opacity="0.25"
          fill="rgba(255,255,255,0.03)"
        />
        {slotId === "hero" ? (
          <circle cx="12" cy="13" r="2" fill="currentColor" opacity="0.15" />
        ) : null}
      </svg>
    </span>
  );
}

interface ProductionTimelineProps {
  currentStep?: string;
  hasResults?: boolean;
}

export function ProductionTimeline({
  currentStep = "image-studio",
  hasResults = false,
}: ProductionTimelineProps) {
  const steps = [
    { id: "research", label: "Research" },
    { id: "creative", label: "Creative Director" },
    { id: "ai-designer", label: "AI Designer" },
    { id: "image-studio", label: "Image Studio" },
    { id: "commercial", label: "Commercial Review" },
    { id: "marketing", label: "Marketing" },
    { id: "shopify", label: "Shopify" },
  ];

  const activeId = hasResults ? "commercial" : currentStep;
  const activeIndex = steps.findIndex((s) => s.id === activeId);

  return (
    <div className="is-production-timeline" aria-label="Production pipeline">
      <div className="is-timeline-track">
        {steps.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          const future = index > activeIndex;
          return (
            <div key={step.id} className="is-timeline-step-wrap">
              <div
                className={cn(
                  "is-timeline-step",
                  done && "is-timeline-step--done",
                  active && "is-timeline-step--active",
                  future && "is-timeline-step--future",
                )}
              >
                <span className="is-timeline-dot" />
                <span className="is-timeline-label">{step.label}</span>
              </div>
              {index < steps.length - 1 ? (
                <span
                  className={cn(
                    "is-timeline-connector",
                    done && "is-timeline-connector--done",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FashionProductionPipeline({
  activeStep,
}: {
  activeStep: FashionProductionStepId;
}) {
  const activeIndex = FASHION_PRODUCTION_PIPELINE.findIndex((s) => s.id === activeStep);

  return (
    <div className="is-fashion-pipeline">
      {FASHION_PRODUCTION_PIPELINE.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <div
            key={step.id}
            className={cn(
              "is-fashion-pipeline-step",
              done && "done",
              active && "active",
            )}
          >
            <span className="is-fashion-pipeline-marker" />
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface ProgressRingProps {
  status: MissionAssetStatus;
  progress?: number | null;
  size?: number;
  active?: boolean;
}

export function ProgressRing({ status, progress = 0, size = 32, active }: ProgressRingProps) {
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  const isIndeterminate = status === "generating" && progress == null;
  const pct = progress ?? 0;
  const offset = circumference - (pct / 100) * circumference;
  const showArc = status !== "waiting";
  const isComplete = status === "ready" || status === "approved";
  const isFailed = status === "failed" || status === "needs_revision";

  const strokeColor = isFailed
    ? "#f87171"
    : isComplete
      ? "var(--is-emerald)"
      : active
        ? "var(--is-emerald)"
        : "rgba(125,138,152,0.35)";

  return (
    <div
      className={cn(
        "is-progress-ring-wrap",
        `is-progress-ring-wrap--${status}`,
        active && "is-progress-ring-wrap--active",
        isIndeterminate && "is-progress-ring-wrap--indeterminate",
        isComplete && "is-progress-ring-wrap--complete",
        isFailed && "is-progress-ring-wrap--failed",
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        width={size}
        height={size}
        className={cn("is-progress-ring", isIndeterminate && "is-progress-ring--indeterminate")}
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={stroke}
        />
        {showArc ? (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={stroke}
            strokeDasharray={
              isIndeterminate ? `${circumference * 0.28} ${circumference * 0.72}` : circumference
            }
            strokeDashoffset={isIndeterminate ? 0 : offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            className={cn(isIndeterminate && "is-progress-ring-arc")}
          />
        ) : null}
      </svg>
      {isComplete ? (
        <Check className="is-progress-ring-icon is-progress-ring-icon--complete" strokeWidth={2.5} />
      ) : null}
      {status === "failed" ? (
        <X className="is-progress-ring-icon is-progress-ring-icon--failed" strokeWidth={2.5} />
      ) : null}
    </div>
  );
}
