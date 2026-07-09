import type { FashionDesignEngineResult } from "@/lib/design/fashion-design-engine/types";
import type { DesignPatternTemplate, LayoutSystemId } from "./types";

function resolvePanel(engine: FashionDesignEngineResult) {
  return engine.layoutSpec.backLayout ?? engine.layoutSpec.frontLayout;
}

function centerX(panel: NonNullable<ReturnType<typeof resolvePanel>>): number {
  return panel.boundingBoxMm.width / 2 + panel.offsetFromCenterMm;
}

function safeBounds(panel: NonNullable<ReturnType<typeof resolvePanel>>) {
  const top = panel.offsetFromCollarMm + panel.safeMarginMm;
  const bottom =
    panel.offsetFromCollarMm + panel.boundingBoxMm.height - panel.safeMarginMm;
  const left = panel.safeMarginMm;
  const right = panel.boundingBoxMm.width - panel.safeMarginMm;
  return { top, bottom, left, right, width: right - left, height: bottom - top };
}

function applySpineLayout(
  engine: FashionDesignEngineResult,
  pattern: DesignPatternTemplate,
): void {
  const panel = resolvePanel(engine);
  if (!panel) return;
  const bounds = safeBounds(panel);
  const cx = centerX(panel);
  const hero = engine.typographySpec.blocks.find((b) => b.role === "hero");
  if (hero) {
    hero.alignment = "center";
    hero.rotationDeg = -90;
    hero.positionMm = { x: cx, y: bounds.top + bounds.height * 0.42 };
    hero.letterSpacingMm = Math.max(hero.letterSpacingMm, 3);
  }
  for (const block of engine.typographySpec.blocks) {
    if (block.role === "secondary" || block.role === "micro") {
      block.alignment = "center";
      block.positionMm = {
        x: cx,
        y: bounds.top + bounds.height * 0.78,
      };
      block.fontSizeMm = Math.min(block.fontSizeMm, hero?.fontSizeMm ? hero.fontSizeMm * 0.42 : 4);
    }
  }
  panel.rotationDeg = 0;
  engine.layoutSpec.negativeSpace.targetRatio = pattern.negativeSpace;
}

function applyEditorialLayout(
  engine: FashionDesignEngineResult,
  pattern: DesignPatternTemplate,
): void {
  const panel = resolvePanel(engine);
  if (!panel) return;
  const bounds = safeBounds(panel);
  const cx = centerX(panel);
  panel.offsetFromCollarMm = Math.max(panel.offsetFromCollarMm, bounds.height * 0.12);

  for (const block of engine.typographySpec.blocks) {
    if (block.role === "hero") {
      block.alignment = "center";
      block.letterSpacingMm = Math.max(block.letterSpacingMm, 2.8);
      block.positionMm = { x: cx, y: bounds.top + bounds.height * 0.28 };
    } else if (block.role === "secondary") {
      block.alignment = "center";
      block.positionMm = { x: cx, y: bounds.top + bounds.height * 0.52 };
    } else if (block.role === "micro" || block.role === "collection") {
      block.alignment = "center";
      block.positionMm = { x: cx, y: bounds.top + bounds.height * 0.68 };
      block.opacity = Math.min(block.opacity, 0.65);
    }
  }
  engine.layoutSpec.negativeSpace.targetRatio = pattern.negativeSpace;
}

function applyOversizedCenterLayout(
  engine: FashionDesignEngineResult,
  pattern: DesignPatternTemplate,
): void {
  const panel = resolvePanel(engine);
  if (!panel) return;
  const bounds = safeBounds(panel);
  const cx = centerX(panel);
  const midY = bounds.top + bounds.height * 0.46;

  for (const block of engine.typographySpec.blocks) {
    if (block.role === "hero") {
      block.alignment = "center";
      block.letterSpacingMm = Math.max(block.letterSpacingMm, 3.2);
      block.positionMm = { x: cx, y: midY };
    } else {
      block.alignment = "center";
      block.positionMm = { x: cx, y: midY + block.fontSizeMm * 1.8 };
    }
  }
  engine.layoutSpec.negativeSpace.targetRatio = pattern.negativeSpace;
}

