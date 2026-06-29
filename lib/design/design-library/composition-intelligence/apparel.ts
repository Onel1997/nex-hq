import type { PremiumRenderContext } from "@/lib/design/design-library/templates/premium/types";
import type { ApparelPlacement } from "@/lib/design/design-library/templates/premium/types";

export type GarmentZone =
  | "center-chest"
  | "oversized-front"
  | "oversized-back"
  | "sleeve"
  | "pocket"
  | "neck"
  | "hem-band";

export interface ApparelContext {
  placement: ApparelPlacement;
  garmentZone: GarmentZone;
  /** Design for garments, not posters */
  isGarmentScale: boolean;
  /** Print area utilization — oversized fills more */
  coverageRatio: number;
  /** Edge bleed tolerance for cropped elements */
  edgeBleed: number;
  score: number;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

const PLACEMENT_COVERAGE: Record<ApparelPlacement, number> = {
  "center-chest": 0.42,
  "oversized-front": 0.78,
  "oversized-back": 0.82,
  sleeve: 0.28,
  "dual-print": 0.55,
  corner: 0.35,
};

export function resolveApparelContext(ctx: PremiumRenderContext): ApparelContext {
  const { placement, safeZone, heroScale, spec } = ctx;
  const isHero = spec.brief.role.toLowerCase().includes("hero");
  const isMicro = spec.brief.printArea.toLowerCase().includes("micro");

  const garmentZone: GarmentZone =
    placement === "oversized-front"
      ? "oversized-front"
      : placement === "oversized-back"
        ? "oversized-back"
        : placement === "sleeve"
          ? "sleeve"
          : placement === "corner"
            ? "pocket"
            : "center-chest";

  const coverageRatio = PLACEMENT_COVERAGE[placement] ?? 0.5;
  const isGarmentScale = isHero && !isMicro && heroScale >= safeZone.width * 0.38;
  const edgeBleed = placement.includes("oversized") ? 0.08 : 0.04;

  let score = 50;
  if (isGarmentScale) score += 22;
  if (coverageRatio >= 0.6) score += 14;
  if (placement === "oversized-front" || placement === "oversized-back") score += 12;
  if (isMicro) score -= 15;

  return {
    placement,
    garmentZone,
    isGarmentScale,
    coverageRatio,
    edgeBleed,
    score: clamp(score),
  };
}

export function isPosterScale(context: ApparelContext): boolean {
  return !context.isGarmentScale && context.coverageRatio < 0.35;
}

export function isWireframeBlueprint(spec: { template: { id: string }; style: { id: string } }): boolean {
  return spec.template.id === "technical-blueprint" || spec.style.id === "technical-streetwear";
}
