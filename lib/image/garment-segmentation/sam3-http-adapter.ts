import { createHash } from "node:crypto";

import { z } from "zod";

import {
  SAM3_HTTP_ADAPTER_VERSION,
  segmentationBoundsSchema,
  type GarmentSegmentationProvider,
  type GarmentSegmentationProviderDescriptor,
  type GarmentSegmentationProviderInput,
  type GarmentSegmentationProviderResult,
  type GarmentSegmentationPolicy,
} from "@/lib/image/garment-segmentation/types";

const responseSchema = z
  .object({
    provider: z.string().min(1).default("SAM3"),
    model: z.string().min(1),
    providerVersion: z.string().min(1),
    providerRequestId: z.string().min(1).nullable().default(null),
    sourceBaseChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    jobId: z.string().uuid(),
    candidates: z.array(
      z
        .object({
          candidateId: z.string().min(1),
          maskPngBase64: z.string().min(1),
          maskWidth: z.number().int().positive(),
          maskHeight: z.number().int().positive(),
          bounds: segmentationBoundsSchema.nullable().default(null),
          confidence: z.number().min(0).max(1).nullable().default(null),
        })
        .strict(),
    ),
  })
  .strict();

export type Sam3HttpConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
  maximumCostUsd: number;
};

function readConfig(): Sam3HttpConfig | null {
  const endpoint = process.env.NEXHQ_SAM3_SEGMENTATION_ENDPOINT?.trim();
  const apiKey = process.env.NEXHQ_SAM3_SEGMENTATION_API_KEY?.trim();
  const model = process.env.NEXHQ_SAM3_SEGMENTATION_MODEL?.trim();
  const costRaw = process.env.NEXHQ_SAM3_SEGMENTATION_COST_MAX_USD?.trim();
  const maximumCostUsd = costRaw == null ? Number.NaN : Number(costRaw);
  if (
    !endpoint ||
    !apiKey ||
    !model ||
    !Number.isFinite(maximumCostUsd) ||
    maximumCostUsd < 0
  ) {
    return null;
  }
  const parsed = new URL(endpoint);
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(
    parsed.hostname,
  );
  if (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) {
    throw new Error(
      "SAM 3 endpoint must use HTTPS, except for an explicit loopback service.",
    );
  }
  return { endpoint: parsed.toString(), apiKey, model, maximumCostUsd };
}

export function sam3SegmentationPolicyFromEnvironment(): GarmentSegmentationPolicy {
  const config = readConfig();
  if (!config) {
    throw new Error(
      "SAM-3-Kleidungssegmentierung ist serverseitig nicht vollständig konfiguriert.",
    );
  }
  return {
    contractVersion: "garment-segmentation-policy-v1",
    required: true,
    provider: "SAM3",
    adapterVersion: SAM3_HTTP_ADAPTER_VERSION,
    model: config.model,
    maximumCostUsd: config.maximumCostUsd,
  };
}

export function garmentSegmentationIdempotencyKey(input: {
  jobId: string;
  sourceBaseChecksumSha256: string;
  provider: string;
  model: string;
  adapterVersion: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.jobId,
        input.sourceBaseChecksumSha256,
        input.provider,
        input.model,
        input.adapterVersion,
      ].join(":"),
    )
    .digest("hex");
}

export class Sam3HttpGarmentSegmentationProvider
  implements GarmentSegmentationProvider
{
  constructor(
    private readonly request: typeof fetch = fetch,
    private readonly config: Sam3HttpConfig | null = readConfig(),
  ) {}

  isConfigured(): boolean {
    return this.config !== null;
  }

  describe(): GarmentSegmentationProviderDescriptor {
    if (!this.config) {
      throw new Error(
        "SAM-3-Kleidungssegmentierung ist serverseitig nicht vollständig konfiguriert.",
      );
    }
    return {
      provider: "SAM3",
      adapterVersion: SAM3_HTTP_ADAPTER_VERSION,
      model: this.config.model,
      maximumCostUsd: this.config.maximumCostUsd,
    };
  }

  async segmentGarment(
    input: GarmentSegmentationProviderInput,
  ): Promise<GarmentSegmentationProviderResult> {
    if (!this.config) {
      throw new Error(
        "SAM-3-Kleidungssegmentierung ist serverseitig nicht vollständig konfiguriert.",
      );
    }
    const form = new FormData();
    form.set(
      "image",
      new Blob([new Uint8Array(input.baseImage.bytes)], {
        type: input.baseImage.mimeType,
      }),
      "stage-a-base",
    );
    form.set("jobId", input.jobId);
    form.set("sourceBaseChecksumSha256", input.baseImage.checksumSha256);
    form.set("model", this.config.model);
    form.set("garmentType", input.garmentType);
    form.set("side", input.side);
    form.set("textPrompt", input.textPrompt);
    if (input.optionalRegistrationHint) {
      form.set(
        "registrationHint",
        JSON.stringify(input.optionalRegistrationHint),
      );
    }
    const response = await this.request(this.config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Idempotency-Key": input.idempotencyKey,
      },
      body: form,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`SAM 3 segmentation failed with HTTP ${response.status}.`);
    }
    const parsed = responseSchema.parse(await response.json());
    if (parsed.model !== this.config.model) {
      throw new Error("SAM 3 response model does not match the frozen request.");
    }
    return {
      ...parsed,
      candidates: parsed.candidates.map((candidate) => ({
        candidateId: candidate.candidateId,
        maskPngBytes: Buffer.from(candidate.maskPngBase64, "base64"),
        maskWidth: candidate.maskWidth,
        maskHeight: candidate.maskHeight,
        bounds: candidate.bounds,
        confidence: candidate.confidence,
      })),
    };
  }
}
