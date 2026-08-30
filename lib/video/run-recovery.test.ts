import assert from "node:assert/strict";
import test from "node:test";
import { splitVideoRuns } from "./run-recovery";

test("terminal reviewed Video runs stay in history while unfinished run recovers", () => {
  const runs = [
    { id: "approved", status: "succeeded", assetReviewStatus: "APPROVED" as const },
    { id: "current", status: "confirmed", assetReviewStatus: null },
    { id: "rejected", status: "succeeded", assetReviewStatus: "REJECTED" as const },
  ];
  const split = splitVideoRuns(runs);
  assert.equal(split.current?.id, "current");
  assert.deepEqual(split.history.map((run) => run.id), ["approved", "rejected"]);
});

test("review-required output remains the current owner decision", () => {
  const split = splitVideoRuns([
    { id: "review", status: "succeeded", assetReviewStatus: "REVIEW_REQUIRED" as const },
    { id: "failed", status: "failed", assetReviewStatus: null },
  ]);
  assert.equal(split.current?.id, "review");
  assert.equal(split.history[0]?.id, "failed");
});

test("terminal-only history does not redefine a new current Video run", () => {
  const split = splitVideoRuns([
    { id: "approved", status: "succeeded", assetReviewStatus: "APPROVED" as const },
    { id: "cancelled", status: "cancelled", assetReviewStatus: null },
  ]);
  assert.equal(split.current, null);
  assert.equal(split.history.length, 2);
});
