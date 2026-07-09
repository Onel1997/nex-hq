import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";
import {
  designMockupRequestInputSchema,
  normalizeDesignMockupRequest,
  type DesignMockupRequestInput,
  type NormalizedDesignMockupRequest,
} from "@/lib/design/mockup-request";

export const designRenderRequestInputSchema = designMockupRequestInputSchema;
export type DesignRenderRequestInput = DesignMockupRequestInput;
export type NormalizedDesignRenderRequest = NormalizedDesignMockupRequest;

export const normalizeDesignRenderRequest = normalizeDesignMockupRequest;

export function buildDesignRenderPayload(input: {
  brief: DesignStudioBrief;
  collectionName?: string;
  assets?: DesignMissionAssets;
  imagePrompt?: string;
}): DesignRenderRequestInput {
  return {
    brief: input.brief as unknown as Record<string, unknown>,
    collectionName: input.collectionName,
    assets: input.assets as unknown as Record<string, unknown> | undefined,
    imagePrompt: input.imagePrompt,
    prompt: input.imagePrompt,
  };
}

export function buildRenderGenerationPrompt(
  request: NormalizedDesignRenderRequest,
): string {
  const segments = [
    request.imagePrompt || request.prompt,
    `Design: ${request.title}`,
    `Garment: ${request.garment}`,
    `Colorway: ${request.colorway}`,
    `Collection: ${request.collection}`,
    `Graphic placement: ${request.placement}`,
    `Creative direction: ${request.productionMethod}`,
    "Premium editorial AI fashion render, cinematic studio lighting, luxury streetwear campaign presentation",
    "High-end commercial photography quality, realistic fabric and drape",
    "No text overlays, no watermarks, no distorted anatomy",
  ];

  return segments.filter((part) => part && part.trim()).join(". ");
}
