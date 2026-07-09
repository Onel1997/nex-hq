import type {
  DataProvenanceMode,
  ProviderProvenance,
  ProviderSourceKey,
} from "../types";

/**
 * Opaque envelope from the provider layer.
 * Normalizers are the ONLY components allowed to inspect `payload`.
 * The fusion engine never receives raw payloads.
 */
export interface ProviderIntelligenceEnvelope {
  sourceKey: ProviderSourceKey;
  mode: DataProvenanceMode;
  syncedAt: string;
  apiVersion?: string;
  payload: unknown;
  summary?: string[];
  trending?: string[];
  error?: string;
}

export function envelopeProvenance(
  envelope: ProviderIntelligenceEnvelope,
): ProviderProvenance {
  return {
    sourceKey: envelope.sourceKey,
    mode: envelope.mode,
    syncedAt: envelope.syncedAt,
    apiVersion: envelope.apiVersion,
  };
}
