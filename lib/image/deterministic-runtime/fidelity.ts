import { createHash } from "node:crypto";

import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { DeterministicImageJob } from "@/lib/image/deterministic-runtime/types";

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
    allowedTransforms: ["SCALING", "PERSPECTIVE_WARP", "CLIPPING", "ALPHA_BLEND"],
    substituteArtworkDetected: false,
  };
}
