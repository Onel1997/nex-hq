/**
 * Extract 68 facial landmarks via local face-api (server-only).
 * Shared model load with embedding evaluator — no paid providers.
 */

import type { LandmarkPoint } from "@/lib/persona/creation/reference-package/orientation-from-landmarks";

export type FaceLandmarks68Result = {
  status: "performed" | "no_face" | "multiple_faces" | "low_confidence" | "error";
  points: LandmarkPoint[] | null;
  detectionConfidence: number;
  faceCount: number;
  reason: string;
  safeErrorMessage?: string;
};

/**
 * Load image bytes and return 68 landmark positions when a single face is found.
 */
export async function extractFaceLandmarks68(
  imageBytes: Buffer,
): Promise<FaceLandmarks68Result> {
  try {
    // Dynamic imports keep this server-only and avoid client bundling.
    const faceMod = await import("./local-face-embedding-evaluator");
    // Access internal model loader via a dedicated export added below.
    const { loadFaceApiForLandmarks, decodeImageForFaceApi } = faceMod as unknown as {
      loadFaceApiForLandmarks: () => Promise<typeof import("@vladmandic/face-api")>;
      decodeImageForFaceApi: (
        bytes: Buffer,
      ) => Promise<{ img: unknown; width: number; height: number }>;
    };

    const faceapi = await loadFaceApiForLandmarks();
    const { img } = await decodeImageForFaceApi(imageBytes);

    const allDetections = await faceapi.detectAllFaces(
      img as never,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }),
    );

    if (allDetections.length === 0) {
      return {
        status: "no_face",
        points: null,
        detectionConfidence: 0,
        faceCount: 0,
        reason: "No face detected for orientation.",
      };
    }
    if (allDetections.length > 1) {
      return {
        status: "multiple_faces",
        points: null,
        detectionConfidence: allDetections[0]?.score ?? 0,
        faceCount: allDetections.length,
        reason: "Multiple faces — orientation uncertain.",
      };
    }

    const full = await faceapi
      .detectSingleFace(
        img as never,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }),
      )
      .withFaceLandmarks();

    if (!full) {
      return {
        status: "no_face",
        points: null,
        detectionConfidence: 0,
        faceCount: 0,
        reason: "Landmark pass returned no face.",
      };
    }

    const score = full.detection.score;
    if (score < 0.35) {
      return {
        status: "low_confidence",
        points: null,
        detectionConfidence: score,
        faceCount: 1,
        reason: "Low detection confidence for landmarks.",
      };
    }

    const positions = full.landmarks.positions.map((p) => ({
      x: p.x,
      y: p.y,
    }));

    return {
      status: "performed",
      points: positions,
      detectionConfidence: score,
      faceCount: 1,
      reason: "68 landmarks extracted.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      points: null,
      detectionConfidence: 0,
      faceCount: 0,
      reason: "Landmark extraction error.",
      safeErrorMessage: message.slice(0, 400),
    };
  }
}
