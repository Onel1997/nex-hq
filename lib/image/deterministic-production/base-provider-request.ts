import type {
  ImageGenerationRequest,
  ImageProviderIdentityInput,
} from "@/agents/image/providers/image-provider";
import type { ImageGenerationInputSnapshotV2 } from "@/lib/image/paid-generation/types-v2";
import { printReadyStageAPromptLines } from "@/lib/image/deterministic-runtime/print-ready-stage-a";

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
      "STAGE A BLANK-GARMENT CONTRACT: Generate the person, plain garment, pose, lighting, and scene base only.",
      "The entire visible target side of the garment must be a clean, solid-color, completely blank and unprinted fabric surface.",
      "Product reference images may contain unrelated legacy artwork, logos, brand text, labels, or prints. Treat all such reference graphics as contamination: never copy, transcribe, approximate, preserve, or recreate them.",
      "Use Product references only for garment silhouette, cut, fit, material, color, seams, collar, sleeves, pockets, and construction.",
      "No graphic, typography, logo, emblem, placeholder print, ghost print, watermark, or decorative mark may appear in or around the printable garment area.",
      "The final approved Artwork is intentionally absent from Stage A and must not be inferred or invented.",
      ...(snapshot.printReadyStageA ? printReadyStageAPromptLines() : []),
      `Keep the complete ${snapshot.printSurface.region} garment area blank, visually unobstructed, and suitable for later deterministic compositing.`,
      "Keep the target print zone frontally readable, gently tensioned, and shaped by only mild natural body curvature and fine fabric texture. Keep major folds, hands, hair, straps, accessories, props, and seams away from that zone so exact deterministic print application remains readable.",
      "Render premium commercial fashion or product photography with deliberate art direction, coherent high-quality props, polished material detail, clean visual hierarchy, and a maintained contemporary environment. Never choose scenery or cultural cues from the person's ethnicity or appearance.",
      snapshot.baseGeneration.prompt,
      "FINAL STAGE A CHECK: the garment print zone contains zero graphic, logo, text, decoration, watermark, or ghost print. It is a clean blank fabric canvas; approved Artwork will be applied only after this provider step.",
    ].join("\n"),
    dimensions: snapshot.baseGeneration.dimensions,
    qualityOverride: snapshot.baseGeneration.quality,
    assetType: snapshot.shot.assetType,
    identity: input.identity,
    production: {
      product: snapshot.product,
      productVisualInput: snapshot.productVisualInput,
      printSurface: snapshot.printSurface,
      creativeDirection: snapshot.creativeDirection,
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
