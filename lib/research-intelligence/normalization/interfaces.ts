import type { BrandIntelligence } from "../types/brand";
import type { CommercialIntelligence } from "../types/commercial";
import type { MarketIntelligence } from "../types/market";
import type {
  IntelligenceDomain,
  ProviderContributionManifest,
  ProviderProvenance,
} from "../types/provider-source";
import type { NormalizedSignal } from "../types/signals";
import type { TrendIntelligence } from "../types/trends";
import type { NormalizationContext, NormalizationResult } from "./context";
import type { ProviderIntelligenceEnvelope } from "./envelope";

export interface NormalizedProviderIntelligence {
  provenance: ProviderProvenance;
  signals: NormalizedSignal[];
  trends: TrendIntelligence;
  market: MarketIntelligence;
  commercial: CommercialIntelligence;
  brand: BrandIntelligence;
  domains: IntelligenceDomain[];
}

export interface ProviderNormalizer {
  /** Must match envelope.sourceKey — used by registry routing only. */
  readonly sourceKey: ProviderProvenance["sourceKey"];
  normalize(
    envelope: ProviderIntelligenceEnvelope,
    context: NormalizationContext,
  ): NormalizedProviderIntelligence;
}

export interface NormalizerRegistration {
  normalizer: ProviderNormalizer;
  priority?: number;
}

export function buildContributionManifest(
  normalized: NormalizedProviderIntelligence,
): ProviderContributionManifest {
  return {
    sourceKey: normalized.provenance.sourceKey,
    mode: normalized.provenance.mode,
    syncedAt: normalized.provenance.syncedAt,
    signalCount: normalized.signals.length,
    sliceCount:
      normalized.signals.length +
      normalized.trends.rising.length +
      normalized.market.segments.length +
      normalized.commercial.products.length +
      normalized.brand.mentions.length,
    domains: normalized.domains,
  };
}

export type { NormalizationContext, NormalizationResult };
