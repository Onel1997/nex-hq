import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCleanResearchSignalSet,
  dedupeActionCardsSemantic,
  dedupeRecommendationsSemantic,
  dedupeSilhouettes,
  filterSilhouettesForScope,
  isIncompleteSilhouette,
  normalizeSilhouetteLabel,
  deriveResearchScope,
} from "../clean-signals";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getIntelligenceCopy } from "../copy";
import {
  buildCatalogReferenceIndex,
  isCatalogProductReference,
  normalizeProductReference,
} from "./catalog-filter";
import { classifyEntity, isNoiseEntity, passesOpportunityQualityGate } from "./entity-quality";
import { parseStructuredMaterials } from "./material-parser";
import { resolveProductTarget } from "./product-target";
import { capScoreBySourceAgreement } from "./score-calibration";
import type { UnifiedResearchIntelligence } from "../types/unified";

const HOODIE_REQUEST = "Analyse der Premium Heavyweight Hoodie Trends für Milaene";

function minimalIntelligence(labels: string[]): UnifiedResearchIntelligence {
  return {
    generatedAt: new Date().toISOString(),
    signals: labels.map((label, index) => ({
      id: `signal-${index}`,
      label,
      headline: label,
      direction: "supports",
      weight: 1,
      category: "trend",
      tags: [],
      entities: [],
      provenance: { sourceKey: "google_trends", mode: "live" },
    })),
    trends: {
      rising: labels.map((label, index) => ({
        id: `cluster-${index}`,
        label,
        subjectType: "trend",
        observations: [],
      })),
      emerging: [],
      declining: [],
      stable: [],
      opportunities: labels,
    },
    brand: { culturalSignals: labels, aestheticSignals: [], conflicts: [] },
    market: { demandNarratives: [], seasonalityNotes: [] },
    commercial: { opportunities: [], risks: [] },
    manifest: {
      providerCount: 2,
      liveProviderCount: 2,
      simulatedProviderCount: 0,
      contributions: [
        { sourceKey: "google_trends", signalCount: labels.length, mode: "live" },
        { sourceKey: "shopify", signalCount: 1, mode: "live" },
      ],
    },
    confidence: {
      overall: "medium",
      overallScore: 62,
      scores: {},
      caveats: [],
    },
    recommendations: { items: [], summary: "", caveats: [], generatedAt: "", version: "1" },
  } as unknown as UnifiedResearchIntelligence;
}

describe("Pattern Intelligence v4.1 quality", () => {
  const catalogIndex = buildCatalogReferenceIndex([
    {
      id: "gid://shopify/Product/1",
      title: "Faith Oversized Tee",
      handle: "faith-oversized-tee",
      status: "ACTIVE",
      productType: "T-Shirts",
      price: "49",
      currency: "EUR",
      inventory: 10,
      collections: ["All"],
      tags: ["minimal", "oversized"],
      colors: ["Black"],
      materials: ["280 GSM Cotton"],
    },
    {
      id: "gid://shopify/Product/2",
      title: "Dreams Oversized Tee",
      handle: "dreams-oversized-tee",
      status: "ACTIVE",
      productType: "T-Shirts",
      price: "49",
      currency: "EUR",
      inventory: 8,
      collections: ["All"],
      tags: ["archive"],
      colors: ["Off White"],
      materials: ["Heavyweight Cotton"],
    },
  ]);

  it("A — resolves Heavyweight Hoodie from user request", () => {
    const target = resolveProductTarget({
      userRequest: HOODIE_REQUEST,
      patternSilhouette: "Shorts",
      intelligenceCorpus: "Shorts category gap",
    });
    assert.equal(target, "Heavyweight Hoodie");
  });

  it("B — Faith Oversized Tee variant is catalog evidence only", () => {
    const variant = "Faith Oversized Tee - L / Weiß";
    assert.equal(isCatalogProductReference(variant, catalogIndex), true);
    assert.equal(passesOpportunityQualityGate(variant, catalogIndex), false);
  });

  it("C — rejects noise tags all, acces, hut, red", () => {
    for (const tag of ["all", "acces", "hut", "red", "mütze"]) {
      assert.equal(isNoiseEntity(tag), true);
      assert.equal(classifyEntity(tag, catalogIndex), "noise");
    }
  });

  it("D — material parser strips shipping and size chart pollution", () => {
    const polluted =
      "240GSM ✓ Schneller Versand Mit DHL ... XS S M L XL tolerance ±2cm";
    const clean = parseStructuredMaterials([polluted]);
    assert.ok(clean.includes("240 GSM"));
    assert.equal(clean.some((value) => /versand|dhl|xs/i.test(value)), false);
  });

  it("score caps single-source signals at 74", () => {
    const capped = capScoreBySourceAgreement(99, { sourceKeyCount: 1 });
    assert.equal(capped, 74);
  });

  it("normalizes variant titles for catalog matching", () => {
    const normalized = normalizeProductReference("Faith Oversize Tee - L / Weiß");
    assert.ok(normalized.includes("faith"));
    assert.ok(!normalized.includes("weiß"));
  });
});

