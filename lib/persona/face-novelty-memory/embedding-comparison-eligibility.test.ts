/**
 * Phase 2.0E — embedding comparison eligibility tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEmbeddingEligibleForComparison } from "./embedding-comparison-eligibility";

describe("embedding comparison eligibility", () => {
  it("allows legacy rows without live evaluation evidence", () => {
    assert.equal(isEmbeddingEligibleForComparison({}), true);
    assert.equal(
      isEmbeddingEligibleForComparison({ liveEvaluationEvidence: null }),
      true,
    );
  });

  it("allows finalDecision allowed", () => {
    assert.equal(
      isEmbeddingEligibleForComparison({
        liveEvaluationEvidence: { finalDecision: "allowed" },
      }),
      true,
    );
  });

  it("rejects failed, blocked, and evaluator-error decisions", () => {
    for (const decision of ["failed", "blocked", "rejected"] as const) {
      assert.equal(
        isEmbeddingEligibleForComparison({
          liveEvaluationEvidence: { finalDecision: decision },
        }),
        false,
      );
    }
  });
});
