import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRfc3339Timestamp,
  parseRfc3339DateTime,
  rfc3339DateTimeSchema,
} from "./rfc3339";

describe("RFC3339 datetime normalization", () => {
  it("accepts Z and offset timestamps in schema", () => {
    assert.equal(
      rfc3339DateTimeSchema.parse("2026-08-17T10:00:00.000Z"),
      "2026-08-17T10:00:00.000Z",
    );
    assert.equal(
      rfc3339DateTimeSchema.parse("2026-08-17T10:00:00+00:00"),
      "2026-08-17T10:00:00+00:00",
    );
  });

  it("normalizes offset timestamps to canonical UTC Z", () => {
    assert.equal(
      normalizeRfc3339Timestamp("2026-08-17T10:00:00+00:00"),
      "2026-08-17T10:00:00.000Z",
    );
  });

  it("parses normalized timestamps for strict downstream schemas", () => {
    assert.equal(
      parseRfc3339DateTime("2026-08-17T12:30:00+02:00"),
      "2026-08-17T10:30:00.000Z",
    );
  });

  it("rejects invalid timestamps", () => {
    assert.throws(() => rfc3339DateTimeSchema.parse("not-a-date"));
  });
});
