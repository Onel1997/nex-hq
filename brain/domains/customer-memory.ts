/**
 * Customer Memory — SaaS HQ industry domain.
 */

export type CustomerTier = "free" | "starter" | "pro" | "enterprise";
export type CustomerHealth = "healthy" | "at_risk" | "churned";

export interface CustomerSegment {
  name: string;
  tier: CustomerTier;
  count?: number;
  mrr?: number;
  currency?: string;
}

export interface CustomerMemoryContent {
  kind: "customer_memory";
  segments: CustomerSegment[];
  icpDescription?: string;
  churnReasons?: string[];
  featureRequests?: string[];
  npsScore?: number;
  healthSummary?: CustomerHealth;
}