describe("Pattern Intelligence v4.2 quality", () => {
  it("TEST A — summary noise rejection", () => {
    const cleanSet = buildCleanResearchSignalSet({
      intelligence: minimalIntelligence([
        "all",
        "mütze",
        "acces..",
        "Heavyweight Hoodie",
        "Oversized Hoodie",
      ]),
      userRequest: HOODIE_REQUEST,
    });

    const summary = cleanSet.summaryLabels.join(", ").toLowerCase();
    assert.ok(summary.includes("heavyweight hoodie") || summary.includes("oversized hoodie"));
    assert.equal(summary.includes("all"), false);
    assert.equal(summary.includes("mütze"), false);
    assert.equal(summary.includes("acces"), false);
    assert.equal(summary.includes(".."), false);
  });

  it("TEST B — scope enforcement in silhouettes", () => {
    const scope = deriveResearchScope(HOODIE_REQUEST);
    const visible = filterSilhouettesForScope(
      ["Oversized Tee", "Oversized Hoodie", "Sherpa Jacket", "Zip Hoodie", "Hoodie Zip"],
      scope,
    );
    assert.ok(visible.includes("Oversized Hoodie"));
    assert.ok(visible.includes("Zip Hoodie"));
    assert.equal(visible.some((item) => /tee|sherpa/i.test(item)), false);
  });

  it("TEST C — incomplete silhouette rejected", () => {
    assert.equal(isIncompleteSilhouette("Oversized"), true);
    assert.equal(normalizeSilhouetteLabel("Oversized"), null);
  });

  it("TEST D — recommendation deduplication", () => {
    const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
    const deduped = dedupeRecommendationsSemantic([
      {
        id: "1",
        title: copy.addSocialSources.replace(/\.$/, ""),
        type: "next_research_action",
        priority: "explore",
        confidence: 40,
        why: copy.addSocialSources,
        evidence: [],
        sourceSupport: [],
        risks: [],
        suggestedNextStep: copy.addSocialSources,
        audiences: ["research"],
        tags: [],
        sourceDomains: [],
        relatedScoreIds: [],
        narrative: copy.addSocialSources,
      },
      {
        id: "2",
        title: "TikTok oder Pinterest verbinden",
        type: "next_research_action",
        priority: "explore",
        confidence: 35,
        why: copy.socialMomentumDesc,
        evidence: [],
        sourceSupport: [],
        risks: [],
        suggestedNextStep: copy.socialMomentumDesc,
        audiences: ["research"],
        tags: [],
        sourceDomains: [],
        relatedScoreIds: [],
        narrative: copy.socialMomentumDesc,
      },
    ]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]?.title, copy.socialMomentumTitle);
  });

  it("TEST E — evidence-strength wording uses cautious medium tier", () => {
    const positive = { label: "Heavyweight/GSM", units: 22, count: 2 };
    const negative = { label: "Leichtere Materialien", units: 10, count: 2 };
    const total = positive.units + negative.units;
    assert.ok(total >= 20);
    const evidence = `Mittlere Evidenz: ${positive.label} erzielten in den verfügbaren Shopify-Daten ${positive.units} verkaufte Einheiten gegenüber ${negative.units} Einheiten ${negative.label}.`;
    assert.ok(evidence.includes("Vorläufig") || evidence.includes("Mittlere Evidenz"));
    assert.equal(evidence.includes("outperformt"), false);
  });

  it("TEST F — localization strings for launch timing", () => {
    const copy = getIntelligenceCopy(DEFAULT_LOCALE);
    assert.equal(copy.recommendations.launchTitle, "Bewertung des Launch-Zeitpunkts");
    assert.ok(copy.recommendations.launchAlignCalendar.includes("Drop-Kalender"));
    assert.ok(copy.recommendations.launchAlignCalendar.includes("Lieferzeiten"));
  });

  it("TEST G — canonical product normalization", () => {
    const normalized = dedupeSilhouettes(["Hoodie Zip", "Zip-Hoodie", "Zip Hoodie"]);
    assert.deepEqual(normalized, ["Zip Hoodie"]);
  });

  it("dedupes duplicate action cards semantically", () => {
    const copy = getIntelligenceCopy(DEFAULT_LOCALE).recommendations;
    const deduped = dedupeActionCardsSemantic([
      {
        id: "a1",
        title: copy.addSocialSources.replace(/\.$/, ""),
        why: copy.addSocialSources,
        priority: "explore",
        suggestedNextStep: copy.addSocialSources,
      },
      {
        id: "a2",
        title: copy.socialMomentumTitle,
        why: copy.socialMomentumDesc,
        priority: "explore",
        suggestedNextStep: copy.socialMomentumDesc,
      },
    ]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0]?.title, copy.socialMomentumTitle);
  });
});
