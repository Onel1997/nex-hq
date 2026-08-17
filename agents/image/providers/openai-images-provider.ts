import { getOpenAIClient } from "@/lib/openai/client";
import {
  buildOpenAiGenerationPayload,
  getImageGenerationMode,
  getOpenAiImageModel,
  stripUnknownOpenAiImagePayloadFields,
  type OpenAiImageGenerationPayload,
  type OpenAiImageSize,
} from "@/lib/image/image-generation-config";
import type { Image } from "openai/resources/images";
import {
  extractOpenAiErrorDetails,
  OPENAI_QUOTA_USER_MESSAGE,
  toOpenAiQuotaError,
} from "../generation-errors";
import type { ImageGenerationRequest, ImageGenerationResult } from "./image-provider";
import {
  editOpenAiImageFromReference,
  type OpenAiIdentityEditRequest,
} from "./openai-images-edit-provider";

/** @deprecated Use getOpenAiImageModel() from lib/image/image-generation-config */
export const OPENAI_IMAGE_MODEL = getOpenAiImageModel();

export type GptImageSize = OpenAiImageSize;

export function buildOpenAiImageRequest(
  request: ImageGenerationRequest,
): OpenAiImageGenerationPayload {
  return buildOpenAiGenerationPayload(
    request.prompt,
    request.dimensions,
    request.qualityOverride,
  );
}

export function buildOpenAiIdentityConditionedPrompt(
  request: ImageGenerationRequest & { identity: NonNullable<ImageGenerationRequest["identity"]> },
): string {
  const { constraints } = request.identity;
  const product = request.production?.product;
  const shot = request.production?.shot;
  const productRules = product
    ? [
        `PRODUCT: ${product.productName}; garment type: ${product.productType}.`,
        product.color ? `Garment color: ${product.color}.` : "Garment color is unknown; do not invent catalog precision.",
        product.material ? `Garment material: ${product.material}.` : "",
        product.fit ? `Garment fit/silhouette: ${product.fit}.` : "",
        product.size ? `Garment size context: ${product.size}.` : "",
        product.collection ? `Collection context: ${product.collection}.` : "",
        product.variantId
          ? `Use the exact selected product variant (${product.variantId}).`
          : "No precise variant is selected; do not imply an exact SKU or variant.",
      ].filter(Boolean)
    : [];
  const shotRules = shot
    ? [
        `HOW / WHERE: ${shot.shotTitle}.`,
        `Scene: ${shot.scene}.`,
        `Lighting: ${shot.lighting}.`,
        shot.poseDirection ? `Pose direction: ${shot.poseDirection}.` : "",
      ].filter(Boolean)
    : [];
  const identityRules = [
    request.artwork
      ? `Input image 1 is the authoritative Persona Master portrait for ${constraints.displayName} (WHO). Input image 2 is the exact approved Master Artwork (WHAT THEY WEAR).`
      : `The first and only identity reference is the authoritative Master portrait for ${constraints.displayName}.`,
    "Preserve the exact same person and stable facial identity. Do not substitute, blend, or invent another person.",
    request.artwork
      ? "Reproduce input image 2 as the exact approved final artwork on the garment. Do not redesign, restyle, rewrite, add to, remove from, or replace the artwork. Preserve its composition, typography, symbols, colors, and orientation. Never turn the artwork into facial features and never treat the Persona portrait as apparel artwork."
      : "",
    request.artwork?.placement ? `Artwork placement: ${request.artwork.placement}.` : "",
    request.artwork?.printMethod ? `Artwork print/render method: ${request.artwork.printMethod}.` : "",
    constraints.canonicalIdentityDescription,
    constraints.immutableFeatures,
    constraints.approvedAgeRange
      ? `Approved apparent age range: ${constraints.approvedAgeRange}.`
      : "",
    constraints.approvedHairVariations
      ? `Allowed hair variation: ${constraints.approvedHairVariations}.`
      : "",
    constraints.approvedExpressionRange
      ? `Allowed expression range: ${constraints.approvedExpressionRange}.`
      : "",
    constraints.approvedBodyProportions
      ? `Preserve body/frame characteristics: ${constraints.approvedBodyProportions}.`
      : "",
    constraints.prohibitedChanges
      ? `Prohibited identity changes: ${constraints.prohibitedChanges}.`
      : "",
    ...productRules,
    ...shotRules,
  ]
    .filter(Boolean)
    .join("\n");
  return `${identityRules}\n\nCampaign shot direction (scene, garment, pose, and lighting may change without changing identity):\n${request.prompt}`;
}

