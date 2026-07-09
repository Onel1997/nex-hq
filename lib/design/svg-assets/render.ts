import type { ColorScheme } from "@/lib/design/vector-engine/types";
import type { SvgAssetDefinition, SvgAssetPlacement, SvgAssetRenderContext } from "@/lib/design/svg-assets/types";
import { escapeXml } from "@/lib/design/vector-engine/xml";

export interface SvgAssetRenderInput {
  asset: SvgAssetDefinition;
  cx: number;
  cy: number;
  scale: number;
  rotation: number;
  opacity: number;
  strokeWidth: number;
  colors: ColorScheme;
  variant?: string;
  clipPathId?: string;
  maskId?: string;
}

function buildRenderContext(input: SvgAssetRenderInput): SvgAssetRenderContext {
  return {
    cx: input.cx,
    cy: input.cy,
    scale: input.scale,
    rotation: input.rotation,
    opacity: input.opacity,
    strokeWidth: input.strokeWidth,
    color: input.colors.primary,
    secondaryColor: input.colors.secondary,
    accentColor: input.colors.accent,
    variant: input.variant ?? input.asset.variants[0] ?? "default",
    clipPathId: input.clipPathId,
    maskId: input.maskId,
  };
}

export function renderSvgAsset(input: SvgAssetRenderInput): string {
  const ctx = buildRenderContext(input);
  const inner = input.asset.render(ctx);

  const transform =
    input.rotation !== 0
      ? ` transform="rotate(${input.rotation} ${input.cx} ${input.cy})"`
      : "";

  const clip = input.clipPathId ? ` clip-path="url(#${input.clipPathId})"` : "";
  const mask = input.maskId ? ` mask="url(#${input.maskId})"` : "";

  const attrs = [
    `id="asset-${input.asset.id}"`,
    `data-family="${escapeXml(input.asset.family)}"`,
    `data-variant="${escapeXml(ctx.variant)}"`,
    transform,
    clip,
    mask,
  ]
    .filter(Boolean)
    .join(" ");

  console.log(`[SVG ASSETS] Rendered asset: ${input.asset.id}`);

  return `<g ${attrs}>${inner}</g>`;
}

export function renderSvgAssetPlacement(
  placement: SvgAssetPlacement,
  strokeWidth: number,
  colors: ColorScheme,
): string {
  return renderSvgAsset({
    asset: placement.asset,
    cx: placement.cx,
    cy: placement.cy,
    scale: placement.scale,
    rotation: placement.rotation,
    opacity: placement.opacity,
    strokeWidth,
    colors,
    variant: placement.variant,
  });
}

export function renderSvgAssetPack(
  placements: SvgAssetPlacement[],
  strokeWidth: number,
  colors: ColorScheme,
): string {
  return placements.map((p) => renderSvgAssetPlacement(p, strokeWidth, colors)).join("");
}
