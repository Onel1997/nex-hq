import { createHash } from "node:crypto";

import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { DeterministicImageJob } from "@/lib/image/deterministic-runtime/types";
import { COMPOSITOR_VERSION_V3 } from "@/lib/image/artwork-compositing/types";

export interface ArtworkFidelityValidation {
  contractVersion: "deterministic-artwork-fidelity-validation-v1";
  artworkId: string;
  artworkVersion: string;
  sourceChecksumSha256: string;
  sourceWidth: number;
  sourceHeight: number;
  printSurfaceId: string;
  printSurfaceVersion: number;
  targetRegion: string;
  allowedTransforms: string[];
  substituteArtworkDetected: false;
}

export function validateArtworkFidelityInput(input: {
  job: DeterministicImageJob;
  artworkBytes: Buffer;
  sourceWidth: number;
  sourceHeight: number;
}): ArtworkFidelityValidation {
  const snapshot = input.job.inputSnapshot;
  const actual = createHash("sha256").update(input.artworkBytes).digest("hex");
  if (actual !== snapshot.masterArtwork.checksum) {
    throw new PersonaDomainError("Stored Artwork is not the exact approved source bound to this job.", "WORKFLOW");
  }
  if (!snapshot.printSurface.quad || snapshot.printSurface.geometryStatus === "REQUIRES_CALIBRATION") {
    throw new PersonaDomainError("PrintSurface is not calibrated.", "WORKFLOW");
  }
  const fabricAware =
    snapshot.compositing.compositorVersion === COMPOSITOR_VERSION_V3;
  return {
    contractVersion: "deterministic-artwork-fidelity-validation-v1",
    artworkId: snapshot.masterArtwork.artworkId,
    artworkVersion: snapshot.masterArtwork.version,
    sourceChecksumSha256: actual,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    printSurfaceId: snapshot.printSurface.printSurfaceId,
    printSurfaceVersion: snapshot.printSurface.version,
    targetRegion: snapshot.printSurface.region,
    allowedTransforms: fabricAware
      ? [
          "TRANSLATION",
          "UNIFORM_SCALING",
          "BOUNDED_PHYSICAL_DISPLACEMENT",
          "LOCAL_PHYSICAL_SHADING",
          "ALPHA_BLEND",
        ]
      : snapshot.compositing.artworkPlacementMode ===
          "CONTAIN_UNIFORM_ASPECT_LOCKED"
        ? [
            "TRANSLATION",
            "UNIFORM_SCALING",
            "UNIFORM_PHYSICAL_SHADING",
            "ALPHA_BLEND",
          ]
        : ["SCALING", "PERSPECTIVE_WARP", "CLIPPING", "ALPHA_BLEND"],
    substituteArtworkDetected: false,
  };
}
