import type { FashionDesignEngineResult } from "@/lib/design/fashion-design-engine/types";
import { adjustCompositionForQuality } from "./adjust";
import { renderPremiumGraphicSystems, countGraphicElements } from "./graphics/premium-graphics";
import { validateDesignRules } from "./rules/design-rules";
import { scoreDesignQuality } from "./scoring/quality-score";
import { selectCompositionTemplate } from "./templates/registry";
import type {
  DesignQualityLayerInput,
  DesignQualityLayerResult,
} from "./types";
import { MAX_QUALITY_ATTEMPTS, QUALITY_PASS_THRESHOLD } from "./types";

function resolvePanel(engine: FashionDesignEngineResult) {
  return engine.layoutSpec.backLayout ?? engine.layoutSpec.frontLayout;
}

function resolveArtboard(engine: FashionDesignEngineResult) {
  const panel = resolvePanel(engine);
  if (!panel) {
    return { widthMm: 300, heightMm: 360 };
  }
  const margin = engine.printSpec.safeMarginsMm;
  return {
    widthMm: Math.max(
      engine.printSpec.printDimensionsMm.width + margin.left + margin.right,
      panel.boundingBoxMm.width + panel.safeMarginMm * 2,
    ),
    heightMm: Math.max(
      engine.printSpec.printDimensionsMm.height + margin.top + margin.bottom,
      panel.boundingBoxMm.height + panel.offsetFromCollarMm + panel.safeMarginMm,
    ),
  };
}

/**
 * Design Quality Layer — premium composition templates, graphic systems, and Kittl benchmark scoring.
 *
 * Pipeline position:
 * Fashion Design Engine → Design Quality Layer → Vector Artwork Renderer → Commercial Review
 */
export function runDesignQualityLayer(
  input: DesignQualityLayerInput,
): DesignQualityLayerResult {
  const maxAttempts = input.maxAttempts ?? MAX_QUALITY_ATTEMPTS;
  let engine = structuredClone(input.engine);
  let attempts = 0;
  let qualityScore = scoreDesignQuality(input, [], 0);
  let template = selectCompositionTemplate({ engine, attempt: 1 });
  let applied = template.apply({ engine, attempt: 1 });

  while (attempts < maxAttempts) {
    attempts += 1;

    template = selectCompositionTemplate({ engine, attempt: attempts });
    applied = template.apply({ engine, attempt: attempts });

    const layerInput: DesignQualityLayerInput = {
      engine: {
        ...engine,
        typographySpec: applied.typographySpec,
        layoutSpec: applied.layoutSpec,
        graphicSpec: applied.graphicSpec,
        compositionSpec: applied.compositionSpec,
      },
      generationMode: input.generationMode,
    };

    const violations = validateDesignRules(layerInput);
    const graphicCount = countGraphicElements(applied.graphicSpec) + 6;
    qualityScore = scoreDesignQuality(layerInput, violations, graphicCount);

    if (qualityScore.passed && qualityScore.overall >= QUALITY_PASS_THRESHOLD) {
      break;
    }

    if (attempts < maxAttempts) {
      engine = adjustCompositionForQuality(engine, qualityScore, attempts);
    }
  }

  const panel = resolvePanel({
    ...engine,
    layoutSpec: applied.layoutSpec,
  });

  const premiumGraphicsMarkup = panel
    ? renderPremiumGraphicSystems({
        templateId: template.id,
        graphicSpec: applied.graphicSpec,
        layoutSpec: applied.layoutSpec,
        panel,
        artboard: resolveArtboard({ ...engine, layoutSpec: applied.layoutSpec }),
      })
    : "";

  const printReadyDraft =
    qualityScore.printReadiness >= 75 &&
    qualityScore.kittlBenchmarkScore >= QUALITY_PASS_THRESHOLD - 5;

  return {
    typographySpec: applied.typographySpec,
    layoutSpec: applied.layoutSpec,
    graphicSpec: applied.graphicSpec,
    compositionSpec: applied.compositionSpec,
    templateId: template.id,
    templateLabel: template.label,
    qualityScore,
    premiumGraphicsMarkup,
    attempts,
    exportLabel: "Premium Vector Artwork",
    textSafe: true,
    printReadyDraft,
  };
}
