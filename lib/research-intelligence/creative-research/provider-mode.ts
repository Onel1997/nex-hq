/**
 * Provider mode gating + transparent cost estimates.
 */

import type { ProviderCostEstimate, ProviderMode, RunProviderUsage } from "./types";

export const DEFAULT_PROVIDER_MODE: ProviderMode = "creative_only";

export const PROVIDER_MODE_LABELS: Record<ProviderMode, string> = {
  creative_only: "Creative Only",
  shopify_assisted: "Shopify Assisted",
  full_intelligence: "Full Intelligence",
};

export function allowedProviderKeys(mode: ProviderMode): string[] | "all" {
  switch (mode) {
    case "creative_only":
      return [];
    case "shopify_assisted":
      return ["shopify"];
    case "full_intelligence":
      return "all";
  }
}

export function shouldSyncProviders(mode: ProviderMode): boolean {
  return mode !== "creative_only";
}

export function shouldRunPatternIntelligence(mode: ProviderMode): boolean {
  return mode === "shopify_assisted" || mode === "full_intelligence";
}

export function shouldRunFullFusionPipeline(mode: ProviderMode): boolean {
  return mode === "full_intelligence";
}

export interface CostEstimateOptions {
  /** True only when an LLM call actually runs for creative generation. */
  llmCalled?: boolean;
}

/**
 * Honest cost estimate.
 * Deterministic Creative Only (no LLM, no providers) → exactly 0,00 €.
 */
export function estimateProviderCost(
  mode: ProviderMode,
  options: CostEstimateOptions = {},
): ProviderCostEstimate {
  const llmCalled = options.llmCalled ?? false;

  if (mode === "creative_only") {
    const creativeMin = llmCalled ? 0.02 : 0;
    const creativeMax = llmCalled ? 0.05 : 0;
    return {
      providerMode: mode,
      currency: "EUR",
      estimatedMin: creativeMin,
      estimatedMax: creativeMax,
      creativeGenerationMin: creativeMin,
      creativeGenerationMax: creativeMax,
      externalProvidersMin: 0,
      externalProvidersMax: 0,
      llmCalled,
      breakdown: [
        {
          item: llmCalled
            ? "Creative Generation (LLM)"
            : "Creative Generation (deterministischer Fallback, kein LLM)",
          category: "creative_generation",
          estimatedCostMin: creativeMin,
          estimatedCostMax: creativeMax,
          optional: false,
          skipped: !llmCalled,
        },
        {
          item: "External Providers",
          category: "external_providers",
          estimatedCostMin: 0,
          estimatedCostMax: 0,
          optional: false,
          skipped: true,
        },
      ],
      note: llmCalled
        ? "Creative Only mit LLM: nur Creative Generation kostet. Keine Provider-Syncs."
        : "Creative Only ohne LLM und ohne Provider-Sync: Estimated Total 0,00 €.",
    };
  }

  if (mode === "shopify_assisted") {
    const creativeMin = llmCalled ? 0.02 : 0;
    const creativeMax = llmCalled ? 0.05 : 0;
    return {
      providerMode: mode,
      currency: "EUR",
      estimatedMin: 0.02 + creativeMin,
      estimatedMax: 0.04 + creativeMax,
      creativeGenerationMin: creativeMin,
      creativeGenerationMax: creativeMax,
      externalProvidersMin: 0.02,
      externalProvidersMax: 0.04,
      llmCalled,
      breakdown: [
        {
          item: llmCalled
            ? "Creative Generation (LLM)"
            : "Creative Generation (deterministisch)",
          category: "creative_generation",
          estimatedCostMin: creativeMin,
          estimatedCostMax: creativeMax,
          optional: true,
          skipped: !llmCalled,
        },
        {
          item: "External Providers (Shopify Sync)",
          category: "external_providers",
          estimatedCostMin: 0.02,
          estimatedCostMax: 0.04,
          optional: false,
          skipped: false,
        },
      ],
      note: "Shopify Assisted: Provider-Kosten und optionale Creative Generation getrennt ausgewiesen.",
    };
  }

  const creativeMin = llmCalled ? 0.03 : 0;
  const creativeMax = llmCalled ? 0.08 : 0;
  return {
    providerMode: mode,
    currency: "EUR",
    estimatedMin: 0.1 + creativeMin,
    estimatedMax: 0.35 + creativeMax,
    creativeGenerationMin: creativeMin,
    creativeGenerationMax: creativeMax,
    externalProvidersMin: 0.1,
    externalProvidersMax: 0.35,
    llmCalled,
    breakdown: [
      {
        item: llmCalled
          ? "Creative Generation (LLM)"
          : "Creative Generation (deterministisch)",
        category: "creative_generation",
        estimatedCostMin: creativeMin,
        estimatedCostMax: creativeMax,
        optional: true,
        skipped: !llmCalled,
      },
      {
        item: "External Providers (Full Sync)",
        category: "external_providers",
        estimatedCostMin: 0.1,
        estimatedCostMax: 0.35,
        optional: false,
        skipped: false,
      },
    ],
    note: "Full Intelligence: Provider-Sync und Creative Generation getrennt.",
  };
}

export function buildProviderUsage(
  mode: ProviderMode,
  options: {
    usedProviders?: string[];
    connectedProviders?: string[];
  } = {},
): RunProviderUsage {
  const usedProviders = options.usedProviders ?? [];
  const connected = options.connectedProviders ?? [];
  const connectedButUnused = connected.filter((key) => !usedProviders.includes(key));

  if (mode === "creative_only") {
    return {
      providerMode: mode,
      providerSyncCount: 0,
      usedProviders: [],
      connectedButUnused: connected,
      notes: connected.map(
        (key) =>
          `${formatProviderLabel(key)} ist verbunden, wurde in diesem Creative-Only-Lauf jedoch nicht abgefragt.`,
      ),
    };
  }

  return {
    providerMode: mode,
    providerSyncCount: usedProviders.length,
    usedProviders,
    connectedButUnused,
    notes: [
      ...usedProviders.map((key) => `${formatProviderLabel(key)}: In diesem Lauf verwendet`),
      ...connectedButUnused.map(
        (key) =>
          `${formatProviderLabel(key)} ist verbunden, wurde in diesem Lauf jedoch nicht abgefragt.`,
      ),
    ],
  };
}

function formatProviderLabel(key: string): string {
  const labels: Record<string, string> = {
    google_trends: "Google Trends",
    shopify: "Shopify",
    tiktok: "TikTok",
    pinterest: "Pinterest",
    amazon: "Amazon",
    etsy: "Etsy",
    youtube: "YouTube",
    reddit: "Reddit",
  };
  return labels[key] ?? key;
}

export function parseProviderMode(value: unknown): ProviderMode {
  if (value === "shopify_assisted" || value === "full_intelligence" || value === "creative_only") {
    return value;
  }
  return DEFAULT_PROVIDER_MODE;
}

export function parseResearchMode(
  value: unknown,
): "trend_intelligence" | "weekly_design_ideas" | "collection_creator" {
  if (
    value === "trend_intelligence" ||
    value === "weekly_design_ideas" ||
    value === "collection_creator"
  ) {
    return value;
  }
  return "weekly_design_ideas";
}
