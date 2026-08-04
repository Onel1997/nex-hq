/**
 * Phase 2.0C — Development-safe paid discovery coverage gate.
 *
 * Blocks paid A1 discovery when historical biological protection coverage
 * is incomplete. Never calls OpenAI.
 */

import type { ExtendedHistoricalFaceProtectionSummary } from "./historical-backfill-coverage";
import type { SafeBackfillJobSummary } from "./historical-backfill-types";
import { isPersonaFaceNoveltyDebugEnabled } from "./live-debug";

/** Env: minimum processable coverage percent required before paid discovery (default 100). */
export const PERSONA_FACE_HISTORICAL_COVERAGE_MIN_PERCENT_ENV =
  "PERSONA_FACE_HISTORICAL_COVERAGE_MIN_PERCENT";

export type DiscoveryCoverageGateInput = {
  evaluatorReady: boolean;
  coverage: ExtendedHistoricalFaceProtectionSummary;
  runningBackfillJob?: SafeBackfillJobSummary | null;
  /** Explicit UI acknowledgment that unresolved detection failures are accepted. */
  acknowledgeUnresolvedFailures?: boolean;
  env?: NodeJS.ProcessEnv;
};

export type DiscoveryCoverageGateResult = {
  allowed: boolean;
  blocked: boolean;
  reasonCodes: string[];
  message: string | null;
  requiredProcessableCoveragePercent: number;
  actualProcessableCoveragePercent: number;
  unresolvedFailures: number;
  missingEmbeddingProcessable: number;
  openaiCalls: 0;
  paidProviderCalls: 0;
};

export function resolveMinimumProcessableCoveragePercent(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env[PERSONA_FACE_HISTORICAL_COVERAGE_MIN_PERCENT_ENV];
  if (raw == null || raw === "") return 100;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 100;
  return Math.min(100, Math.max(0, n));
}

/**
 * Development-safe gate. In production always allows (gate is development-controlled-test).
 */
export function evaluateDiscoveryCoverageGate(
  input: DiscoveryCoverageGateInput,
): DiscoveryCoverageGateResult {
  const env = input.env ?? process.env;
  const required = resolveMinimumProcessableCoveragePercent(env);
  const actual = input.coverage.processableCoveragePercentage;
  const openaiCalls = 0 as const;
  const paidProviderCalls = 0 as const;
  const unresolvedFailures = input.coverage.failedProcessing;
  const missingEmbeddingProcessable = Math.max(
    0,
    input.coverage.missingEmbedding - input.coverage.missingAsset,
  );

  if (env.NODE_ENV === "production") {
    return {
      allowed: true,
      blocked: false,
      reasonCodes: [],
      message: null,
      requiredProcessableCoveragePercent: required,
      actualProcessableCoveragePercent: actual,
      unresolvedFailures,
      missingEmbeddingProcessable,
      openaiCalls,
      paidProviderCalls,
    };
  }

  const reasonCodes: string[] = [];
  const controlledTest = isPersonaFaceNoveltyDebugEnabled(env);
  const needsProtectionWork =
    missingEmbeddingProcessable > 0 ||
    unresolvedFailures > 0 ||
    actual < required;

  if (!input.evaluatorReady && (controlledTest || needsProtectionWork)) {
    reasonCodes.push("evaluator_not_ready");
  }

  if (
    input.runningBackfillJob &&
    (input.runningBackfillJob.status === "running" ||
      input.runningBackfillJob.status === "pending")
  ) {
    reasonCodes.push("backfill_job_running");
  }

  if (actual < required) {
    reasonCodes.push("incomplete_historical_coverage");
  }

  if (unresolvedFailures > 0 && !input.acknowledgeUnresolvedFailures) {
    reasonCodes.push("unresolved_failures_unacknowledged");
  }

  const blocked = reasonCodes.length > 0;
  let message: string | null = null;
  if (blocked) {
    const parts: string[] = [];
    if (reasonCodes.includes("evaluator_not_ready")) {
      parts.push("Local face evaluator is not READY.");
    }
    if (reasonCodes.includes("backfill_job_running")) {
      parts.push("Historical face embedding backfill is still running.");
    }
    if (reasonCodes.includes("incomplete_historical_coverage")) {
      parts.push(
        `Historical biological protection coverage is ${actual}% ` +
          `(required ${required}% of processable assets). ` +
          `Run “Backfill Historical Face Protection” before paid discovery.`,
      );
    }
    if (reasonCodes.includes("unresolved_failures_unacknowledged")) {
      parts.push(
        `${unresolvedFailures} historical face(s) failed processing. ` +
          `Acknowledge unresolved failures explicitly, or retry failed records.`,
      );
    }
    message = parts.join(" ");
  }

  return {
    allowed: !blocked,
    blocked,
    reasonCodes,
    message,
    requiredProcessableCoveragePercent: required,
    actualProcessableCoveragePercent: actual,
    unresolvedFailures,
    missingEmbeddingProcessable,
    openaiCalls,
    paidProviderCalls,
  };
}
