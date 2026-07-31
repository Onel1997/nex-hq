/**
 * Stable face-api model asset paths — shared by evaluator, startup validation,
 * and preflight. Never resolve via webpack/RSC require.resolve.
 *
 * Models live under: server-assets/face-api-models/
 * Copied from @vladmandic/face-api/model by scripts/copy-face-api-models.mjs
 */

import * as fs from "fs";
import * as path from "path";

/** Relative directory under process.cwd() — real filesystem only. */
export const FACE_API_MODELS_RELATIVE_DIR = path.join(
  "server-assets",
  "face-api-models",
);

/**
 * Required files for LocalFaceEmbeddingEvaluator nets:
 *   - ssdMobilenetv1
 *   - faceLandmark68Net
 *   - faceRecognitionNet
 */
export const REQUIRED_FACE_API_MODEL_FILES = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "ssd_mobilenetv1_model.bin",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model.bin",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model.bin",
] as const;

export type FaceApiModelValidation = {
  modelsDir: string;
  ok: boolean;
  missing: string[];
  present: string[];
};

/**
 * Resolve the application-owned model directory.
 * Always rooted at process.cwd() — never require.resolve / import.meta.
 */
export function resolveFaceApiModelsDirectory(
  cwd: string = process.cwd(),
): string {
  const modelsDir = path.resolve(cwd, FACE_API_MODELS_RELATIVE_DIR);
  assertRealFilesystemModelPath(modelsDir);
  return modelsDir;
}

/**
 * Reject webpack/RSC virtual paths and numeric module IDs.
 */
export function assertRealFilesystemModelPath(modelsDir: string): void {
  if (!modelsDir || typeof modelsDir !== "string") {
    throw new Error("Face-api model path must be a non-empty string");
  }
  if (modelsDir.includes("/(rsc)/") || modelsDir.includes("\\(rsc)\\")) {
    throw new Error(
      `Face-api model path must not contain RSC virtual segment /(rsc)/: ${modelsDir}`,
    );
  }
  // Webpack sometimes resolves packages to numeric module IDs.
  if (/[/\\]\d+[/\\]/.test(modelsDir) && modelsDir.includes("node_modules") === false) {
    // Only flag bare numeric path segments that look like webpack IDs when
    // they appear as the sole package identity (e.g. "/12345/model").
  }
  if (/^\/?\d+$/.test(modelsDir.trim()) || /node_modules\/\d+(\/|$)/.test(modelsDir)) {
    throw new Error(
      `Face-api model path must not use a numeric webpack module ID: ${modelsDir}`,
    );
  }
  if (modelsDir.includes("webpack:") || modelsDir.includes("turbopack://")) {
    throw new Error(
      `Face-api model path must not be a virtual bundle URL: ${modelsDir}`,
    );
  }
}

export function listMissingFaceApiModelFiles(modelsDir: string): string[] {
  assertRealFilesystemModelPath(modelsDir);
  return REQUIRED_FACE_API_MODEL_FILES.filter(
    (file) => !fs.existsSync(path.join(modelsDir, file)),
  );
}

/**
 * Validate that every required manifest and shard exists on disk.
 */
export function validateFaceApiModelFiles(
  cwd: string = process.cwd(),
): FaceApiModelValidation {
  const modelsDir = resolveFaceApiModelsDirectory(cwd);
  const missing = listMissingFaceApiModelFiles(modelsDir);
  const present = REQUIRED_FACE_API_MODEL_FILES.filter(
    (file) => !missing.includes(file),
  );
  return {
    modelsDir,
    ok: missing.length === 0,
    missing: [...missing],
    present: [...present],
  };
}

/**
 * Throw a precise error listing every missing file.
 */
export function assertFaceApiModelsPresent(cwd: string = process.cwd()): string {
  const result = validateFaceApiModelFiles(cwd);
  if (!result.ok) {
    throw new Error(
      `Face-api model weights missing under ${result.modelsDir}. ` +
        `Missing files: ${result.missing.join(", ")}. ` +
        `Run: npm run copy:face-api-models`,
    );
  }
  if (!fs.existsSync(result.modelsDir)) {
    throw new Error(
      `Face-api model directory does not exist on disk: ${result.modelsDir}`,
    );
  }
  const stat = fs.statSync(result.modelsDir);
  if (!stat.isDirectory()) {
    throw new Error(
      `Face-api model path is not a directory: ${result.modelsDir}`,
    );
  }
  return result.modelsDir;
}
