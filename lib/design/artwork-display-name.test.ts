import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FALLBACK_ARTWORK_DISPLAY_NAME,
  RESEARCH_ARTWORK_PROVENANCE,
  formatArtworkSelectorLabel,
  isResearchReportTitle,
  normalizeOwnerArtworkDisplayName,
  resolveArtworkDisplayName,
} from "@/lib/design/artwork-display-name";

describe("Artwork display-name priority", () => {
  it("prefers a user-facing Artwork title over file name and research title", () => {
    const resolved = resolveArtworkDisplayName({
      userFacingTitle: "Quiet Ascent Chest Graphic",
      fileName: "quiet-ascent.png",
      durableDisplayName: "design-owner-upload",
      designId: "design-owner-upload",
      researchTitle: "Design Research Report: Premium Emotional Streetwear",
    });
    assert.equal(resolved.displayName, "Quiet Ascent Chest Graphic");
    assert.equal(resolved.provenanceLabel, RESEARCH_ARTWORK_PROVENANCE);
  });

  it("does not use a Research Report title as the primary Artwork name when an uploaded file name exists", () => {
    const resolved = resolveArtworkDisplayName({
      fileName: "milaene-chest-graphic.png",
      designId: "design-runtime",
      researchTitle: "Design Research Report: Premium Emotional Streetwear",
    });
    assert.equal(resolved.displayName, "milaene-chest-graphic.png");
    assert.equal(isResearchReportTitle(resolved.displayName), false);
    assert.equal(resolved.provenanceLabel, RESEARCH_ARTWORK_PROVENANCE);
  });

  it("falls back to Design ID, then a neutral Artwork label", () => {
    const byDesign = resolveArtworkDisplayName({
      researchTitle: "Design Research Report: Premium Emotional Streetwear",
      designId: "design-owner-upload",
    });
    assert.equal(byDesign.displayName, "design-owner-upload");
    assert.equal(byDesign.provenanceLabel, RESEARCH_ARTWORK_PROVENANCE);

    const fallback = resolveArtworkDisplayName({
      researchTitle: "Design Research Report: Premium Emotional Streetwear",
    });
    assert.equal(fallback.displayName, FALLBACK_ARTWORK_DISPLAY_NAME);
    assert.equal(fallback.provenanceLabel, RESEARCH_ARTWORK_PROVENANCE);
  });

  it("does not treat a long owner-facing file name as a research title", () => {
    const longName = "premium-emotional-streetwear-chest-graphic-front-center-v2.png";
    const resolved = resolveArtworkDisplayName({
      fileName: longName,
      researchTitle: "Design Research Report: Premium Emotional Streetwear",
    });
    assert.equal(resolved.displayName, longName);
    assert.ok(resolved.displayName.length > 40);
  });

  it("lets an explicit owner Artwork name win over filename and research titles", () => {
    const resolved = resolveArtworkDisplayName({
      userFacingTitle: "Cruising Through Time",
      fileName: "Monkey.png",
      durableDisplayName: "design-research-report-premium-emotional-streetwear-from-report",
      designId: "design-research-report-premium-emotional-streetwear-from-report",
      researchTitle: "Design Research Report: Premium Emotional Streetwear",
    });
    assert.equal(resolved.displayName, "Cruising Through Time");
    assert.equal(resolved.provenanceLabel, RESEARCH_ARTWORK_PROVENANCE);
  });

  it("keeps an explicit owner name even when it resembles a research title", () => {
    const resolved = resolveArtworkDisplayName({
      userFacingTitle: "Design Research Report: Premium Emotional Streetwear",
      fileName: "Monkey.png",
      researchTitle: "Design Research Report: Premium Emotional Streetwear",
    });
    assert.equal(
      resolved.displayName,
      "Design Research Report: Premium Emotional Streetwear",
    );
  });

  it("rejects empty, whitespace-only, and oversized Artwork names", () => {
    assert.equal(normalizeOwnerArtworkDisplayName("   ").ok, false);
    assert.equal(normalizeOwnerArtworkDisplayName("").ok, false);
    assert.equal(normalizeOwnerArtworkDisplayName("Cruising Through Time").ok, true);
    assert.equal(normalizeOwnerArtworkDisplayName("x".repeat(121)).ok, false);
  });

  it("formats selectors with owner name, version, and original filename", () => {
    assert.equal(
      formatArtworkSelectorLabel({
        userFacingTitle: "Cruising Through Time",
        fileName: "Monkey.png",
        version: "V1",
      }),
      "Cruising Through Time · V1 · Originaldatei: Monkey.png",
    );
  });
});
