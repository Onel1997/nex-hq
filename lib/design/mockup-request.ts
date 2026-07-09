import { z } from "zod";
import type { DesignStudioBrief } from "@/agents/design/studio-brief";
import type { DesignConcept } from "@/lib/design/ai-designer/types";
import type { DesignMissionAssets } from "@/lib/design/design-mission-store";

const FALLBACK = {
  designId: "design-mockup",
  title: "Untitled Design",
  collection: "Current Collection",
  garment: "Oversized Tee",
  colorway: "Neutral",
  placement: "Center chest graphic placement",
  productionMethod: "DTG print on premium cotton",
  prompt:
    "Premium fashion product mockup, studio lighting, editorial e-commerce quality, realistic garment drape",
  imagePrompt:
    "Editorial fashion product photography, luxury streetwear, soft studio key light",
  mockupPrompt:
    "Premium product mockup on neutral garment, studio cyclorama, commercial e-commerce framing",
} as const;

const looseString = z.union([z.string(), z.number()]).optional();

export const designMockupRequestInputSchema = z
  .object({
    brief: z.record(z.string(), z.unknown()).optional(),
    collectionName: looseString,
    collection: looseString,
    designId: looseString,
    title: looseString,
    garment: looseString,
    product: looseString,
    colorway: looseString,
    color: looseString,
    placement: looseString,
    printArea: looseString,
    prompt: looseString,
    imagePrompt: looseString,
    mockupPrompt: looseString,
    svgUrl: looseString,
    svgMarkup: looseString,
    productionMethod: looseString,
    assets: z.record(z.string(), z.unknown()).optional(),
    concept: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type DesignMockupRequestInput = z.infer<typeof designMockupRequestInputSchema>;

export interface NormalizedDesignMockupRequest {
  designId: string;
  title: string;
  collection: string;
  garment: string;
  colorway: string;
  placement: string;
  prompt: string;
  imagePrompt: string;
  mockupPrompt: string;
  svgUrl?: string;
  productionMethod: string;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asBrief(value: unknown): Partial<DesignStudioBrief> {
  if (!value || typeof value !== "object") return {};
  return value as Partial<DesignStudioBrief>;
}

function asAssets(value: unknown): Partial<DesignMissionAssets> {
  if (!value || typeof value !== "object") return {};
  return value as Partial<DesignMissionAssets>;
}

function asConcept(value: unknown): Partial<DesignConcept> | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as Partial<DesignConcept>;
}

function resolveConcept(
  input: DesignMockupRequestInput,
  assets: Partial<DesignMissionAssets>,
): Partial<DesignConcept> | undefined {
  return asConcept(input.concept) ?? assets.aiDesignerConcept;
}

export function normalizeDesignMockupRequest(
  input: DesignMockupRequestInput,
): NormalizedDesignMockupRequest {
  const brief = asBrief(input.brief);
  const assets = asAssets(input.assets);
  const concept = resolveConcept(input, assets);

  const title =
    asString(input.title) ||
    asString(brief.title) ||
    asString(concept?.title) ||
    FALLBACK.title;

  const collection =
    asString(input.collection) ||
    asString(input.collectionName) ||
    asString(concept?.collection) ||
    FALLBACK.collection;

  const garment =
    asString(input.garment) ||
    asString(input.product) ||
    asString(brief.product) ||
    asString(concept?.product) ||
    FALLBACK.garment;

  const colorway =
    asString(input.colorway) ||
    asString(input.color) ||
    asString(brief.color) ||
    asString(concept?.color) ||
    FALLBACK.colorway;

  const placement =
    asString(input.placement) ||
    asString(input.printArea) ||
    asString(brief.placement) ||
    asString(concept?.printArea) ||
    asString(concept?.productionNotes?.placement) ||
    FALLBACK.placement;

  const productionMethod =
    asString(input.productionMethod) ||
    asString(brief.productionMethod) ||
    asString(concept?.productionNotes?.method) ||
    FALLBACK.productionMethod;

  const imagePrompt =
    asString(input.imagePrompt) ||
    asString(concept?.imagePrompt?.primary) ||
    asString(brief.imagePrompt) ||
    FALLBACK.imagePrompt;

  const mockupPrompt =
    asString(input.mockupPrompt) ||
    asString(concept?.mockupPrompt?.primary) ||
    asString(brief.mockupPrompt) ||
    asString(input.prompt) ||
    FALLBACK.mockupPrompt;

  const prompt =
    asString(input.prompt) ||
    imagePrompt ||
    mockupPrompt ||
    FALLBACK.prompt;

  const svgUrl =
    asString(input.svgUrl) ||
    asString(assets.svgUrl) ||
    undefined;

  const designId =
    asString(input.designId) ||
    asString(brief.designId) ||
    asString(concept?.designId) ||
    FALLBACK.designId;

  return {
    designId,
    title,
    collection,
    garment,
    colorway,
    placement,
    prompt,
    imagePrompt,
    mockupPrompt,
    svgUrl,
    productionMethod,
  };
}

export function buildDesignMockupPayload(input: {
  brief: DesignStudioBrief;
  collectionName?: string;
  assets?: DesignMissionAssets;
  mockupPrompt?: string;
}): DesignMockupRequestInput {
  return {
    brief: input.brief as unknown as Record<string, unknown>,
    collectionName: input.collectionName,
    assets: input.assets as unknown as Record<string, unknown> | undefined,
    mockupPrompt: input.mockupPrompt,
  };
}

export function buildMockupGenerationPrompt(
  request: NormalizedDesignMockupRequest,
): string {
  const segments = [
    request.mockupPrompt,
    `Design: ${request.title}`,
    `Garment: ${request.garment}`,
    `Colorway: ${request.colorway}`,
    `Collection: ${request.collection}`,
    `Graphic placement: ${request.placement}`,
    `Production method: ${request.productionMethod}`,
    "Premium fashion e-commerce mockup, realistic studio lighting, luxury streetwear presentation",
    "No text overlays, no watermarks, no distorted anatomy",
  ];

  return segments.filter((part) => part && part.trim()).join(". ");
}
