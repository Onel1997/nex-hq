import { isOpenAiImagesConfigured } from "@/agents/image/providers/openai-images-provider";
import {
  getActiveImageGenerationProfile,
  getImageGenerationMode,
  resolveOpenAiImageSize,
  stripUnknownOpenAiImagePayloadFields,
  type OpenAiImageSize,
} from "@/lib/image/image-generation-config";
import { getOpenAIClient } from "@/lib/openai/client";
import { buildMasterArtworkGenerationPrompt } from "@/lib/design/master-artwork-prompt";
import {
  runMasterArtworkCommercialReview,
  type MasterArtworkCommercialReview,
} from "@/lib/design/master-artwork-commercial";
import type { NormalizedMasterArtworkRequest } from "@/lib/design/master-artwork-request";
import {
  MASTER_ARTWORK_PNG_MAX_ATTEMPTS,
  validateTransparentArtworkPng,
} from "@/lib/design/validate-transparent-artwork-png";
import { TRANSPARENT_ARTWORK_BACKGROUND_WARNING } from "@/lib/design/sanitize-print-artwork";
import type { MasterArtworkSourceType } from "@/lib/design/master-artwork";

export interface GenerateMasterArtworkResult {
  sourceType: MasterArtworkSourceType;
  artworkImageUrl: string;
  transparentPngUrl: string;
  productionPngUrl: string;
  previewUrl: string;
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
}

const MASTER_ARTWORK_DIMENSIONS = "1024x1024";

function resolveMasterArtworkDpi(mode: "draft" | "production"): number {
  return mode === "production" ? 300 : 150;
}

function resolveMasterArtworkResolution(size: OpenAiImageSize, dpi: number): string {
  const match = size.match(/(\d+)x(\d+)/i);
  if (!match) return `${size} @ ${dpi} DPI target`;
  return `${match[1]} × ${match[2]} px · ${dpi} DPI target`;
}

async function generateTransparentMasterArtwork(prompt: string): Promise<Buffer> {
  const openai = getOpenAIClient();
  const mode = getImageGenerationMode();
  const profile = getActiveImageGenerationProfile();
  const size = resolveOpenAiImageSize(MASTER_ARTWORK_DIMENSIONS);

  const payload = stripUnknownOpenAiImagePayloadFields({
    model: profile.model,
    prompt,
    n: 1,
    size,
    quality: profile.quality,
    output_format: "png",
    background: "transparent",
  });

  console.info("[Master Artwork] generating", {
    mode,
    size: payload.size,
    quality: payload.quality,
    promptLength: prompt.length,
    background: "transparent",
  });

  const response = await openai.images.generate(payload);
  const item = response.data?.[0];
  if (!item?.b64_json) {
    throw new Error("Master artwork generation returned no image data");
  }

  return Buffer.from(item.b64_json, "base64");
}

async function generateValidatedTransparentMasterArtwork(
  prompt: string,
): Promise<{ imageBytes: Buffer; prompt: string; transparencyWarning?: string }> {
  let lastReason: string | undefined;

  for (let attempt = 1; attempt <= MASTER_ARTWORK_PNG_MAX_ATTEMPTS; attempt += 1) {
    const attemptPrompt =
      attempt === 1
        ? prompt
        : `${prompt}\n\nRETRY ${attempt}: Previous output included a background rectangle or forbidden report/dashboard text. Output ONLY isolated print artwork on fully transparent pixels. Render visibleText only — never Research Report, Intelligence Report, Key Findings, or similar labels.`;

    const imageBytes = await generateTransparentMasterArtwork(attemptPrompt);
    const validation = validateTransparentArtworkPng(imageBytes);

    if (validation.valid) {
      return { imageBytes, prompt: attemptPrompt };
    }

    lastReason = validation.reason;
    console.warn("[Master Artwork] rejected baked background — regenerating", {
      attempt,
      edgeConnectedOpaqueRatio: validation.edgeConnectedOpaqueRatio,
      fullyTransparentRatio: validation.fullyTransparentRatio,
    });
  }

  throw new Error(lastReason ?? TRANSPARENT_ARTWORK_BACKGROUND_WARNING);
}

export async function runGenerateMasterArtwork(
  request: NormalizedMasterArtworkRequest,
): Promise<GenerateMasterArtworkResult> {
  if (!isOpenAiImagesConfigured()) {
    throw new Error("OpenAI API key not configured for master artwork generation");
  }

  const { brief, concept } = request;
  const designDirection =
    request.designDirection?.trim() ||
    concept.creativeDirection.summary ||
    brief.visualConcept;

  const prompt = buildMasterArtworkGenerationPrompt({
    brief,
    concept,
    designDirection,
  });

  const { imageBytes, prompt: finalPrompt } = await generateValidatedTransparentMasterArtwork(prompt);
  const dataUrl = `data:image/png;base64,${imageBytes.toString("base64")}`;
  const generationMode = getImageGenerationMode();
  const dpi = resolveMasterArtworkDpi(generationMode);
  const size = resolveOpenAiImageSize(MASTER_ARTWORK_DIMENSIONS);
  const resolution = resolveMasterArtworkResolution(size, dpi);
  const printReady = generationMode === "production";

  const commercialReview = runMasterArtworkCommercialReview({ brief, concept });

  return {
    sourceType: "ai-designer-artwork",
    artworkImageUrl: dataUrl,
    transparentPngUrl: dataUrl,
    productionPngUrl: dataUrl,
    previewUrl: dataUrl,
    selectedConceptId: request.selectedConceptId ?? concept.designId,
    designDirection,
    generationMode,
    dpi,
    resolution,
    transparentBackground: true,
    printReady,
    prompt: finalPrompt,
    commercialReview,
  };
}
