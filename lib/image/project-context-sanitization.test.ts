import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeOptionalProjectContextList,
  sanitizeOptionalProjectContextString,
} from "@/lib/image/optional-project-context";

const DEFAULT_COLORS = ["Obsidian Black", "Soft Cream"] as const;

test("empty moodboard color entries are trimmed and removed", () => {
  const colors = sanitizeOptionalProjectContextList(
    ["  ", " Black "],
    DEFAULT_COLORS,
  );
  assert.equal(colors[0], "Black");
  assert.ok(colors.every((entry) => entry === entry.trim() && entry.length >= 2));
});

test("one-character legacy moodboard color values fail soft", () => {
  const colors = sanitizeOptionalProjectContextList(
    ["—"],
    DEFAULT_COLORS,
  );
  assert.equal(colors.includes("—"), false);
  assert.ok(colors.length >= 2);
  assert.ok(colors.every((entry) => entry.length >= 2));
});

test("missing optional moodboard receives safe non-authoritative defaults", () => {
  const colors = sanitizeOptionalProjectContextList(undefined, DEFAULT_COLORS);
  assert.deepEqual(colors, [...DEFAULT_COLORS]);
  assert.equal(sanitizeOptionalProjectContextString(undefined), undefined);
});

test("valid moodboard context remains available", () => {
  const colors = sanitizeOptionalProjectContextList(
    ["Obsidian Black", "Soft Cream"],
    DEFAULT_COLORS,
  );
  assert.deepEqual(colors.slice(0, 2), ["Obsidian Black", "Soft Cream"]);
});
