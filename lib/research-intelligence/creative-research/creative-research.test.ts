import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  CREATIVE_DIRECTION_HANDOFF_MISSION,
  DRAFT_SELECTION_NEXT_STEP,
  NO_PATTERN_EVIDENCE_NOTE,
  applySelectionToCreativeCopy,
  buildCreativeDirectionHandoff,
  buildProviderUsage,
  clearCreativeHistoryForTests,
  estimateProviderCost,
  evaluatePhraseQuality,
  evaluateRunDiversity,
  isGenericPhrase,
  isNearDuplicatePhrase,
  isWeakPhraseFragment,
  matchesCatalogProductName,
  patternEvidenceFromSection,
  recentPhrases,
  recordCreativeRunIdeas,
  runCollectionCreatorEngine,
  runWeeklyDesignIdeasEngine,
  shouldSyncProviders,
} from "./index";
import { adaptLegacyResearchStudioReport, isLegacyTrendReport } from "../report/legacy-adapter";
import { emptyResearchStudioReport } from "../report/types";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

beforeEach(() => {
  clearCreativeHistoryForTests();
});

describe("Phrase quality layer", () => {
  it("rejects or scores weak phrase fragments below threshold", () => {
    for (const phrase of ["Heavy soft.", "Light for one.", "Silence wins."]) {
      assert.equal(isWeakPhraseFragment(phrase) || isGenericPhrase(phrase), true);
      const quality = evaluatePhraseQuality(phrase, {
        meaning: "Short meaning that does not rescue a weak fragment.",
      });
      assert.equal(quality.passed, false);
      assert.ok(quality.phraseStrengthScore < 62 || quality.rejectionReasons.length > 0);
    }
  });

  it("rejects generic motivational clichés", () => {
    for (const phrase of ["Stay strong.", "Dream bigger.", "Built different.", "Never settle."]) {
      assert.equal(isGenericPhrase(phrase), true);
      assert.equal(evaluatePhraseQuality(phrase).passed, false);
    }
  });

  it("accepts deliberate garment-ready phrases", () => {
    const quality = evaluatePhraseQuality("No audience required.", {
      meaning:
        "Selbstgenügsamkeit ohne Pose — Identität, die keine Bühne braucht, um gültig zu sein.",
      alternatives: [
        "Close the circuit.",
        "This room has no stage.",
        "Perform nowhere.",
      ],
    });
    assert.equal(quality.passed, true);
    assert.ok(quality.phraseStrengthScore >= 60);
  });
});

describe("Weekly diversity & generation", () => {
  it("four ideas have meaningfully different visual structures", () => {
    const result = runWeeklyDesignIdeasEngine({
      count: 4,
      providerMode: "creative_only",
    });
    assert.equal(result.designIdeas.length, 4);
    const structures = result.designIdeas.map((idea) => idea.visualStructure);
    assert.equal(new Set(structures).size, 4);
    const diversity = evaluateRunDiversity(result.designIdeas);
    assert.equal(diversity.passed, true);
    assert.ok(result.diversityScore >= 70);
  });

  it("limits serif typography and small-front/large-back layouts", () => {
    const result = runWeeklyDesignIdeasEngine({
      count: 4,
      providerMode: "creative_only",
    });
    const serifCount = result.designIdeas.filter((idea) => idea.typographyFamily === "serif").length;
    assert.ok(serifCount <= 2);
    const smallFrontLargeBack = result.designIdeas.filter(
      (idea) => idea.frontBackConfiguration === "front_and_back",
    ).length;
    assert.ok(smallFrontLargeBack <= 2);
  });

  it("includes at least one idea without a back print", () => {
    const result = runWeeklyDesignIdeasEngine({
      count: 4,
      providerMode: "creative_only",
    });
    assert.ok(
      result.designIdeas.some(
        (idea) =>
          idea.frontBackConfiguration === "front" || idea.frontBackConfiguration === "open",
      ),
    );
  });

  it("rejects catalog product names as new design ideas", () => {
    const catalog = ["Faith Oversized Tee", "Silent Hours Hoodie"];
    assert.equal(matchesCatalogProductName("Faith Oversized Tee", catalog), true);
    const result = runWeeklyDesignIdeasEngine({
      count: 4,
      catalogProductTitles: catalog,
      providerMode: "creative_only",
    });
    for (const idea of result.designIdeas) {
      assert.equal(matchesCatalogProductName(idea.designTitle, catalog), false);
      assert.equal(matchesCatalogProductName(idea.primaryPhrase, catalog), false);
    }
  });

  it("avoids near-identical phrases in the same run", () => {
    const result = runWeeklyDesignIdeasEngine({ count: 4, providerMode: "creative_only" });
    const phrases = result.designIdeas.map((idea) => idea.primaryPhrase);
    for (let i = 0; i < phrases.length; i += 1) {
      for (let j = i + 1; j < phrases.length; j += 1) {
        assert.equal(isNearDuplicatePhrase(phrases[i], phrases[j]), false);
      }
    }
  });
});

