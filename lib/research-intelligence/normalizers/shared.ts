import { emptyDomainSlices } from "../intelligence/domains";
import type { NormalizedProviderIntelligence } from "../normalization/interfaces";
import { envelopeProvenance } from "../normalization/envelope";
import type { ProviderIntelligenceEnvelope } from "../normalization/envelope";
import type { BrandIntelligence } from "../types/brand";
import type { CommercialIntelligence } from "../types/commercial";
import type { IntelligenceDomain, ProviderProvenance } from "../types/provider-source";
import type {
  NormalizedSignal,
  NormalizedSignalCategory,
  SignalDirection,
  SignalEntity,
  SignalEntityType,
} from "../types/signals";
import type { TrendHorizon, TrendIntelligence, TrendSubjectType } from "../types/trends";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractPayload<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (isRecord(payload) && Object.keys(payload).length === 0) return null;
  return payload as T;
}

export function emptyNormalized(
  provenance: ProviderProvenance,
): NormalizedProviderIntelligence {
  const slices = emptyDomainSlices();
  return {
    provenance,
    signals: [],
    ...slices,
    domains: [],
  };
}

export function normalizeFromEnvelope<T>(
  envelope: ProviderIntelligenceEnvelope,
  map: (data: T, provenance: ProviderProvenance) => NormalizedProviderIntelligence,
): NormalizedProviderIntelligence {
  const provenance = envelopeProvenance(envelope);
  const data = extractPayload<T>(envelope.payload);
  if (!data) return emptyNormalized(provenance);
  try {
    return map(data, provenance);
  } catch {
    return emptyNormalized(provenance);
  }
}

export function signalId(sourceKey: string, suffix: string): string {
  return `${sourceKey}-${suffix}`.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 120);
}

export interface BuildSignalInput {
  id: string;
  category: NormalizedSignalCategory;
  label: string;
  headline: string;
  detail?: string;
  value?: string;
  direction?: SignalDirection;
  entities?: SignalEntity[];
  tags?: string[];
  provenance: ProviderProvenance;
  observedAt?: string;
  rawReference?: string;
}

export function buildSignal(input: BuildSignalInput): NormalizedSignal {
  return {
    id: input.id,
    category: input.category,
    label: input.label,
    direction: input.direction ?? "stable",
    headline: input.headline,
    detail: input.detail,
    value: input.value,
    entities: input.entities ?? [],
    tags: input.tags ?? [],
    provenance: input.provenance,
    observedAt: input.observedAt ?? input.provenance.syncedAt,
    rawReference: input.rawReference,
  };
}

export function entity(
  type: SignalEntityType,
  label: string,
  value?: string,
): SignalEntity {
  return { type, label, value };
}

export function directionFromChange(change?: number): SignalDirection {
  if (change == null || Number.isNaN(change)) return "stable";
  if (change > 5) return "up";
  if (change < -5) return "down";
  return "stable";
}

export function directionFromTrend(
  trend?: "rising" | "stable" | "declining" | string,
): SignalDirection {
  if (trend === "rising") return "up";
  if (trend === "declining") return "declining";
  if (trend === "emerging") return "emerging";
  return "stable";
}

export function mentionClusters(
  mentions: Array<{ term: string; count: number }>,
  subjectType: TrendSubjectType,
  provenance: ProviderProvenance,
  prefix: string,
  horizon: TrendHorizon = "immediate",
): TrendIntelligence["rising"] {
  return mentions
    .filter((m) => m.term.trim())
    .map((mention, index) => ({
      id: signalId(prefix, `${subjectType}-${index}-${mention.term}`),
      label: mention.term,
      subjectType,
      observations: [
        {
          id: signalId(prefix, `obs-${index}`),
          subject: mention.term,
          subjectType,
          direction: "up" as const,
          horizon,
          mentionCount: mention.count,
          provenance,
        },
      ],
      relatedTerms: [],
    }));
}

export function deriveDomains(slices: {
  signals: NormalizedSignal[];
  trends: TrendIntelligence;
  market: { segments: unknown[]; priceBands: unknown[]; movements: unknown[] };
  commercial: { products: unknown[]; demandIndicators: unknown[] };
  brand: { mentions: unknown[]; designers: unknown[] };
}): IntelligenceDomain[] {
  const domains: IntelligenceDomain[] = [];
  if (slices.signals.length > 0) domains.push("signal");
  if (
    slices.trends.rising.length +
      slices.trends.emerging.length +
      slices.trends.declining.length +
      slices.trends.opportunities.length >
    0
  ) {
    domains.push("trend");
  }
  if (
    slices.market.segments.length +
      slices.market.priceBands.length +
      slices.market.movements.length >
    0
  ) {
    domains.push("market");
  }
  if (slices.commercial.products.length + slices.commercial.demandIndicators.length > 0) {
    domains.push("commercial");
  }
  if (slices.brand.mentions.length + slices.brand.designers.length > 0) {
    domains.push("brand");
  }
  return domains;
}

export function finalizeBundle(
  provenance: ProviderProvenance,
  signals: NormalizedSignal[],
  trends: TrendIntelligence,
  market: import("../types/market").MarketIntelligence,
  commercial: CommercialIntelligence,
  brand: BrandIntelligence,
): NormalizedProviderIntelligence {
  const bundle = { provenance, signals, trends, market, commercial, brand };
  return { ...bundle, domains: deriveDomains(bundle) };
}

export function mapBrandMentions(
  mentions: Array<{ term: string; count: number }>,
  provenance: ProviderProvenance,
  prefix: string,
  signalType: BrandIntelligence["mentions"][number]["signalType"] = "mention",
) {
  return mentions
    .filter((m) => m.term.trim())
    .map((mention, index) => ({
      id: signalId(prefix, `brand-${index}`),
      name: mention.term,
      mentionCount: mention.count,
      signalType,
      provenance,
    }));
}
