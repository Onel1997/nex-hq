/**
 * Brand Rules — voice, copy, naming, and compliance guardrails.
 */

export type BrandRuleSeverity = "must" | "should" | "avoid";

export interface BrandRule {
  id: string;
  category: "voice" | "copy" | "naming" | "compliance" | "channel" | "other";
  rule: string;
  severity: BrandRuleSeverity;
  examples?: {
    good?: string[];
    bad?: string[];
  };
}

export interface BrandRulesContent {
  kind: "brand_rules";
  rules: BrandRule[];
  globalConstraints?: string[];
  channelOverrides?: Record<string, string[]>;
}
