import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPaidPrepareError } from "./prepare-estimate-error";

describe("Prepare / Estimate error formatting", () => {
  it("maps Zod datetime validation noise to a concise user message", () => {
    const raw = JSON.stringify([
      {
        code: "invalid_format",
        format: "datetime",
        path: ["updatedAt"],
        message: "Invalid ISO datetime",
      },
    ]);
    assert.match(formatPaidPrepareError(raw), /Shopify product metadata/i);
  });

  it("preserves actionable server workflow messages", () => {
    assert.equal(
      formatPaidPrepareError(
        "Planned shot and selected Brand Model trace do not match.",
      ),
      "Planned shot and selected Brand Model trace do not match.",
    );
  });
});
