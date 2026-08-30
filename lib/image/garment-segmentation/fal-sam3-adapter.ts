import { createHash } from "node:crypto";

import { createFalClient } from "@fal-ai/client";
import { loadImage } from "canvas";
import { z } from "zod";

import {
  FAL_SAM3_ADAPTER_VERSION,
  FAL_SAM3_IMAGE_MODEL,
  type GarmentSegmentationProvider,
  type GarmentSegmentationProviderDescriptor,
  type GarmentSegmentationProviderInput,
  type GarmentSegmentationProviderResult,
} from "@/lib/image/garment-segmentation/types";

export const FAL_SAM3_DEFAULT_MAXIMUM_COST_USD = 0.005;

const falFileSchema = z
  .object({
    url: z.string().min(1),
    content_type: z.string().nullable().optional(),
    file_name: z.string().nullable().optional(),
    file_size: z.number().int().nonnegative().nullable().optional(),
    width: z.number().int().positive().nullable().optional(),
    height: z.number().int().positive().nullable().optional(),
  })
  .passthrough();

const normalizedBoxSchema = z
  .tuple([
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().positive().max(1),
    z.number().positive().max(1),
  ])
  .nullable();

const falOutputSchema = z
  .object({
    masks: z.array(falFileSchema),
    scores: z.array(z.number().min(0).max(1)).optional().default([]),
    boxes: z.array(normalizedBoxSchema).optional().default([]),
    metadata: z
      .array(
        z
          .object({
            index: z.number().int().nonnegative().optional(),
            score: z.number().min(0).max(1).nullable().optional(),
            box: normalizedBoxSchema.optional(),
          })
          .passthrough(),
      )
      .optional()
      .default([]),
  })
  .passthrough();

export type FalSam3Config = {
  apiKey: string;
  model: string;
  maximumCostUsd: number;
};

type FalSam3Input = {
  image_url: string;
  prompt: string;
  point_prompts: never[];
  box_prompts: never[];
  apply_mask: false;
  sync_mode: true;
  output_format: "png";
  return_multiple_masks: true;
  max_masks: 3;
  include_scores: true;
  include_boxes: true;
};

export type FalSam3Client = {
  subscribe(
    model: string,
    options: {
      input: FalSam3Input;
      logs: false;
      mode: "polling";
      headers: Record<string, string>;
      storageSettings: { expiresIn: "1h" };
    },
  ): Promise<{ data: unknown; requestId: string }>;
};

function parseMaximumCost(value: string | undefined): number {
  if (!value?.trim()) return FAL_SAM3_DEFAULT_MAXIMUM_COST_USD;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("NEXHQ_SAM3_COST_MAX_USD must be a non-negative number.");
  }
  return parsed;
}

export function readFalSam3Config(): FalSam3Config | null {
  const apiKey = process.env.FAL_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model:
      process.env.NEXHQ_SAM3_MODEL?.trim() || FAL_SAM3_IMAGE_MODEL,
    maximumCostUsd: parseMaximumCost(
      process.env.NEXHQ_SAM3_COST_MAX_USD,
    ),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function baseDataUri(input: GarmentSegmentationProviderInput): string {
  return `data:${input.baseImage.mimeType};base64,${input.baseImage.bytes.toString("base64")}`;
}

function isTrustedFalMediaHost(hostname: string): boolean {
  return ["fal.media", "fal.ai", "fal.run"].some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

async function readFalMaskBytes(
  value: string,
  request: typeof fetch,
): Promise<Buffer> {
  const data = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i.exec(
    value,
  );
  if (data) return Buffer.from(data[2]!, "base64");

  const url = new URL(value);
  if (url.protocol !== "https:" || !isTrustedFalMediaHost(url.hostname)) {
    throw new Error("fal SAM 3 returned an untrusted mask URL.");
  }
  const response = await request(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`fal SAM 3 mask download failed with HTTP ${response.status}.`);
  }
  const contentType = response.headers.get("content-type")?.toLowerCase();
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error("fal SAM 3 mask response was not an image.");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 50 * 1024 * 1024) {
    throw new Error("fal SAM 3 returned an invalid mask size.");
  }
  return bytes;
}

