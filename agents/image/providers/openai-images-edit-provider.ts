/**
 * OpenAI Images Edit — identity-conditioned generation from a Master reference image.
 * Text-only generation is forbidden on this path.
 */

import { toFile } from "openai";
import type { Image } from "openai/resources/images";
import { getOpenAIClient } from "@/lib/openai/client";
import {
  getOpenAiImageModel,
  type OpenAiImageSize,
} from "@/lib/image/image-generation-config";
import {
  extractOpenAiErrorDetails,
  OPENAI_QUOTA_USER_MESSAGE,
  toOpenAiQuotaError,
} from "@/agents/image/generation-errors";

export const OPENAI_STAGE_B_IMAGE_EDIT_PATH =
  "openai.images.edit(gpt-image-1, image=master, input_fidelity=high)" as const;

export type OpenAiIdentityEditRequest = {
  prompt: string;
  /** Required Master Identity image bytes — FAIL CLOSED if missing. */
  referenceImageBytes: Buffer;
  referenceMimeType?: string;
  size?: OpenAiImageSize;
  quality?: "low" | "medium" | "high" | "auto";
  signal?: AbortSignal;
};

export type OpenAiIdentityEditResult = {
  prompt: string;
  status: "completed";
  providerId: "openai";
  imageBytes: Buffer;
  providerRequestId: string | null;
  path: typeof OPENAI_STAGE_B_IMAGE_EDIT_PATH;
  inputFidelity: "high";
};

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
  throw new Error("OpenAI Images edit returned no b64_json or url");
}

/**
 * Generate an angle/reference image conditioned on the Master Identity portrait.
 * Never falls back to images.generate (text-only).
 */
export async function editOpenAiImageFromReference(
  request: OpenAiIdentityEditRequest,
): Promise<OpenAiIdentityEditResult> {
  if (!request.referenceImageBytes?.length) {
    throw new Error(
      "FAIL CLOSED: Master Identity image bytes are required. " +
        "Text-only OpenAI images.generate is forbidden for Stage B reference package.",
    );
  }
  if (!request.prompt?.trim()) {
    throw new Error("Stage B edit prompt is required.");
  }

  const model = getOpenAiImageModel();
  const openai = getOpenAIClient();
  const mime = request.referenceMimeType || "image/png";
  const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
  const imageFile = await toFile(request.referenceImageBytes, `master.${ext}`, {
    type: mime,
  });

  const payload = {
    model,
    image: imageFile,
    prompt: request.prompt,
    n: 1,
    size: request.size ?? ("1024x1536" as OpenAiImageSize),
    quality: request.quality ?? "medium",
    input_fidelity: "high" as const,
  };

  console.info("[OpenAI Images Edit] Stage B identity reference", {
    path: OPENAI_STAGE_B_IMAGE_EDIT_PATH,
    model: payload.model,
    size: payload.size,
    quality: payload.quality,
    inputFidelity: payload.input_fidelity,
    promptLength: payload.prompt.length,
    referenceBytes: request.referenceImageBytes.length,
  });

  try {
    const response = await openai.images.edit(
      payload as Parameters<typeof openai.images.edit>[0],
      request.signal ? { signal: request.signal } : undefined,
    );
    const providerRequestId =
      typeof (response as { _request_id?: unknown })._request_id === "string"
        ? (response as { _request_id: string })._request_id
        : null;

    const data =
      response && typeof response === "object" && "data" in response
        ? (response as { data?: Image[] }).data
        : undefined;
    const item = data?.[0];
    if (!item) {
      throw new Error("OpenAI Images edit returned no image data");
    }

    const imageBytes = await decodeOpenAiImageItem(item);
    return {
      prompt: request.prompt,
      status: "completed",
      providerId: "openai",
      imageBytes,
      providerRequestId,
      path: OPENAI_STAGE_B_IMAGE_EDIT_PATH,
      inputFidelity: "high",
    };
  } catch (error) {
    const quotaError = toOpenAiQuotaError(error, model);
    if (quotaError) {
      const details = extractOpenAiErrorDetails(error, model);
      console.error("[OpenAI Images Edit] Quota exceeded", {
        model: details.model,
        requestId: details.requestId,
        message: OPENAI_QUOTA_USER_MESSAGE,
      });
      throw quotaError;
    }
    throw error;
  }
}

/** Capability probe — Stage B must use this path, never text-only generate. */
export function assertStageBUsesImageReferencePath(params: {
  hasMasterImageBytes: boolean;
  allowTextOnlyFallback?: boolean;
}): void {
  if (params.allowTextOnlyFallback) {
    throw new Error(
      "FAIL CLOSED: Text-only fallback is forbidden for Stage B identity references.",
    );
  }
  if (!params.hasMasterImageBytes) {
    throw new Error(
      "FAIL CLOSED: Stage B requires Master Identity image bytes for openai.images.edit.",
    );
  }
}
