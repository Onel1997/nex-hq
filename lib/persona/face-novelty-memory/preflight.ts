/**
 * Development-only Face Novelty Preflight.
 *
 * Checks readiness for a controlled paid live novelty test.
 * NEVER calls OpenAI or any paid image provider.
 */

import * as path from "path";
import * as fs from "fs";
import { isPersonaFaceNoveltyDebugEnabled } from "./live-debug";
import { resolveEvaluatorFailureMode } from "./local-face-embedding-evaluator";
import { runFaceNoveltyStartupValidation } from "./startup-validation";

export type FaceNoveltyPreflightCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

export type FaceNoveltyPreflightReport = {
  ready: boolean;
  verdict: "READY FOR CONTROLLED LIVE TEST" | "NOT READY";
  checks: FaceNoveltyPreflightCheck[];
  priorNoveltyHistoryCount: number;
  priorEmbeddingCount: number;
  featureFlagEnabled: boolean;
  failureMode: string;
  /** Always false — preflight never calls paid providers. */
  openaiOrProviderCalled: false;
};

const MIGRATION_MEMORY = path.join(
  process.cwd(),
  "supabase/migrations/20260729100000_persona_face_novelty_memory.sql",
);
const MIGRATION_EMBEDDINGS = path.join(
  process.cwd(),
  "supabase/migrations/20260729110000_persona_face_novelty_embeddings.sql",
);
const MIGRATION_LIVE_DEBUG = path.join(
  process.cwd(),
  "supabase/migrations/20260729120000_persona_face_novelty_live_debug.sql",
);
const MIGRATION_BACKFILL = path.join(
  process.cwd(),
  "supabase/migrations/20260731100000_persona_face_novelty_embedding_backfill.sql",
);

export type PreflightHistoryCounts = {
  priorNoveltyHistoryCount: number;
  priorEmbeddingCount: number;
};

/**
 * Run Face Novelty Preflight.
 * Does not call OpenAI. Does not start generation.
 */