describe("Selection state & handoff", () => {
  it("draft report does not claim a direction is selected", () => {
    const result = runWeeklyDesignIdeasEngine({ count: 4, providerMode: "creative_only" });
    assert.equal(result.selectedIdeaId, null);
    assert.match(result.nextStep, /Wähle eine Idee/i);
    assert.doesNotMatch(result.nextStep, /wurde ausgewählt/i);
    assert.doesNotMatch(result.creativeDirectionSummary, /Die kreative Richtung wurde ausgewählt/i);
    assert.ok(
      result.nextStep.includes("vier") ||
        result.nextStep.includes("4") ||
        result.nextStep.includes("kreative Richtungen") ||
        DRAFT_SELECTION_NEXT_STEP.includes("Vier"),
    );
  });

  it("selection updates copy and builds handoff only for selected idea", () => {
    const result = runWeeklyDesignIdeasEngine({ count: 4, providerMode: "creative_only" });
    const idea = result.designIdeas[0];
    assert.ok(idea);

    const applied = applySelectionToCreativeCopy({
      ideas: result.designIdeas,
      selectedIdeaId: idea.id,
      generatorSource: result.generatorSource,
    });
    assert.equal(applied.selectedIdeaId, idea.id);
    assert.match(applied.nextStep, /Ausgewählt/i);
    assert.match(applied.nextStep, new RegExp(idea.primaryPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(applied.handoff, null);

    const handoff = buildCreativeDirectionHandoff(idea, "run-test-1");
    assert.equal(handoff.status, "awaiting_artwork_upload");
    assert.equal(handoff.selectedIdeaId, idea.id);
    assert.equal(handoff.missionStatement, CREATIVE_DIRECTION_HANDOFF_MISSION);
    assert.equal(
      result.designIdeas.filter((item) => item.status === "selected").length,
      0,
    );
  });

  it("no design generation mission wording in handoff", () => {
    assert.doesNotMatch(CREATIVE_DIRECTION_HANDOFF_MISSION, /entwickle ein neues originales design/i);
  });
});

describe("Provider usage & cost transparency", () => {
  it("Creative Only has providerSyncCount 0 and unused connected providers", () => {
    assert.equal(shouldSyncProviders("creative_only"), false);
    const usage = buildProviderUsage("creative_only", {
      connectedProviders: ["google_trends", "shopify", "tiktok"],
    });
    assert.equal(usage.providerSyncCount, 0);
    assert.deepEqual(usage.usedProviders, []);
    assert.equal(usage.connectedButUnused.length, 3);
    assert.ok(
      usage.notes.every((note) => /nicht abgefragt/i.test(note)),
    );

    const weekly = runWeeklyDesignIdeasEngine(
      { count: 4, providerMode: "creative_only" },
      { connectedProviders: ["google_trends", "shopify", "pinterest"] },
    );
    assert.equal(weekly.providerUsage.providerSyncCount, 0);
    assert.equal(weekly.providerUsage.usedProviders.length, 0);
  });

  it("cost estimate splits Creative Generation and External Providers", () => {
    const deterministic = estimateProviderCost("creative_only", { llmCalled: false });
    assert.equal(deterministic.estimatedMin, 0);
    assert.equal(deterministic.estimatedMax, 0);
    assert.equal(deterministic.creativeGenerationMin, 0);
    assert.equal(deterministic.externalProvidersMin, 0);
    assert.equal(deterministic.llmCalled, false);
    assert.ok(deterministic.breakdown.some((item) => item.category === "creative_generation"));
    assert.ok(deterministic.breakdown.some((item) => item.category === "external_providers"));

    const withLlm = estimateProviderCost("creative_only", { llmCalled: true });
    assert.ok(withLlm.creativeGenerationMax > 0);
    assert.equal(withLlm.externalProvidersMax, 0);
  });

  it("pattern evidence honesty for creative only", () => {
    const empty = patternEvidenceFromSection(null);
    assert.equal(empty.available, false);
    assert.equal(empty.honestyNote, NO_PATTERN_EVIDENCE_NOTE);
    const weekly = runWeeklyDesignIdeasEngine({ count: 2, providerMode: "creative_only" });
    for (const idea of weekly.designIdeas) {
      assert.equal(idea.optionalPatternEvidence?.available, false);
    }
  });
});

describe("History awareness", () => {
  it("excludes recent phrases and concept structures from later runs", () => {
    const first = runWeeklyDesignIdeasEngine({ count: 4, providerMode: "creative_only" });
    recordCreativeRunIdeas(first.designIdeas, { selectedIdeaId: first.designIdeas[0]?.id });
    assert.ok(recentPhrases().length >= 4);

    const second = runWeeklyDesignIdeasEngine({ count: 4, providerMode: "creative_only" });
    const firstPhrases = new Set(first.designIdeas.map((idea) => idea.primaryPhrase.toLowerCase()));
    for (const idea of second.designIdeas) {
      assert.equal(firstPhrases.has(idea.primaryPhrase.toLowerCase()), false);
    }
  });
});

describe("Collection creator", () => {
  it("creates consistent but distinct collection ideas", () => {
    const result = runCollectionCreatorEngine({
      collectionTheme: "Quiet Continuum",
      designCount: 8,
      providerMode: "creative_only",
    });
    assert.ok(result.collection.designIdeas.length >= 6);
    const structures = new Set(
      result.collection.designIdeas.map((idea) => idea.visualStructure),
    );
    assert.ok(structures.size >= 4);
  });
});

describe("Legacy reports & i18n", () => {
  it("legacy reports remain readable via adapter", () => {
    const adapted = adaptLegacyResearchStudioReport({
      version: "6.0.0",
      generatedAt: "2026-01-01T00:00:00.000Z",
      title: "Legacy Fusion Report",
      overallConfidence: 55,
      overallTier: "medium",
      intelligenceWeak: false,
      caveats: ["old"],
      executiveSummary: "Legacy summary",
      prioritizedOpportunities: [],
    } as never);
    assert.equal(adapted.researchMode, "trend_intelligence");
    assert.equal(isLegacyTrendReport(adapted), true);
    assert.equal(emptyResearchStudioReport().version, "7.0.0");
  });

  it("German UI texts remain complete", () => {
    const studio = getDictionary(DEFAULT_LOCALE).research.studio;
    assert.equal(studio.missions.weeklyIdeas, "4 Wochenideen erstellen");
    assert.equal(studio.fusion.prepareDesignStudio, "Im Design Studio vorbereiten");
    assert.equal(studio.fusion.technicalDetails, "Technische Details");
  });
});
