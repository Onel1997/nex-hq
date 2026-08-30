/**
 * Phase 2.3D.1 — Reference image large preview (UI only, no provider calls).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildReferencePackageAssetNotes,
  parseReferencePackageAssetNotes,
} from "@/lib/persona/creation/reference-package";
import { FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD } from "@/lib/persona/face-novelty-memory/similarity-threshold";

const ROOT = process.cwd();

describe("Phase 2.3D.1 reference large preview", () => {
  it("UI opens lightbox, Master compare, approve/reject, Escape/backdrop", () => {
    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(studio, /ReferencePreviewLightbox/);
    assert.match(studio, /reference-preview-lightbox/);
    assert.match(studio, /Mit Master vergleichen/);
    assert.match(studio, /reference-master-compare/);
    assert.match(studio, /Freigeben/);
    assert.match(studio, /Ablehnen/);
    assert.match(studio, /e\.key === "Escape"/);
    assert.match(studio, /ps-ref-lightbox-backdrop/);
    assert.match(studio, /Unterstützende Referenz – kann nicht zum Master werden/);
    assert.match(studio, /Unveränderlicher Master/);
  });

  it("rejected / mismatch notes remain inspectable via parse", () => {
    const notes = buildReferencePackageAssetNotes({
      slot: "three_quarter_left",
      attemptId: "att-1",
      masterReferenceId: "master-1",
      identityDecision: "identity_mismatch",
    });
    const parsed = parseReferencePackageAssetNotes(notes);
    assert.ok(parsed);
    assert.equal(parsed.slot, "three_quarter_left");
    assert.equal(parsed.identity_decision, "identity_mismatch");
  });

  it("does not change novelty threshold or call providers", () => {
    assert.equal(FACE_SIMILARITY_EUCLIDEAN_DUPLICATE_THRESHOLD, 0.45);
    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.doesNotMatch(studio, /editOpenAiImageFromReference/);
    assert.doesNotMatch(studio, /generateOpenAiImage/);
  });
});
