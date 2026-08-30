import type { VideoGenerationInputV1 } from "./types";

export type VideoProviderCapabilities = {
  provider: string;
  imageToVideo: boolean;
  referenceImages: boolean;
  supportedDurations: number[];
  aspectRatios: string[];
  maxResolution: string | null;
  cameraControls: boolean;
  seed: boolean;
  audio: boolean;
  identityReference: boolean;
  productReferences: boolean;
  asyncStatus: boolean;
  verifiedFrom: "REPOSITORY" | "UNVERIFIED_EXTERNAL_DOCS";
};
export type VideoProviderOutput = {
  bytes: Buffer;
  mimeType: string;
  checksum: string;
  providerRequestId: string;
  width: number | null;
  height: number | null;
  codec: string | null;
  container: string | null;
  provenance: Record<string, unknown>;
};
export interface VideoProvider {
  capabilities(): VideoProviderCapabilities;
  estimate(
    input: VideoGenerationInputV1,
  ): Promise<{
    minimum: number;
    maximum: number;
    currency: string;
    basis: string;
    providerCallCount: 1;
  }>;
  generate(input: VideoGenerationInputV1): Promise<VideoProviderOutput>;
  getStatus(
    requestId: string,
  ): Promise<"RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN">;
  reconcile(requestId: string): Promise<"NO_CHARGE" | "CHARGED" | "UNKNOWN">;
}

/** Repository-verified matrix only. No external provider capability is asserted. */
export const VIDEO_PROVIDER_CAPABILITY_MATRIX: VideoProviderCapabilities[] = [
  {
    provider: "nexhq-synthetic-video-v1",
    imageToVideo: true,
    referenceImages: false,
    supportedDurations: [3, 5, 8, 10],
    aspectRatios: ["9:16", "4:5", "1:1", "16:9"],
    maxResolution: "metadata-fixture",
    cameraControls: true,
    seed: true,
    audio: false,
    identityReference: false,
    productReferences: false,
    asyncStatus: false,
    verifiedFrom: "REPOSITORY",
  },
];
