import { createHash } from "node:crypto";
import type { VideoProvider, VideoProviderOutput } from "./provider";
import type { VideoGenerationInputV1 } from "./types";

export class DeterministicFakeVideoProvider implements VideoProvider {
  calls = 0;
  capabilities() {
    return {
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
      verifiedFrom: "REPOSITORY" as const,
    };
  }
  async estimate() {
    return {
      minimum: 0,
      maximum: 0,
      currency: "USD",
      basis:
        "Deterministischer lokaler Video-Metadaten-Fixture; kein Provider-Aufruf.",
      providerCallCount: 1 as const,
    };
  }
  async generate(input: VideoGenerationInputV1): Promise<VideoProviderOutput> {
    this.calls++;
    const bytes = Buffer.from(
      JSON.stringify({
        fixture: "nexhq-fake-video-v1",
        sourceImageAssetId: input.sourceVisual.sourceAssetId,
        direction: input.direction,
        assetCount: 1,
      }),
    );
    const checksum = createHash("sha256").update(bytes).digest("hex");
    return {
      bytes,
      mimeType: "application/vnd.nexhq.fake-video+json",
      checksum,
      providerRequestId: `fake-video-${checksum.slice(0, 16)}`,
      width: null,
      height: null,
      codec: null,
      container: "json",
      provenance: {
        synthetic: true,
        networkCalls: 0,
        sourceStrategy: "APPROVED_IMAGE_TO_VIDEO",
      },
    };
  }
  async getStatus() {
    return "SUCCEEDED" as const;
  }
  async reconcile() {
    return "NO_CHARGE" as const;
  }
}
