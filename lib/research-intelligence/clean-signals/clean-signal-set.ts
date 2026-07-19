import { normalizeTerm } from "../confidence/scoring-utils";
import type { UnifiedResearchIntelligence } from "../types/unified";
import {
  buildCatalogReferenceIndex,
  type CatalogReferenceIndex,
} from "../pattern-intelligence/catalog-filter";
import {
  classifyEntity,
  isCreativeOpportunityEntity,
  isNoiseEntity,
  normalizeEntityLabel,
  type EntityClassification,
} from "../pattern-intelligence/entity-quality";
import { deriveResearchScope, passesResearchScope, type ResearchScope } from "./research-scope";
import { normalizeSilhouetteLabel } from "./product-terminology";

export interface CleanResearchSignal {
  label: string;
  displayLabel: string;
  entityKind: EntityClassification;
  sourceKeys: string[];
  normalizedKey: string;
  scopeRelevant: boolean;
  weight: number;
}

export interface CleanResearchSignalSet {
  signals: CleanResearchSignal[];
  trendLabels: string[];
  summaryLabels: string[];
  scope: ResearchScope;
  catalogIndex: CatalogReferenceIndex;
}

function isTruncatedLabel(label: string): boolean {
  const trimmed = label.trim();
  return /\.\.$/.test(trimmed) || /\bacces\.{2,}$/i.test(trimmed);
}

function collectCandidateLabels(intelligence: UnifiedResearchIntelligence): Array<{
  label: string;
  sourceKeys: string[];
  weight: number;
}> {
  const candidates = new Map<string, { label: string; sourceKeys: Set<string>; weight: number }>();

  const add = (raw: string, sourceKey: string, weight = 1) => {
    const label = raw.trim();
    if (!label) return;
    const key = normalizeEntityLabel(label);
    if (!key) return;
    const existing = candidates.get(key);
    if (existing) {
      existing.sourceKeys.add(sourceKey);
      existing.weight += weight;
      return;
    }
    candidates.set(key, { label, sourceKeys: new Set([sourceKey]), weight });
  };

  for (const signal of intelligence.signals) {
    add(signal.label, String(signal.provenance.sourceKey), 1);
  }

  for (const cluster of [
    ...intelligence.trends.rising,
    ...intelligence.trends.emerging,
  ]) {
    add(cluster.label, cluster.observations[0]?.provenance?.sourceKey ?? "fusion", 2);
  }

  for (const term of intelligence.trends.opportunities) {
    add(term, "fusion", 1);
  }

  for (const term of intelligence.brand.culturalSignals) {
    add(term, "brand", 1);
  }

  return [...candidates.values()].map((entry) => ({
    label: entry.label,
    sourceKeys: [...entry.sourceKeys],
    weight: entry.weight,
  }));
}

function passesQualityGates(
  label: string,
  catalogIndex: CatalogReferenceIndex,
): EntityClassification | null {
  if (isNoiseEntity(label) || isTruncatedLabel(label)) return null;
  const kind = classifyEntity(label, catalogIndex);
  if (kind === "noise" || kind === "catalog_metadata" || kind === "product") return null;
  return kind;
}

function toDisplayLabel(label: string, kind: EntityClassification): string {
  if (kind === "category" || kind === "recommendation") {
    const silhouette = normalizeSilhouetteLabel(label);
    if (silhouette) return silhouette;
  }
  return label.trim();
}

export function buildCleanResearchSignalSet(input: {
  intelligence: UnifiedResearchIntelligence;
  catalogProductTitles?: string[];
  userRequest?: string;
}): CleanResearchSignalSet {
  const catalogIndex = buildCatalogReferenceIndex(
    (input.catalogProductTitles ?? []).map((title, index) => ({
      id: `catalog-${index}`,
      title,
      handle: "",
      status: "ACTIVE",
      productType: "",
      price: "0",
      currency: "EUR",
      inventory: 0,
      collections: [],
      tags: [],
      colors: [],
      materials: [],
    })),
  );

  const scope = deriveResearchScope(input.userRequest);
  const seen = new Set<string>();
  const signals: CleanResearchSignal[] = [];

  for (const candidate of collectCandidateLabels(input.intelligence)) {
    const kind = passesQualityGates(candidate.label, catalogIndex);
    if (!kind) continue;

    const displayLabel = toDisplayLabel(candidate.label, kind);
    const scopeRelevant = passesResearchScope(displayLabel, scope);
    if (!scopeRelevant && kind !== "trend" && kind !== "design_pattern") continue;
    if (!scopeRelevant && !isCreativeOpportunityEntity(kind)) continue;

    const normalizedKey = normalizeTerm(displayLabel) || normalizeEntityLabel(displayLabel);
    if (!normalizedKey || seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);

    signals.push({
      label: candidate.label,
      displayLabel,
      entityKind: kind,
      sourceKeys: candidate.sourceKeys,
      normalizedKey,
      scopeRelevant,
      weight: candidate.weight,
    });
  }

  signals.sort((a, b) => b.weight - a.weight || b.sourceKeys.length - a.sourceKeys.length);

  const trendLabels = signals
    .filter((signal) => signal.scopeRelevant)
    .filter((signal) => isCreativeOpportunityEntity(signal.entityKind) || signal.entityKind === "category")
    .map((signal) => signal.displayLabel)
    .slice(0, 6);

  const summaryLabels = trendLabels.length > 0
    ? trendLabels
    : signals.filter((s) => s.scopeRelevant).map((s) => s.displayLabel).slice(0, 4);

  return {
    signals,
    trendLabels: summaryLabels.slice(0, 5),
    summaryLabels,
    scope,
    catalogIndex,
  };
}

export function buildCleanTrendSummary(
  cleanSet: CleanResearchSignalSet,
  localeCopy: { trendRising: string },
): string | null {
  if (cleanSet.summaryLabels.length === 0) return null;
  const terms = cleanSet.summaryLabels.slice(0, 4).join(", ");
  return localeCopy.trendRising.replace("{terms}", terms).replace("{count}", String(cleanSet.summaryLabels.length));
}
