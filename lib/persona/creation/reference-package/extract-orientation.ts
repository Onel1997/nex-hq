/**
 * Phase 2.3D.6 — Extract 68 facial landmarks from image bytes (local face-api).
 * SERVER-ONLY. No paid providers.
 */

import {
  estimateOrientationFromLandmarks,
  type LandmarkPoint,
  type OrientationEstimate,
} from "./orientation-from-landmarks";

export type FaceLandmarkExtractionResult =
  | ({
      status: "performed";
      points: LandmarkPoint[];
      detectionConfidence: number;
      faceCount: number;
    } & OrientationEstimate)
  | {
      status: "no_face" | "multiple_faces" | "low_confidence" | "error";
      points: null;
      detectionConfidence: number;
      faceCount: number;
      detected_orientation: "uncertain";
      detected_yaw_degrees: null;
      noseSide: "uncertain";
      bothEyesVisible: false;
      noseOffsetNorm: null;
      reason: string;
      safeErrorMessage?: string;
    };

/**
 * Detect face landmarks and estimate orientation from image bytes.
 */
export async function extractFaceOrientationFromImageBytes(
  imageBytes: Buffer,
): Promise<FaceLandmarkExtractionResult> {
  try {
    // Reuse the same model loader / canvas patch as embedding extraction.
    const { extractFaceLandmarks68 } = await import(
      "@/lib/persona/face-novelty-memory/local-face-landmarks"
    );
    const extracted = await extractFaceLandmarks68(imageBytes);
    if (extracted.status !== "performed" || !extracted.points) {
      return {
        status: extracted.status === "performed" ? "error" : extracted.status,
        points: null,
        detectionConfidence: extracted.detectionConfidence,
        faceCount: extracted.faceCount,
        detected_orientation: "uncertain",
        detected_yaw_degrees: null,
        noseSide: "uncertain",
        bothEyesVisible: false,
        noseOffsetNorm: null,
        reason: extracted.reason,
        safeErrorMessage: extracted.safeErrorMessage,
      };
    }

    const estimate = estimateOrientationFromLandmarks({
      points: extracted.points,
      detectionConfidence: extracted.detectionConfidence,
    });

    return {
      status: "performed",
      points: extracted.points,
      detectionConfidence: extracted.detectionConfidence,
      faceCount: extracted.faceCount,
      ...estimate,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      points: null,
      detectionConfidence: 0,
      faceCount: 0,
      detected_orientation: "uncertain",
      detected_yaw_degrees: null,
      noseSide: "uncertain",
      bothEyesVisible: false,
      noseOffsetNorm: null,
      reason: "Landmark extraction failed.",
      safeErrorMessage: message.slice(0, 400),
    };
  }
}
