import type {
  ImageGenerationRequest,
  ImageProviderIdentityInput,
} from "@/agents/image/providers/image-provider";
import type { ImageGenerationInputSnapshotV2 } from "@/lib/image/paid-generation/types-v2";

export interface ResolvedProductReference {
  referenceId: string;
  role: string;
  mimeType: string;
  bytes: Buffer;
}

/**
 * Builds Stage A only. The return type deliberately has no Master Artwork field;
 * approved Artwork is consumed exclusively by Stage B deterministic compositing.
 */
export function buildDeterministicBaseProviderRequest(input: {
  snapshot: ImageGenerationInputSnapshotV2;
  identity: ImageProviderIdentityInput;
  productReferences: ResolvedProductReference[];
}): ImageGenerationRequest {
  const { snapshot } = input;
  if (snapshot.productionMode !== "DETERMINISTIC_COMPOSITE") {
    throw new Error("Deterministic base request requires DETERMINISTIC_COMPOSITE mode.");
  }
  return {
    prompt: [
      "Generate the clean person, garment, pose, lighting, and scene base only.",
      "The final approved artwork is intentionally not provided and must not be invented.",
      `Keep the ${snapshot.printSurface.region} garment area visually unobstructed and suitable for later calibrated compositing.`,
      snapshot.baseGeneration.prompt,
    ].join("\n"),
    dimensions: snapshot.baseGeneration.dimensions,
    qualityOverride: snapshot.baseGeneration.quality,
    assetType: snapshot.shot.assetType,
    identity: input.identity,
    production: {
      product: snapshot.product,
      productVisualInput: snapshot.productVisualInput,
      printSurface: snapshot.printSurface,
      productReferences: input.productReferences,
      shot: {
        scene: snapshot.shot.scene,
        lighting: snapshot.shot.lighting,
        poseDirection: snapshot.shot.poseDirection,
        shotTitle: snapshot.shot.title,
      },
    },
  };
}
