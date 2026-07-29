/**
 * Startup validation for the Face Novelty Memory system.
 *
 * Checks TensorFlow, model weights, and the embedding repository
 * so that misconfiguration surfaces at startup rather than silently
 * causing missed evaluations during discovery.
 *
 * Server-only.  Call from API route startup or instrumentation hooks.
 */

import * as path from "path";
import * as fs from "fs";

export interface FaceNoveltyStartupReport {
  ok: boolean;
  tensorflowLoaded: boolean;
  modelWeightsPresent: boolean;
  evaluatorModuleReachable: boolean;
  embeddingRepoReachable: boolean;
  migrationAvailable: boolean;
  warnings: string[];
  errors: string[];
}

function getModelsPath(): string | null {
  try {
    const resolved = require.resolve("@vladmandic/face-api/package.json");
    if (typeof resolved !== "string") return null;
    return path.join(path.dirname(resolved), "model");
  } catch {
    const fallback = path.join(process.cwd(), "node_modules/@vladmandic/face-api/model");
    return fallback;
  }
}

const MODELS_PATH = getModelsPath();

const REQUIRED_MODEL_FILES = [
  "ssd_mobilenetv1_model-weights_manifest.json",
  "face_landmark_68_model-weights_manifest.json",
  "face_recognition_model-weights_manifest.json",
];

const MIGRATION_FILE = path.join(
  process.cwd(),
  "supabase/migrations/20260729110000_persona_face_novelty_embeddings.sql",
);

export async function runFaceNoveltyStartupValidation(): Promise<FaceNoveltyStartupReport> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. TensorFlow
  let tensorflowLoaded = false;
  try {
    await import("@tensorflow/tfjs-node");
    tensorflowLoaded = true;
  } catch (err) {
    errors.push(
      `TensorFlow not loaded: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 2. Model weights on disk
  let modelWeightsPresent = false;
  if (!MODELS_PATH) {
    errors.push("@vladmandic/face-api not found — model weights path unresolvable");
  } else {
    const missing = REQUIRED_MODEL_FILES.filter(
      (f) => !fs.existsSync(path.join(MODELS_PATH, f)),
    );
    if (missing.length > 0) {
      errors.push(`Missing face model weight files: ${missing.join(", ")}`);
    } else {
      modelWeightsPresent = true;
    }
  }

  // 3. Evaluator module reachable
  let evaluatorModuleReachable = false;
  try {
    await import("./local-face-embedding-evaluator");
    evaluatorModuleReachable = true;
  } catch (err) {
    errors.push(
      `local-face-embedding-evaluator module failed to load: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 4. Embedding repo (structural check — no live DB call at startup)
  let embeddingRepoReachable = false;
  try {
    const { SupabaseEmbeddingRepository } = await import("./supabase-embedding-repository");
    new SupabaseEmbeddingRepository();
    embeddingRepoReachable = true;
  } catch (err) {
    errors.push(
      `SupabaseEmbeddingRepository failed to instantiate: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 5. Migration file present
  const migrationAvailable = fs.existsSync(MIGRATION_FILE);
  if (!migrationAvailable) {
    warnings.push(
      `Migration file not found at expected path: ${MIGRATION_FILE}. Ensure the embedding columns migration has been applied.`,
    );
  }

  const ok =
    tensorflowLoaded &&
    modelWeightsPresent &&
    evaluatorModuleReachable &&
    embeddingRepoReachable &&
    errors.length === 0;

  if (!ok) {
    console.warn(
      "[FaceNovelty] Startup validation FAILED — face similarity will not protect discovery.",
      { errors, warnings },
    );
  }

  return {
    ok,
    tensorflowLoaded,
    modelWeightsPresent,
    evaluatorModuleReachable,
    embeddingRepoReachable,
    migrationAvailable,
    warnings,
    errors,
  };
}
