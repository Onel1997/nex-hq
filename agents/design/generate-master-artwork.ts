import { isOpenAiImagesConfigured } from "@/agents/image/providers/openai-images-provider";
import {
  getImageGenerationMode,
  getActiveImageGenerationProfile,
  resolveOpenAiImageSize,
  stripUnknownOpenAiImagePayloadFields,
} from "@/lib/image/image-generation-config";
import { getOpenAIClient } from "@/lib/openai/client";
import {
  runMasterArtworkCommercialReview,
  type MasterArtworkCommercialReview,
} from "@/lib/design/master-artwork-commercial";
import type { NormalizedMasterArtworkRequest } from "@/lib/design/master-artwork-request";
import type { MasterArtworkSourceType } from "@/lib/design/master-artwork";
import {
  advanceFashionEngineProgress,
  runFashionDesignEngine,
  type FashionDesignEngineResult,
} from "@/lib/design/fashion-design-engine";
import {
  runDesignQualityLayer,
  type DesignQualityLayerResult,
} from "@/lib/design/design-quality-layer";
import { QUALITY_PASS_THRESHOLD } from "@/lib/design/design-quality-layer/types";
import {
  runFashionKnowledgePipeline,
  type FashionKnowledgePipelineResult,
} from "@/lib/design/fashion-knowledge";
import {
  EXPORT_SCORE_THRESHOLDS,
  meetsExportScoreThresholds,
} from "@/lib/design/fashion-knowledge/types";
import {
  renderVectorArtwork,
  type VectorArtworkRenderResult,
} from "@/lib/design/vector-artwork-renderer";

export interface GenerateMasterArtworkResult {
  sourceType: MasterArtworkSourceType;
  /** Primary artwork — vector SVG data URL for text-safe path. */
  artworkImageUrl: string;
  transparentPngUrl: string;
  productionPngUrl: string;
  previewUrl: string;
  /** Print-ready vector SVG markup. */
  svgString: string;
  selectedConceptId: string;
  designDirection: string;
  generationMode: "draft" | "production";
  dpi: number;
  resolution: string;
  transparentBackground: boolean;
  printReady: boolean;
  prompt: string;
  commercialReview: MasterArtworkCommercialReview;
  transparencyWarning?: string;
  fashionEngine?: FashionDesignEngineResult;
  vectorArtwork?: VectorArtworkRenderResult;
  designQuality?: DesignQualityLayerResult;
  fashionKnowledge?: FashionKnowledgePipelineResult;
  /** @deprecated GPT image path — not used for typography. */
  optionalTextureLayerUrl?: string;
  /** Set when export thresholds were not met but best candidate is returned. */
  exportThresholdWarning?: string;
}

const MASTER_ARTWORK_DIMENSIONS = "1024x1024";
const MAX_EXPORT_ATTEMPTS = 20;

function meetsProductionExportGate(
  fashionKnowledge: FashionKnowledgePipelineResult,
  designQuality: DesignQualityLayerResult,
): boolean {
  return (
    meetsExportScoreThresholds(fashionKnowledge.ranking) &&
    fashionKnowledge.creativeVerdict.passed &&
    designQuality.qualityScore.overall >= EXPORT_SCORE_THRESHOLDS.overall &&
    designQuality.qualityScore.typographyQuality >= EXPORT_SCORE_THRESHOLDS.typography &&
    designQuality.qualityScore.compositionQuality >= EXPORT_SCORE_THRESHOLDS.composition &&
    designQuality.qualityScore.printReadiness >= EXPORT_SCORE_THRESHOLDS.printability &&
    designQuality.qualityScore.kittlBenchmarkScore >= QUALITY_PASS_THRESHOLD
  );
}

type ExportCandidate = {
  fashionEngine: FashionDesignEngineResult;
  fashionKnowledge: FashionKnowledgePipelineResult;
  designQuality: DesignQualityLayerResult;
  vectorArtwork: VectorArtworkRenderResult;
  score: number;
};

function scoreExportCandidate(
  fashionKnowledge: FashionKnowledgePipelineResult,
  designQuality: DesignQualityLayerResult,
): number {
  const ranking = fashionKnowledge.ranking;
  const quality = designQuality.qualityScore;
  return (
    ranking.overall * 0.35 +
    quality.overall * 0.35 +
    quality.kittlBenchmarkScore * 0.15 +
    ranking.commercial * 0.15
  );
}

