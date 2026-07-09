import type { BrainImageSections, BrainReportContent } from "@/brain/domains/reports";
import { getBrainClient } from "@/brain/client";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { normalizeImageSections } from "./migrate-legacy";
import { findImageAsset } from "./normalized";
import { generateWithProvider, isImageProviderConfigured } from "./providers/registry";
import { uploadImageAsset } from "./storage";
import {
  ImageOpenAiQuotaExceededError,
  OPENAI_QUOTA_USER_MESSAGE,
  toOpenAiQuotaError,
} from "./generation-errors";
import { getOpenAiImageModel } from "@/lib/image/image-generation-config";
import type { ImageGenerationResult } from "./providers/image-provider";
import type { ImageGenerateRequest, ImageGenerateResult } from "./types-generation";
import type { ImageStudioAsset } from "./studio-schema";

async function resolveProviderImageBytes(
  result: ImageGenerationResult & { imageBytes?: Buffer },
): Promise<Buffer> {
  if (result.imageBytes) {
    return result.imageBytes;
  }

  if (result.url) {
    const res = await fetch(result.url);
    if (!res.ok) {
      throw new Error(`Failed to fetch provider image URL: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error("Image provider returned no image data");
}

export class ImageProviderNotConfiguredError extends Error {
  readonly provider: ImageGenerateRequest["provider"];

  constructor(provider: ImageGenerateRequest["provider"]) {
    const dict = getDictionary(DEFAULT_LOCALE);
    super(dict.image.errors.providerNotConfigured);
    this.name = "ImageProviderNotConfiguredError";
    this.provider = provider;
  }
}

function updateAssetInSections(
  sections: BrainImageSections,
  assetId: string,
  patch: Partial<ImageStudioAsset>,
): BrainImageSections {
  const updateList = (list: BrainImageSections["productionAssets"]) =>
    (list ?? []).map((asset) =>
      asset.id === assetId ? { ...asset, ...patch } : asset,
    );

  const productionAssets = updateList(sections.productionAssets);

  return {
    ...sections,
    productionAssets,
  };
}

export async function generateImageAsset(input: {
  workspaceId: string;
  request: ImageGenerateRequest;
}): Promise<ImageGenerateResult> {
  const { request } = input;

  if (!isImageProviderConfigured(request.provider)) {
    throw new ImageProviderNotConfiguredError(request.provider);
  }

  const brain = getBrainClient();
  const record = await brain.getRecord("reports", request.reportRecordId);
  if (!record) {
    throw new Error("Image project not found in Brain");
  }

  const content = record.content as BrainReportContent;
  const imageSections = normalizeImageSections(content.imageSections);
  if (!imageSections || content.reportId !== request.reportId) {
    throw new Error("Invalid image project record");
  }

  const asset = findImageAsset(
    { productionAssets: imageSections.productionAssets as ImageStudioAsset[] },
    request.assetId,
  );
  if (!asset) {
    throw new Error(`Asset not found: ${request.assetId}`);
  }

  const prompt =
    request.promptVariant === "flux"
      ? asset.prompt.flux
      : request.promptVariant === "midjourney"
        ? asset.prompt.midjourney
        : asset.prompt.openai;

  await brain.updateRecord(
    "reports",
    request.reportRecordId,
    {
      content: {
        imageSections: updateAssetInSections(imageSections, asset.id, {
          status: "generating",
        }),
      },
    },
    { type: "agent", id: "image" },
  );

  try {
    const result = await generateWithProvider(request.provider, {
      prompt,
      dimensions: asset.dimensions ?? "2048x2048",
      assetType: asset.assetType,
    });

    const imageBytes = await resolveProviderImageBytes(result);

    const uploaded = await uploadImageAsset({
      workspaceId: input.workspaceId,
      reportId: request.reportId,
      assetKey: `${asset.id}:${request.provider}`,
      imageBytes,
    });

    const completedPatch: Partial<ImageStudioAsset> = {
      status: "completed",
      imageUrl: uploaded.url,
      createdAt: new Date().toISOString(),
      message: undefined,
    };

    const refreshed = await brain.getRecord("reports", request.reportRecordId);
    const refreshedSections = (refreshed?.content as BrainReportContent)
      ?.imageSections;

    await brain.updateRecord(
      "reports",
      request.reportRecordId,
      {
        content: {
          imageSections: updateAssetInSections(
            refreshedSections ?? imageSections,
            asset.id,
            completedPatch,
          ),
        },
      },
      { type: "agent", id: "image" },
    );

    return {
      asset: {
        id: asset.id,
        title: asset.title ?? asset.productName,
        type: asset.assetType,
        dimensions: asset.dimensions ?? "2048x2048",
        platform: asset.platform,
        provider: request.provider,
        status: "completed",
        imageUrl: uploaded.url,
        storagePath: uploaded.storagePath,
        createdAt: completedPatch.createdAt,
      },
      providerConfigured: true,
    };
  } catch (error) {
    const quotaError = toOpenAiQuotaError(error, getOpenAiImageModel());
    const message = quotaError
      ? OPENAI_QUOTA_USER_MESSAGE
      : error instanceof Error
        ? error.message
        : "Image generation failed";

    const refreshed = await brain.getRecord("reports", request.reportRecordId);
    const refreshedSections = (refreshed?.content as BrainReportContent)
      ?.imageSections;

    await brain.updateRecord(
      "reports",
      request.reportRecordId,
      {
        content: {
          imageSections: updateAssetInSections(
            refreshedSections ?? imageSections,
            asset.id,
            quotaError
              ? {
                  status: "pending",
                  message,
                }
              : {
                  status: "failed",
                  message,
                  createdAt: new Date().toISOString(),
                },
          ),
        },
      },
      { type: "agent", id: "image" },
    );

    if (quotaError) {
      throw quotaError;
    }
    throw error;
  }
}