async function decodeOpenAiImageItem(item: Image): Promise<Buffer> {
  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }

  if (item.url) {
    const res = await fetch(item.url);
    if (!res.ok) {
      throw new Error(`Failed to fetch OpenAI image URL: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("OpenAI Images returned no b64_json or url");
}

export function isOpenAiImagesConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateOpenAiImage(
  request: ImageGenerationRequest,
  dependencies: {
    editFromMaster?: (
      request: OpenAiIdentityEditRequest,
    ) => ReturnType<typeof editOpenAiImageFromReference>;
  } = {},
): Promise<ImageGenerationResult & { imageBytes?: Buffer; providerRequestId?: string | null }> {
  const payload = stripUnknownOpenAiImagePayloadFields(buildOpenAiImageRequest(request));

  if (request.identity) {
    if (!request.identity.masterReference.bytes.length) {
      throw new Error(
        "FAIL CLOSED: selected Brand Model is missing authoritative Master reference bytes.",
      );
    }
    const edit = dependencies.editFromMaster ?? editOpenAiImageFromReference;
    const edited = await edit({
      prompt: buildOpenAiIdentityConditionedPrompt({
        ...request,
        identity: request.identity,
      }),
      referenceImageBytes: request.identity.masterReference.bytes,
      referenceMimeType: request.identity.masterReference.mimeType,
      ...(request.artwork
        ? { artworkReference: { bytes: request.artwork.bytes, mimeType: request.artwork.mimeType } }
        : {}),
      size: payload.size,
      quality: payload.quality,
      signal: request.signal,
    });
    return {
      prompt: request.prompt,
      dimensions: request.dimensions,
      assetType: request.assetType,
      status: "completed",
      providerId: "openai",
      modelId: payload.model,
      imageBytes: edited.imageBytes,
      providerRequestId: edited.providerRequestId,
      identityStrategy: request.artwork
        ? "openai_master_identity_and_artwork_edit_high_fidelity"
        : "openai_master_image_edit_high_fidelity",
    };
  }

  const openai = getOpenAIClient();

  console.info("[OpenAI Images] final payload keys:", Object.keys(payload));
  console.info("[OpenAI Images] Request payload", {
    generationMode: getImageGenerationMode(),
    model: payload.model,
    size: payload.size,
    quality: payload.quality,
    output_format: payload.output_format,
    promptLength: payload.prompt.length,
    assetDimensions: request.dimensions,
    hasResponseFormat: "response_format" in payload,
  });

  try {
    const response = await openai.images.generate(
      payload,
      request.signal ? { signal: request.signal } : undefined,
    );
    const providerRequestId =
      typeof (response as { _request_id?: unknown })._request_id === "string"
        ? (response as { _request_id: string })._request_id
        : null;

    const item = response.data?.[0];
    if (!item) {
      throw new Error("OpenAI Images returned no image data");
    }

    const imageBytes = await decodeOpenAiImageItem(item);

    return {
      prompt: request.prompt,
      dimensions: request.dimensions,
      assetType: request.assetType,
      status: "completed",
      providerId: "openai",
      modelId: payload.model,
      url: item.url,
      imageBytes,
      providerRequestId,
    };
  } catch (error) {
    const quotaError = toOpenAiQuotaError(error, payload.model);
    if (quotaError) {
      const details = extractOpenAiErrorDetails(error, payload.model);
      console.error("[OpenAI Images] Quota exceeded", {
        generationMode: getImageGenerationMode(),
        model: details.model,
        requestId: details.requestId,
        responseBody: details.responseBody,
        message: OPENAI_QUOTA_USER_MESSAGE,
      });
      throw quotaError;
    }
    throw error;
  }
}