export async function runFaceNoveltyPreflight(options?: {
  historyCounts?: PreflightHistoryCounts;
  /** Test hooks to simulate missing components without touching disk. */
  simulate?: {
    tensorflowMissing?: boolean;
    modelWeightsMissing?: boolean;
    evaluatorInitFailed?: boolean;
    embeddingRepoUnreachable?: boolean;
    migrationMissing?: boolean;
  };
}): Promise<FaceNoveltyPreflightReport> {
  const checks: FaceNoveltyPreflightCheck[] = [];
  const simulate = options?.simulate ?? {};

  // 1. Development availability (Phase 2.0C.1 — Historical Face Protection
  // is always available in development; PERSONA_FACE_NOVELTY_DEBUG is optional
  // for extra candidate-level debug payloads only).
  const featureFlagEnabled = isPersonaFaceNoveltyDebugEnabled();
  const developmentAvailable = process.env.NODE_ENV !== "production";
  checks.push({
    id: "feature_flag",
    ok: developmentAvailable,
    detail: developmentAvailable
      ? featureFlagEnabled
        ? "Development Historical Face Protection available (PERSONA_FACE_NOVELTY_DEBUG=true)"
        : "Development Historical Face Protection available (debug env optional)"
      : "Historical Face Protection is development-only",
  });

  // 2. Failure mode
  const failureMode = resolveEvaluatorFailureMode();
  checks.push({
    id: "failure_mode",
    ok: failureMode === "fail_closed",
    detail: `FACE_EVALUATOR_FAILURE_MODE=${failureMode} (required: fail_closed)`,
  });

  // 3. Startup validation (TF, models, evaluator module, embedding repo)
  let startup = await runFaceNoveltyStartupValidation();
  if (simulate.tensorflowMissing) {
    startup = {
      ...startup,
      ok: false,
      tensorflowLoaded: false,
      errors: [...startup.errors, "TensorFlow not loaded: simulated"],
    };
  }
  if (simulate.modelWeightsMissing) {
    startup = {
      ...startup,
      ok: false,
      modelWeightsPresent: false,
      errors: [...startup.errors, "Missing face model weight files: simulated"],
    };
  }
  if (simulate.embeddingRepoUnreachable) {
    startup = {
      ...startup,
      ok: false,
      embeddingRepoReachable: false,
      errors: [...startup.errors, "SupabaseEmbeddingRepository failed: simulated"],
    };
  }

  checks.push({
    id: "tensorflow",
    ok: startup.tensorflowLoaded,
    detail: startup.tensorflowLoaded
      ? "TensorFlow available"
      : "TensorFlow not available",
  });
  checks.push({
    id: "model_weights",
    ok: startup.modelWeightsPresent,
    detail: startup.modelWeightsPresent
      ? `face-api model weights present at ${startup.modelsDirectory}`
      : `face-api model weights missing under ${startup.modelsDirectory} (run npm run copy:face-api-models)`,
  });
  checks.push({
    id: "model_directory_alignment",
    ok: Boolean(startup.modelsDirectory) &&
      startup.modelsDirectory.includes(`${path.sep}server-assets${path.sep}face-api-models`),
    detail: `Evaluator and startup share models directory: ${startup.modelsDirectory}`,
  });
  checks.push({
    id: "evaluator_module",
    ok: startup.evaluatorModuleReachable && !simulate.evaluatorInitFailed,
    detail:
      startup.evaluatorModuleReachable && !simulate.evaluatorInitFailed
        ? "LocalFaceEmbeddingEvaluator module reachable"
        : "LocalFaceEmbeddingEvaluator failed to initialize",
  });
  checks.push({
    id: "embedding_repository",
    ok: startup.embeddingRepoReachable,
    detail: startup.embeddingRepoReachable
      ? "Embedding repository reachable"
      : "Embedding repository unreachable",
  });

  // 4. Migrations on disk
  const migrationsOk =
    !simulate.migrationMissing &&
    fs.existsSync(MIGRATION_MEMORY) &&
    fs.existsSync(MIGRATION_EMBEDDINGS) &&
    fs.existsSync(MIGRATION_LIVE_DEBUG) &&
    fs.existsSync(MIGRATION_BACKFILL);
  checks.push({
    id: "migrations",
    ok: migrationsOk,
    detail: migrationsOk
      ? "Novelty migrations available on disk (incl. Phase 2.0C backfill)"
      : "Novelty migration files missing",
  });

  // 5. Attempt LocalFaceEmbeddingEvaluator construction (no image / no OpenAI)
  let evaluatorInitOk = !simulate.evaluatorInitFailed;
  if (evaluatorInitOk) {
    try {
      const { LocalFaceEmbeddingEvaluator } = await import(
        "./local-face-embedding-evaluator"
      );
      const evaluator = new LocalFaceEmbeddingEvaluator([]);
      evaluatorInitOk = evaluator.method === "local-face-embedding-v1";
    } catch (err) {
      evaluatorInitOk = false;
      checks.push({
        id: "evaluator_init",
        ok: false,
        detail: `LocalFaceEmbeddingEvaluator init error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  if (!checks.some((c) => c.id === "evaluator_init")) {
    checks.push({
      id: "evaluator_init",
      ok: evaluatorInitOk,
      detail: evaluatorInitOk
        ? "LocalFaceEmbeddingEvaluator initializes"
        : "LocalFaceEmbeddingEvaluator initialization failed",
    });
  }

  const priorNoveltyHistoryCount = options?.historyCounts?.priorNoveltyHistoryCount ?? 0;
  const priorEmbeddingCount = options?.historyCounts?.priorEmbeddingCount ?? 0;

  checks.push({
    id: "prior_novelty_history",
    ok: true,
    detail: `Prior novelty history count: ${priorNoveltyHistoryCount}`,
  });
  checks.push({
    id: "prior_embedding_count",
    ok: true,
    detail: `Prior embedding count: ${priorEmbeddingCount}`,
  });

  const ready = checks.every((c) => c.ok);

  return {
    ready,
    verdict: ready ? "READY FOR CONTROLLED LIVE TEST" : "NOT READY",
    checks: checks.filter((c) => !c.ok || true),
    priorNoveltyHistoryCount,
    priorEmbeddingCount,
    featureFlagEnabled,
    failureMode,
    openaiOrProviderCalled: false,
  };
}

export function failingPreflightChecks(
  report: FaceNoveltyPreflightReport,
): FaceNoveltyPreflightCheck[] {
  return report.checks.filter((c) => !c.ok);
}
