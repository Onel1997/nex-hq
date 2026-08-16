/**
 * Phase 2.5B.10 — Face Freshness UI placement (portrait must stay clear).
 * Source/layout assertions only — no provider calls.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  faceFreshnessScoreFromDistance,
  classifyFaceFreshnessScore,
} from "@/lib/persona/creation/candidate-intelligence";

const ROOT = process.cwd();

describe("Phase 2.5B.10 — move face freshness out of portrait", () => {
  it("1–2. freshness is not rendered in hero overlay; portrait area stays clean of freshness pills", () => {
    const board = readFileSync(
      join(ROOT, "components/persona/candidate-board.tsx"),
      "utf8",
    );
    const heroStart = board.indexOf('className="ps-ci-card-hero"');
    const bodyStart = board.indexOf('className="ps-ci-card-body"');
    assert.ok(heroStart > 0 && bodyStart > heroStart);
    const heroBlock = board.slice(heroStart, bodyStart);
    assert.doesNotMatch(heroBlock, /showFaceFreshnessDebug/);
    assert.doesNotMatch(heroBlock, /Face Freshness/);
    assert.doesNotMatch(heroBlock, /data-face-freshness/);
    assert.match(heroBlock, /CandidateStatusBadge/);
  });

  it("3–4. freshness score/class visible in card metadata with tooltip details", () => {
    const board = readFileSync(
      join(ROOT, "components/persona/candidate-board.tsx"),
      "utf8",
    );
    assert.match(board, /data-face-freshness="metadata"/);
    assert.match(board, /Face Freshness/);
    assert.match(board, /ps-ci-card-stats/);
    assert.match(board, /closestRecentCandidateId/);
    assert.match(board, /closestDistance/);
    assert.match(board, /projectsCompared/);
    assert.match(board, /title=\{faceFreshnessTitle\}/);
  });

  it("5. responsive stats layout avoids overlay collisions", () => {
    const css = readFileSync(join(ROOT, "app/persona-studio.css"), "utf8");
    assert.match(css, /\.ps-ci-freshness-stat/);
    assert.match(css, /@media \(max-width: 420px\)/);
    assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(css, /overflow-wrap: anywhere/);
  });

  it("6. freshness calculation unchanged", () => {
    assert.equal(faceFreshnessScoreFromDistance(0.4), 50);
    assert.equal(faceFreshnessScoreFromDistance(0.8), 100);
    assert.equal(classifyFaceFreshnessScore(82), "VERY_FRESH");
    assert.equal(classifyFaceFreshnessScore(60), "FRESH");
    assert.equal(classifyFaceFreshnessScore(40), "FAMILIAR");
    assert.equal(classifyFaceFreshnessScore(10), "VERY_FAMILIAR");
    const freshnessSrc = readFileSync(
      join(
        ROOT,
        "lib/persona/creation/candidate-intelligence/urban-face-freshness.ts",
      ),
      "utf8",
    );
    assert.match(freshnessSrc, /URBAN_FACE_FRESHNESS_VERSION = "2\.5B\.8"/);
  });
});
