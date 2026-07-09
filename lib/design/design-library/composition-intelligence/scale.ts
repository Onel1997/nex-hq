import type { TypographyPlacement } from "@/lib/design/design-library/types";
import type { FocalSystem } from "@/lib/design/design-library/composition-intelligence/focal-system";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export interface ScaleProfile {
  dominantScale: number;
  microScale: number;
  typeMaxScale: number;
  typeMinScale: number;
  dramaticRange: number;
  score: number;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function analyzeScale(focal: FocalSystem, typography: TypographyPlacement[]): ScaleProfile {
  const dominantScale = focal.primary.scale;
  const microScale = focal.micro[0]?.scale ?? dominantScale * 0.08;
  const typeSizes = typography.filter((t) => t.layer === "typography").map((t) => t.size);
  const typeMaxScale = typeSizes.length ? Math.max(...typeSizes) : 0;
  const typeMinScale = typeSizes.length ? Math.min(...typeSizes) : 0;
  const dramaticRange = dominantScale / Math.max(microScale, 1);

  let score = 50;
  if (dramaticRange >= 8) score += 20;
  else if (dramaticRange >= 5) score += 12;
  else score -= 15;

  if (typeMaxScale > 0 && typeMinScale > 0) {
    const typeRange = typeMaxScale / typeMinScale;
    if (typeRange >= 3) score += 16;
    else if (typeRange >= 2) score += 8;
    else score -= 12;
  }

  return { dominantScale, microScale, typeMaxScale, typeMinScale, dramaticRange, score: clamp(score) };
}

/** Applies dramatic scale variation to typography — mix large and micro text. */
export function applyDramaticTypeScale(
  placements: TypographyPlacement[],
  focal: FocalSystem,
  seed: number,
): TypographyPlacement[] {
  return placements.map((p, i) => {
    if (p.layer !== "typography") return p;
    if (p.role === "headline" || p.role === "stacked-headline") {
      const boost = range(seed, 1000 + i, 1.08, 1.28);
      return { ...p, size: snap(p.size * boost) };
    }
    if (p.role === "micro-label" || p.role === "caption" || p.role === "roman-numeral") {
      const shrink = range(seed, 1010 + i, 0.55, 0.75);
      return { ...p, size: snap(p.size * shrink), opacity: p.opacity * 0.85 };
    }
    return p;
  });
}

export function hasUniformScale(profile: ScaleProfile): boolean {
  return profile.dramaticRange < 4 && profile.typeMaxScale / Math.max(profile.typeMinScale, 1) < 1.8;
}