function buildExportThresholdWarning(
  attemptCount: number,
  fashionKnowledge: FashionKnowledgePipelineResult,
  designQuality: DesignQualityLayerResult,
): string {
  const ranking = fashionKnowledge.ranking;
  const quality = designQuality.qualityScore;
  return (
    `Export thresholds not met after ${attemptCount} attempts — showing best candidate. ` +
    `Commercial ${ranking.commercial}, Brand ${ranking.brandDna}, ` +
    `Typography ${ranking.typography}, Composition ${ranking.composition}, ` +
    `Luxury ${ranking.luxury}, Print ${ranking.printability}, ` +
    `Quality ${Math.round(quality.overall)}, Kittl ${Math.round(quality.kittlBenchmarkScore)}`
  );
}

function resolveMasterArtworkDpi(mode: "draft" | "production"): number {
  return mode === "production" ? 300 : 150;
}

function resolveMasterArtworkResolution(
  widthMm: number,
  heightMm: number,
  dpi: number,
): string {
  const widthPx = Math.round((widthMm / 25.4) * dpi);
  const heightPx = Math.round((heightMm / 25.4) * dpi);
  return `${widthPx} × ${heightPx} px · ${dpi} DPI target · ${widthMm} × ${heightMm} mm`;
}

function mergeCommercialReview(
  engine: FashionDesignEngineResult,
  vector: VectorArtworkRenderResult,
  legacy: MasterArtworkCommercialReview,
  designQuality?: DesignQualityLayerResult,
  fashionKnowledge?: FashionKnowledgePipelineResult,
): MasterArtworkCommercialReview {
  const engineScore = engine.commercialAssessment.overall;
  const vectorScore = vector.commercialMetadata.overallScore;
  const qualityScore = designQuality?.qualityScore.overall;
  const fashionKnowledgeScore = fashionKnowledge?.ranking.overall;
  const allScores = [legacy.score, engineScore, vectorScore, qualityScore, fashionKnowledgeScore].filter(
    (s): s is number => s != null,
  );
  const blendedScore = Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length);
  const approved =
    legacy.approved ||
    engine.commercialAssessment.approved ||
    vector.commercialMetadata.approved ||
    Boolean(designQuality?.qualityScore.passed) ||
    Boolean(fashionKnowledge?.exportApproved);

  return {
    ...legacy,
    approved,
    score: Math.max(blendedScore, legacy.score),
    critique: {
      ...legacy.critique,
      directorNotes: [
        ...legacy.critique.directorNotes,
        fashionKnowledge
          ? `Fashion knowledge — ${fashionKnowledge.selectedPattern.name} (${fashionKnowledge.ranking.overall}/100)`
          : null,
        designQuality
          ? `Premium vector artwork — Kittl benchmark ${designQuality.qualityScore.kittlBenchmarkScore}/100`
          : "Vector artwork — text-safe SVG typography",
        ...engine.commercialAssessment.explanations.slice(0, 1),
      ].filter((note): note is string => Boolean(note)),
    },
  };
}

/**
 * Optional GPT texture layer — background grain/distress only, never typography.
 * Disabled by default. Set ENABLE_GPT_TEXTURE_LAYER=true to enable.
 */
async function generateOptionalTextureLayer(
  prompt: string,
): Promise<string | undefined> {
  if (process.env.ENABLE_GPT_TEXTURE_LAYER !== "true") return undefined;
  if (!isOpenAiImagesConfigured()) return undefined;

  const openai = getOpenAIClient();
  const profile = getActiveImageGenerationProfile();
  const size = resolveOpenAiImageSize(MASTER_ARTWORK_DIMENSIONS);

  const texturePrompt = `${prompt}\n\nTEXTURE ONLY: subtle grain or distress overlay. NO text. NO letters. NO words. Transparent background.`;

  const payload = stripUnknownOpenAiImagePayloadFields({
    model: profile.model,
    prompt: texturePrompt,
    n: 1,
    size,
    quality: profile.quality,
    output_format: "png",
    background: "transparent",
  });

  const response = await openai.images.generate(payload);
  const item = response.data?.[0];
  if (!item?.b64_json) return undefined;

  return `data:image/png;base64,${item.b64_json}`;
}

