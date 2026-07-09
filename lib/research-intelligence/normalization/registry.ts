import type { ProviderSourceKey } from "../types";
import type { NormalizationContext } from "./context";
import type { ProviderIntelligenceEnvelope } from "./envelope";
import type {
  NormalizedProviderIntelligence,
  NormalizerRegistration,
  ProviderNormalizer,
} from "./interfaces";
import { emptyDomainSlices } from "../intelligence/domains";
import type { ProviderProvenance } from "../types/provider-source";

function emptyNormalized(
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

/**
 * Routes envelopes to registered normalizers.
 * Unknown providers yield empty normalized shells — never raw payload passthrough.
 */
export class NormalizerRegistry {
  private readonly normalizers = new Map<ProviderSourceKey, ProviderNormalizer>();

  register({ normalizer }: NormalizerRegistration): void {
    this.normalizers.set(normalizer.sourceKey, normalizer);
  }

  registerMany(registrations: NormalizerRegistration[]): void {
    for (const registration of registrations) {
      this.register(registration);
    }
  }

  has(sourceKey: ProviderSourceKey): boolean {
    return this.normalizers.has(sourceKey);
  }

  normalize(
    envelope: ProviderIntelligenceEnvelope,
    context: NormalizationContext,
  ): NormalizedProviderIntelligence {
    const normalizer = this.normalizers.get(envelope.sourceKey);
    if (!normalizer) {
      return emptyNormalized({
        sourceKey: envelope.sourceKey,
        mode: envelope.mode,
        syncedAt: envelope.syncedAt,
        apiVersion: envelope.apiVersion,
      });
    }
    return normalizer.normalize(envelope, context);
  }

  normalizeMany(
    envelopes: ProviderIntelligenceEnvelope[],
    context: NormalizationContext,
  ): NormalizedProviderIntelligence[] {
    return envelopes.map((envelope) => this.normalize(envelope, context));
  }
}

export function createNormalizerRegistry(
  registrations: NormalizerRegistration[] = [],
): NormalizerRegistry {
  const registry = new NormalizerRegistry();
  registry.registerMany(registrations);
  return registry;
}
