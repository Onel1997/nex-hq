/**
 * Phase 2.0E / 2.2G — embedding comparison eligibility tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEmbeddingEligibleForComparison } from "./embedding-comparison-eligibility";

describe("embedding comparison eligibility", () => {
  it("Phase 2.2G: unprotected historical faces are excluded", () => {
    assert.equal(
      isEmbeddingEligibleForComparison({
        liveEvaluationEvidence: { finalDecision: "allowed" },
        historicalProtectionStatus: "unprotected",
        creationProjectId: "old-project",
        currentCreationProjectId: "new-project",
      }),
      false,
    );
    assert.equal(
      isEmbeddingEligibleForComparison({
        liveEvaluationEvidence: null,
        historicalProtectionStatus: "unprotected",
      }),
      false,
    );
  });

  it("allows protected historical identities", () => {
    assert.equal(
      isEmbeddingEligibleForComparison({
        liveEvaluationEvidence: { finalDecision: "allowed" },
        historicalProtectionStatus: "selected_brand_face",
        creationProjectId: "old-project",
        currentCreationProjectId: "new-project",
      }),
      true,
    );
  });

  it("same-run allowed faces remain eligible", () => {
    assert.equal(
      isEmbeddingEligibleForComparison({
        liveEvaluationEvidence: { finalDecision: "allowed" },
        historicalProtectionStatus: "unprotected",
        creationProjectId: "run-1",
        currentCreationProjectId: "run-1",
      }),
      true,
    );
  });

  it("rejects failed, blocked, and evaluator-error decisions on same-run", () => {
    for (const decision of ["failed", "blocked", "rejected"] as const) {
      assert.equal(
        isEmbeddingEligibleForComparison({
          liveEvaluationEvidence: { finalDecision: decision },
          historicalProtectionStatus: "unprotected",
          creationProjectId: "run-1",
          currentCreationProjectId: "run-1",
        }),
        false,
      );
    }
  });
});