export async function runGenerateMasterArtwork(
  request: NormalizedMasterArtworkRequest,
): Promise<GenerateMasterArtworkResult> {
  const { brief, concept } = request;
  const designDirection =
    request.designDirection?.trim() ||
    concept.creativeDirection.summary ||
    brief.visualConcept;

  const generationMode = getImageGenerationMode();
  const dpi = resolveMasterArtworkDpi(generationMode);
  const printReady = generationMode === "production";

  let fashionEngine = runFashionDesignEngine(
    { brief, concept, designDirection },
    { generationMode },
  );

  let fashionKnowledge: FashionKnowledgePipelineResult | null = null;
  let designQuality: DesignQualityLayerResult | null = null;
  let vectorArtwork: VectorArtworkRenderResult | null = null;
  let exportAttempt = 0;
  let bestCandidate: ExportCandidate | null = null;

  while (exportAttempt < MAX_EXPORT_ATTEMPTS) {
    exportAttempt += 1;

    fashionKnowledge = runFashionKnowledgePipeline({
      brief,
      concept,
      engine: fashionEngine,
      designDirection,
      maxIterations: MAX_EXPORT_ATTEMPTS,
      seedOffset: exportAttempt,
    });
    fashionEngine = {
      ...fashionKnowledge.engine,
      fashionKnowledge,
    };

    designQuality = runDesignQualityLayer({
      engine: fashionEngine,
      generationMode,
      maxAttempts: MAX_EXPORT_ATTEMPTS,
      fashionKnowledge,
    });

    fashionEngine.typographySpec = designQuality.typographySpec;
    fashionEngine.layoutSpec = designQuality.layoutSpec;
    fashionEngine.graphicSpec = designQuality.graphicSpec;
    fashionEngine.compositionSpec = designQuality.compositionSpec;

    let renderedVector: VectorArtworkRenderResult;
    try {
      renderedVector = renderVectorArtwork({
        designId: brief.designId,
        title: brief.title,
        typographySpec: designQuality.typographySpec,
        layoutSpec: designQuality.layoutSpec,
        graphicSpec: designQuality.graphicSpec,
        compositionSpec: designQuality.compositionSpec,
        printSpec: fashionEngine.printSpec,
        commercialAssessment: fashionEngine.commercialAssessment,
        includeLayoutGuides: generationMode === "draft",
        qualityLayerMarkup: designQuality.premiumGraphicsMarkup,
        exportLabel: designQuality.exportLabel,
      });
    } catch (error) {
      if (exportAttempt >= MAX_EXPORT_ATTEMPTS && bestCandidate) {
        break;
      }
      if (exportAttempt >= MAX_EXPORT_ATTEMPTS) {
        const message =
          error instanceof Error ? error.message : "Vector artwork rendering failed";
        throw new Error(
          `Master artwork vector rendering failed — ${message}. GPT Image is not used for typography. Fix TypographySpec or LayoutSpec and retry.`,
        );
      }
      fashionEngine = runFashionDesignEngine(
        { brief, concept, designDirection },
        { generationMode },
      );
      continue;
    }

    if (!renderedVector.typographyValidation.textSafe) {
      if (exportAttempt >= MAX_EXPORT_ATTEMPTS && bestCandidate) {
        break;
      }
      if (exportAttempt >= MAX_EXPORT_ATTEMPTS) {
        throw new Error(
          `Vector artwork failed text-safety validation: ${renderedVector.typographyValidation.issues.map((i) => i.message).join("; ")}`,
        );
      }
      fashionEngine = runFashionDesignEngine(
        { brief, concept, designDirection },
        { generationMode },
      );
      continue;
    }

    vectorArtwork = renderedVector;
    const candidateScore = scoreExportCandidate(fashionKnowledge, designQuality);
    if (!bestCandidate || candidateScore > bestCandidate.score) {
      bestCandidate = {
        fashionEngine,
        fashionKnowledge,
        designQuality,
        vectorArtwork: renderedVector,
        score: candidateScore,
      };
    }

    if (meetsProductionExportGate(fashionKnowledge, designQuality)) {
      break;
    }

    if (exportAttempt < MAX_EXPORT_ATTEMPTS) {
      fashionEngine = runFashionDesignEngine(
        { brief, concept, designDirection },
        { generationMode },
      );
    }
  }

  if ((!fashionKnowledge || !designQuality || !vectorArtwork) && bestCandidate) {
    fashionEngine = bestCandidate.fashionEngine;
    fashionKnowledge = bestCandidate.fashionKnowledge;
    designQuality = bestCandidate.designQuality;
    vectorArtwork = bestCandidate.vectorArtwork;
  }

  if (!fashionKnowledge || !designQuality || !vectorArtwork) {
    throw new Error("Master artwork generation failed — pipeline did not produce artwork");
  }

  const exportGatePassed = meetsProductionExportGate(fashionKnowledge, designQuality);
  if (!exportGatePassed && bestCandidate) {
    fashionEngine = bestCandidate.fashionEngine;
    fashionKnowledge = bestCandidate.fashionKnowledge;
    designQuality = bestCandidate.designQuality;
    vectorArtwork = bestCandidate.vectorArtwork;
  }

  const exportThresholdWarning = exportGatePassed
    ? undefined
    : buildExportThresholdWarning(exportAttempt, fashionKnowledge, designQuality);

  fashionEngine.printSpec = {
    ...fashionEngine.printSpec,
    vectorPipelineReady: true,
    futureSvgPath: `vector-artwork/${brief.designId}.svg`,
  };

  fashionEngine.progress = advanceFashionEngineProgress(
    fashionEngine.progress,
    "image-generation",
  );

  const previewUrl =
    vectorArtwork.transparentPngPreview ??
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(vectorArtwork.svgString)}`;

  const resolution = resolveMasterArtworkResolution(
    vectorArtwork.width,
    vectorArtwork.height,
    dpi,
  );

  const legacyCommercialReview = runMasterArtworkCommercialReview({ brief, concept });
  const commercialReview = mergeCommercialReview(
    fashionEngine,
    vectorArtwork,
    legacyCommercialReview,
    designQuality,
    fashionKnowledge,
  );

  vectorArtwork.commercialMetadata = {
    ...vectorArtwork.commercialMetadata,
    kittlBenchmarkScore: designQuality.qualityScore.kittlBenchmarkScore,
    qualityLayerTemplate: designQuality.templateId,
    overallScore: Math.max(
      vectorArtwork.commercialMetadata.overallScore,
      designQuality.qualityScore.overall,
    ),
  };

  vectorArtwork.exportState = {
    ...vectorArtwork.exportState,
    label: designQuality.exportLabel,
    kittlBenchmarkScore: designQuality.qualityScore.kittlBenchmarkScore,
    textSafe: vectorArtwork.typographyValidation.textSafe,
    printReadyDraft: designQuality.printReadyDraft,
  };

  const optionalTextureLayerUrl = await generateOptionalTextureLayer(
    `Subtle material texture for ${brief.product} — no typography`,
  );

  const prompt = [
    "Vector artwork via Fashion Knowledge → Fashion Design Engine → Design Quality Layer → Vector Renderer",
    `Pattern: ${fashionKnowledge.selectedPattern.name} (${fashionKnowledge.candidatesEvaluated} candidates)`,
    `Commercial ranking: ${fashionKnowledge.ranking.overall}/100`,
    `Template: ${designQuality.templateLabel}`,
    `Kittl benchmark: ${designQuality.qualityScore.kittlBenchmarkScore}/100`,
    `Typography blocks: ${vectorArtwork.typographyValidation.renderedTexts.join(" / ")}`,
    `Creative gate: ${fashionKnowledge.creativeVerdict.passed ? "passed" : "best-effort"}`,
    optionalTextureLayerUrl ? "Optional GPT texture layer applied" : "No GPT image layer",
  ].join(". ");

  return {
    sourceType: "vector-artwork",
    artworkImageUrl: previewUrl,
    transparentPngUrl: previewUrl,
    productionPngUrl: previewUrl,
    previewUrl,
    svgString: vectorArtwork.svgString,
    selectedConceptId: request.selectedConceptId ?? concept.designId,
    designDirection,
    generationMode,
    dpi,
    resolution,
    transparentBackground: true,
    printReady,
    prompt,
    commercialReview,
    fashionEngine,
    vectorArtwork,
    designQuality,
    fashionKnowledge,
    optionalTextureLayerUrl,
    exportThresholdWarning,
  };
}
