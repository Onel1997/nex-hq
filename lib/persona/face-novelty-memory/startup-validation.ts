/**
 * Startup validation for the Face Novelty Memory system.
 *
 * Checks TensorFlow, model weights, and the embedding repository
 * so that misconfiguration surfaces at startup rather than silently
 * causing missed evaluations during discovery.
 *
 * Model directory MUST match LocalFaceEmbeddingEvaluator
 * (server-assets/face-api-models via model-assets.ts).
 *
 * Server-only.  Call from API route startup or instrumentation hooks.
 */

import * as path from "path";
import * as fs from "fs";
import {
  resolveFaceApiModelsDirectory,
  validateFaceApiModelFiles,
} from "./model-assets";

export interface FaceNoveltyStartupReport {
  ok: boolean;
  tensorflowLoaded: boolean;
  modelWeightsPresent: boolean;
  /** Absolute filesystem path used for model weights (same as evaluator). */
  modelsDirectory: string;
  evaluatorModuleReachable: boolean;
  embeddingRepoReachable: boolean;
  migrationAvailable: boolean;
  warnings: string[];
  errors: string[];
}

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

  // 2. Model weights — same directory as LocalFaceEmbeddingEvaluator.
  let modelWeightsPresent = false;
  let modelsDirectory = "";
  try {
    modelsDirectory = resolveFaceApiModelsDirectory();
    const validation = validateFaceApiModelFiles();
    modelsDirectory = validation.modelsDir;
    if (!validation.ok) {
      errors.push(
        `Missing face model weight files under ${validation.modelsDir}: ${validation.missing.join(", ")}. Run: npm run copy:face-api-models`,
      );
    } else {
      modelWeightsPresent = true;
    }
  } catch (err) {
    errors.push(
      `Face-api model path validation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    try {
      modelsDirectory = resolveFaceApiModelsDirectory();
    } catch {
      modelsDirectory = path.join(process.cwd(), "server-assets", "face-api-models");
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
      { errors, warnings, modelsDirectory },
    );
  }

  return {
    ok,
    tensorflowLoaded,
    modelWeightsPresent,
    modelsDirectory,
    evaluatorModuleReachable,
    embeddingRepoReachable,
    migrationAvailable,
    warnings,
    errors,
  };
}