function boundsFromCenterBox(
  box: z.infer<typeof normalizedBoxSchema> | undefined,
) {
  if (!box) return null;
  const [centerX, centerY, width, height] = box;
  const left = Math.max(0, centerX - width / 2);
  const top = Math.max(0, centerY - height / 2);
  const right = Math.min(1, centerX + width / 2);
  const bottom = Math.min(1, centerY + height / 2);
  return {
    x: left,
    y: top,
    width: Math.max(Number.EPSILON, right - left),
    height: Math.max(Number.EPSILON, bottom - top),
  };
}

export class FalSam3GarmentSegmentationProvider
  implements GarmentSegmentationProvider
{
  private readonly client: FalSam3Client | null;

  constructor(
    private readonly config: FalSam3Config | null = readFalSam3Config(),
    client?: FalSam3Client,
    private readonly request: typeof fetch = fetch,
  ) {
    this.client =
      client ??
      (config
        ? (createFalClient({
            credentials: config.apiKey,
            // A lost submit response must not trigger a blind second paid
            // segmentation. NexHQ's atomic claim/idempotency boundary owns
            // retry decisions instead.
            retry: { maxRetries: 0 },
          }) as FalSam3Client)
        : null);
  }

  isConfigured(): boolean {
    return this.config !== null && this.client !== null;
  }

  describe(): GarmentSegmentationProviderDescriptor {
    if (!this.config || !this.client) {
      throw new Error(
        "fal-SAM-3-Kleidungssegmentierung ist serverseitig nicht konfiguriert.",
      );
    }
    return {
      provider: "fal",
      adapterVersion: FAL_SAM3_ADAPTER_VERSION,
      model: this.config.model,
      maximumCostUsd: this.config.maximumCostUsd,
    };
  }

  async segmentGarment(
    input: GarmentSegmentationProviderInput,
  ): Promise<GarmentSegmentationProviderResult> {
    const descriptor = this.describe();
    const result = await this.client!.subscribe(descriptor.model, {
      input: {
        image_url: baseDataUri(input),
        prompt: input.textPrompt,
        point_prompts: [],
        box_prompts: [],
        apply_mask: false,
        sync_mode: true,
        output_format: "png",
        return_multiple_masks: true,
        max_masks: 3,
        include_scores: true,
        include_boxes: true,
      },
      logs: false,
      mode: "polling",
      headers: {
        "Idempotency-Key": input.idempotencyKey,
        "X-NexHQ-Request-Binding": sha256(
          `${input.jobId}:${input.baseImage.checksumSha256}`,
        ),
      },
      storageSettings: { expiresIn: "1h" },
    });
    const parsed = falOutputSchema.parse(result.data);
    const candidates = await Promise.all(
      parsed.masks.map(async (mask, index) => {
        const bytes = await readFalMaskBytes(mask.url, this.request);
        const decoded = await loadImage(bytes);
        if (
          (mask.width != null && mask.width !== decoded.width) ||
          (mask.height != null && mask.height !== decoded.height)
        ) {
          throw new Error("fal SAM 3 mask metadata dimensions do not match its bytes.");
        }
        const metadata = parsed.metadata.find(
          (entry) => (entry.index ?? index) === index,
        );
        return {
          candidateId: `fal-mask-${index}`,
          maskPngBytes: bytes,
          maskWidth: decoded.width,
          maskHeight: decoded.height,
          bounds: boundsFromCenterBox(
            parsed.boxes[index] ?? metadata?.box,
          ),
          confidence:
            parsed.scores[index] ?? metadata?.score ?? null,
        };
      }),
    );
    return {
      provider: "fal",
      model: descriptor.model,
      providerVersion: FAL_SAM3_ADAPTER_VERSION,
      providerRequestId: result.requestId || null,
      sourceBaseChecksumSha256: input.baseImage.checksumSha256,
      jobId: input.jobId,
      candidates,
    };
  }
}
