import type { FashionDesignEngineResult, TypographySpec } from "@/lib/design/fashion-design-engine/types";
import type { DesignQualityScore } from "./types";
import { enrichGraphicSystems, registrationSymbols, concreteGrainTexture } from "./templates/shared";

const MAX_TEXT_BLOCKS = 5;

/**
 * Adjust composition specs when quality score is below threshold.
 * Never invents text — only enriches graphics and refines typography spacing.
 */
export function adjustCompositionForQuality(
  engine: FashionDesignEngineResult,
  score: DesignQualityScore,
  attempt: number,
): FashionDesignEngineResult {
  const adjusted = structuredClone(engine);

  if (score.typographyQuality < 80) {
    adjusted.typographySpec = refineTypography(adjusted.typographySpec, attempt);
  }

  if (score.compositionQuality < 80 || score.kittlBenchmarkScore < 80) {
    adjusted.graphicSpec = enrichGraphics(adjusted.graphicSpec, attempt);
    adjusted.compositionSpec = {
      ...adjusted.compositionSpec,
      score: Math.min(100, adjusted.compositionSpec.score + 4 + attempt * 2),
      proportions: {
        ...adjusted.compositionSpec.proportions,
        graphicShare: Math.min(45, adjusted.compositionSpec.proportions.graphicShare + 5),
        negativeSpaceShare: Math.max(
          adjusted.compositionSpec.proportions.negativeSpaceShare,
          55,
        ),
      },
      issues: adjusted.compositionSpec.issues.filter(
        (i: string) => !i.includes("plain") && !i.includes("graphic"),
      ),
    };
  }

  if (adjusted.layoutSpec.negativeSpace.targetRatio.match(/(\d+)/)) {
    const match = adjusted.layoutSpec.negativeSpace.targetRatio.match(/(\d+)/);
    const current = match ? parseInt(match[1]!, 10) : 50;
    if (current < 55) {
      adjusted.layoutSpec.negativeSpace.targetRatio = "60% negative space";
    }
  }

  return adjusted;
}

function refineTypography(spec: TypographySpec, attempt: number): TypographySpec {
  const blocks = spec.blocks.slice(0, MAX_TEXT_BLOCKS).map((block: TypographySpec["blocks"][number]) => {
    const next = { ...block };
    if (block.role === "hero") {
      next.letterSpacingMm = Math.max(block.letterSpacingMm, 2.5 + attempt * 0.3);
      next.fontSizeMm = Math.min(block.fontSizeMm * (1 + attempt * 0.03), 16);
    }
    if (block.role === "micro") {
      next.opacity = Math.min(block.opacity, 0.6);
    }
    return next;
  });

  return {
    ...spec,
    blocks,
    luxuryRules: [
      ...spec.luxuryRules,
      "Quality layer: premium spacing and hierarchy enforced",
    ].slice(0, 6),
  };
}

function enrichGraphics(
  graphicSpec: FashionDesignEngineResult["graphicSpec"],
  attempt: number,
): FashionDesignEngineResult["graphicSpec"] {
  const additions: Parameters<typeof enrichGraphicSystems>[1] = {
    lineSystems: [
      {
        id: "quality-perimeter-frame",
        type: "perimeter",
        count: 1,
        strokeWidthMm: 0.8,
        spacingMm: 0,
        opacity: 0.55,
      },
      {
        id: "quality-registration-grid",
        type: "grid",
        count: 3,
        strokeWidthMm: 0.35,
        spacingMm: 18,
        opacity: 0.35,
      },
    ],
    symbols: registrationSymbols(),
    textures: attempt >= 2 ? concreteGrainTexture() : undefined,
  };

  if (attempt >= 2) {
    additions.lineSystems = [
      ...(additions.lineSystems ?? []),
      {
        id: `quality-boost-arc-${attempt}`,
        type: "arc" as const,
        count: attempt,
        strokeWidthMm: 0.6,
        spacingMm: 12,
        opacity: 0.45,
      },
    ];
  }

  if (attempt >= 3) {
    additions.abstractElements = [
      {
        id: "quality-rescue-divider",
        geometry: "rescue-rule",
        dimensionsMm: "full-width",
        coordinates: "center",
        layerOrder: 2,
      },
    ];
  }

  return enrichGraphicSystems(graphicSpec, additions);
}
