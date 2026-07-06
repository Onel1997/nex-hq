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
  /** @deprecated GPT image path — not used for typography. */
  optionalTextureLayerUrl?: string;
}

const MASTER_ARTWORK_DIMENSIONS = "1024x1024";

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
): MasterArtworkCommercialReview {
  const engineScore = engine.commercialAssessment.overall;
  const vectorScore = vector.commercialMetadata.overallScore;
  const blended = Math.round((legacy.score + engineScore + vectorScore) / 3);
  const approved =
    legacy.approved ||
    engine.commercialAssessment.approved ||
    vector.commercialMetadata.approved;

  return {
    ...legacy,
    approved,
    score: Math.max(blended, legacy.score),
    critique: {
      ...legacy.critique,
      directorNotes: [
        ...legacy.critique.directorNotes,
        "Vector artwork — text-safe SVG typography",
        ...engine.commercialAssessment.explanations.slice(0, 1),
      ],
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

  // 1. Fashion Design Engine — creative specs
  const fashionEngine = runFashionDesignEngine(
    { brief, concept, designDirection },
    { generationMode },
  );

  // 2. Vector Artwork Renderer — text-safe SVG (default path)
  let vectorArtwork: VectorArtworkRenderResult;
  try {
    vectorArtwork = renderVectorArtwork({
      designId: brief.designId,
      title: brief.title,
      typographySpec: fashionEngine.typographySpec,
      layoutSpec: fashionEngine.layoutSpec,
      graphicSpec: fashionEngine.graphicSpec,
      compositionSpec: fashionEngine.compositionSpec,
      printSpec: fashionEngine.printSpec,
      commercialAssessment: fashionEngine.commercialAssessment,
      includeLayoutGuides: generationMode === "draft",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Vector artwork rendering failed";
    throw new Error(
      `Master artwork vector rendering failed — ${message}. GPT Image is not used for typography. Fix TypographySpec or LayoutSpec and retry.`,
    );
  }

  if (!vectorArtwork.typographyValidation.textSafe) {
    throw new Error(
      `Vector artwork failed text-safety validation: ${vectorArtwork.typographyValidation.issues.map((i) => i.message).join("; ")}`,
    );
  }

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
  );

  const optionalTextureLayerUrl = await generateOptionalTextureLayer(
    `Subtle material texture for ${brief.product} — no typography`,
  );

  const prompt = [
    "Vector artwork rendered via Fashion Design Engine + Vector Artwork Renderer",
    `Typography blocks: ${vectorArtwork.typographyValidation.renderedTexts.join(" / ")}`,
    `Composition score: ${vectorArtwork.commercialMetadata.compositionScore}`,
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
    optionalTextureLayerUrl,
  };
}
