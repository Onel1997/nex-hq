import type { ProviderProvenance } from "./provider-source";

/**
 * Canonical signal taxonomy — every provider normalizes into these categories
 * before the fusion engine sees them.
 */
export type NormalizedSignalCategory =
  | "social"
  | "trend"
  | "commerce"
  | "competitor"
  | "consumer"
  | "cultural"
  | "editorial";

export type SignalDirection = "up" | "down" | "stable" | "emerging" | "declining";

export type SignalEntityType =
  | "keyword"
  | "hashtag"
  | "product"
  | "listing"
  | "brand"
  | "designer"
  | "category"
  | "color"
  | "material"
  | "silhouette"
  | "price_band"
  | "creator"
  | "article"
  | "topic"
  | "unknown";

export interface SignalEntity {
  type: SignalEntityType;
  label: string;
  value?: string;
}

export interface NormalizedSignal {
  id: string;
  category: NormalizedSignalCategory;
  /** Short human label for the signal subject. */
  label: string;
  direction: SignalDirection;
  headline: string;
  detail?: string;
  /** Scalar value when the provider exposes one (price, count, score proxy, etc.). */
  value?: string;
  entities: SignalEntity[];
  tags: string[];
  provenance: ProviderProvenance;
  /** ISO timestamp when the underlying observation was recorded. */
  observedAt?: string;
  /** Safe opaque reference (product id, listing id, url key) — never full raw payloads. */
  rawReference?: string;
  /**
   * Reserved for Phase 5.1+ — fusion engine does not compute scores yet.
   * @internal scoring not implemented
   */
  rawScore?: number;
}