function applyLuxuryBadgeLayout(
  engine: FashionDesignEngineResult,
  pattern: DesignPatternTemplate,
): void {
  const panel = resolvePanel(engine);
  if (!panel) return;
  const bounds = safeBounds(panel);
  const cx = centerX(panel);
  const cy = bounds.top + bounds.height * 0.5;

  for (const block of engine.typographySpec.blocks) {
    block.alignment = "center";
    block.positionMm = {
      x: cx,
      y: block.role === "hero" ? cy - block.fontSizeMm * 0.3 : cy + block.fontSizeMm * 1.2,
    };
    if (block.role === "hero") {
      block.letterSpacingMm = Math.max(block.letterSpacingMm, 2.4);
    }
  }
  engine.layoutSpec.negativeSpace.targetRatio = pattern.negativeSpace;
}

function applyCornerChestLayout(
  engine: FashionDesignEngineResult,
  pattern: DesignPatternTemplate,
): void {
  const panel = resolvePanel(engine);
  if (!panel) return;
  const bounds = safeBounds(panel);
  const anchorX = bounds.left + bounds.width * 0.22;
  const anchorY = bounds.top + bounds.height * 0.35;

  for (const block of engine.typographySpec.blocks) {
    block.alignment = "left";
    block.positionMm = {
      x: anchorX,
      y: anchorY + (block.role === "hero" ? 0 : block.fontSizeMm * 1.4),
    };
    block.fontSizeMm = Math.min(block.fontSizeMm, 5.5);
  }
  engine.layoutSpec.negativeSpace.targetRatio = pattern.negativeSpace;
}

const LAYOUT_APPLIERS: Partial<
  Record<LayoutSystemId, (engine: FashionDesignEngineResult, pattern: DesignPatternTemplate) => void>
> = {
  "spine-layout": applySpineLayout,
  "editorial-layout": applyEditorialLayout,
  "oversized-center": applyOversizedCenterLayout,
  "luxury-badge": applyLuxuryBadgeLayout,
  "corner-composition": applyCornerChestLayout,
  "bottom-label": applyEditorialLayout,
  "top-heavy": applyEditorialLayout,
  "diagonal-composition": applyOversizedCenterLayout,
  "negative-space-layout": applyLuxuryBadgeLayout,
  "split-composition": applyEditorialLayout,
  "grid-composition": applyEditorialLayout,
  "floating-composition": applyLuxuryBadgeLayout,
};

/**
 * Position typography and layout from the selected Fashion Knowledge pattern.
 * The renderer reads these specs — no random placement.
 */
export function applyPatternLayoutToEngine(
  engine: FashionDesignEngineResult,
  pattern: DesignPatternTemplate,
): FashionDesignEngineResult {
  const applied = structuredClone(engine);
  const panel = resolvePanel(applied);

  if (panel && pattern.recommendedPrintSizeMm) {
    panel.boundingBoxMm = { ...pattern.recommendedPrintSizeMm };
    panel.safeMarginMm = Math.max(panel.safeMarginMm, 8);
  }

  applied.printSpec.printDimensionsMm = pattern.recommendedPrintSizeMm;
  applied.layoutSpec.negativeSpace.targetRatio = pattern.negativeSpace;
  applied.compositionSpec.proportions.negativeSpaceShare =
    parseInt(pattern.negativeSpace.replace("%", ""), 10) || 55;

  const applier = LAYOUT_APPLIERS[pattern.layoutSystemId];
  if (applier) {
    applier(applied, pattern);
  } else {
    applyOversizedCenterLayout(applied, pattern);
  }

  return applied;
}
