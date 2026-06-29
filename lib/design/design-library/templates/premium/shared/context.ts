import type { LibraryArtworkSpec } from "@/lib/design/design-library/types";
import type { ApparelPlacement, PremiumRenderContext } from "@/lib/design/design-library/templates/premium/types";
import { range } from "@/lib/design/vector-engine/hash";
import { snap } from "@/lib/design/vector-engine/tokens";

export function detectApparelPlacement(spec: LibraryArtworkSpec): ApparelPlacement {
  const text = `${spec.brief.placement} ${spec.brief.printArea} ${spec.layout.id}`.toLowerCase();
  if (text.includes("sleeve")) return "sleeve";
  if (text.includes("corner")) return "corner";
  if (text.includes("dual")) return "dual-print";
  if (text.includes("back")) return "oversized-back";
  if (text.includes("oversized") || spec.layout.id.includes("oversized")) return "oversized-front";
  if (text.includes("micro") || text.includes("pocket")) return "center-chest";
  return "oversized-front";
}

export function buildPremiumRenderContext(
  spec: LibraryArtworkSpec,
  strokeWidth: number,
  placementOverride?: ApparelPlacement,
): PremiumRenderContext {
  const placement = placementOverride ?? detectApparelPlacement(spec);
  const { safeZone, anchors, heroZone } = spec.layoutZones;
  const isHero = spec.brief.role.toLowerCase().includes("hero");
  const isMicro = spec.brief.printArea.toLowerCase().includes("micro") && !isHero;

  let heroScale = heroZone.width * 0.58;
  if (placement === "oversized-front" || placement === "oversized-back") {
    heroScale = heroZone.width * 0.72;
  } else if (placement === "center-chest" || isMicro) {
    heroScale = heroZone.width * 0.48;
  } else if (placement === "sleeve") {
    heroScale = heroZone.width * 0.36;
  } else if (placement === "corner") {
    heroScale = heroZone.width * 0.4;
  }

  const offsetX = range(spec.seed, 2, -safeZone.width * 0.05, safeZone.width * 0.05);
  const offsetY = range(spec.seed, 4, -safeZone.height * 0.04, safeZone.height * 0.04);

  return {
    spec,
    strokeWidth,
    placement,
    safeZone,
    artboard: spec.artboard,
    seed: spec.seed,
    colors: spec.colors,
    focal: {
      x: snap(anchors.focal.x + offsetX),
      y: snap(anchors.focal.y + offsetY),
    },
    heroScale,
    fontFamily: spec.typographySystem.fontFamily,
  };
}

export function placementScale(ctx: PremiumRenderContext, multiplier: number): number {
  return ctx.heroScale * multiplier;
}

export function assetPoint(
  ctx: PremiumRenderContext,
  rx: number,
  ry: number,
  jitter = 0,
): { x: number; y: number } {
  const seed = ctx.seed + jitter;
  return {
    x: snap(ctx.safeZone.x + ctx.safeZone.width * rx + range(seed, jitter, -8, 8)),
    y: snap(ctx.safeZone.y + ctx.safeZone.height * ry + range(seed, jitter + 1, -6, 6)),
  };
}
