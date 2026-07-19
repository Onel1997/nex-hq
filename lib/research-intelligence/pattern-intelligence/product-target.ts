export const CORE_PRODUCT_TARGETS = [
  "Oversized T-Shirt",
  "Heavyweight Hoodie",
  "Zip Hoodie",
  "Long Sleeve",
  "Accessoire",
] as const;

export type CoreProductTarget = (typeof CORE_PRODUCT_TARGETS)[number];

const TARGET_PATTERNS: Array<{ pattern: RegExp; target: CoreProductTarget }> = [
  { pattern: /heavyweight\s+hoodie|premium\s+heavyweight\s+hoodie/i, target: "Heavyweight Hoodie" },
  { pattern: /zip\s+hoodie/i, target: "Zip Hoodie" },
  { pattern: /long\s*sleeve/i, target: "Long Sleeve" },
  { pattern: /oversized\s+t-?shirt|oversized\s+tee|boxy\s+tee/i, target: "Oversized T-Shirt" },
  { pattern: /accessoire|accessory|beanie|cap|headwear/i, target: "Accessoire" },
];

const NON_DEFAULT_CATEGORY_SIGNALS = /\bshorts\b|\bpants\b|\bjogger\b|\bskirt\b/i;

function matchTarget(corpus: string): CoreProductTarget | null {
  for (const { pattern, target } of TARGET_PATTERNS) {
    if (pattern.test(corpus)) return target;
  }
  return null;
}

export interface ProductTargetInput {
  userRequest?: string;
  patternSilhouette?: string;
  intelligenceCorpus?: string;
}

/**
 * Resolves the recommended core product target.
 * Priority: user request → strongest relevant signal → Milaene core catalog → pattern context.
 */
export function resolveProductTarget(input: ProductTargetInput): CoreProductTarget {
  const userRequest = input.userRequest?.trim() ?? "";
  const corpus = [userRequest, input.patternSilhouette, input.intelligenceCorpus]
    .filter(Boolean)
    .join(" ");

  if (userRequest) {
    const fromRequest = matchTarget(userRequest);
    if (fromRequest) return fromRequest;
  }

  if (input.intelligenceCorpus && !NON_DEFAULT_CATEGORY_SIGNALS.test(userRequest)) {
    const fromSignals = matchTarget(input.intelligenceCorpus);
    if (fromSignals) return fromSignals;
  }

  if (input.patternSilhouette) {
    const fromPattern = matchTarget(input.patternSilhouette);
    if (fromPattern) return fromPattern;
  }

  if (userRequest && matchTarget(corpus)) {
    return matchTarget(corpus)!;
  }

  return "Oversized T-Shirt";
}

export function buildDesignStudioNextStep(
  silhouette: string,
  designDirection: string | null,
): string {
  const direction = designDirection
    ? designDirection
        .replace(/^Explore "|" as a design direction$/gi, "")
        .replace(/^Graphic theme:\s*/i, "")
        .trim()
    : "erfolgreichen Designmustern";

  return `Design Studio mit ${silhouette} briefen — Richtung „${direction}" anhand der extrahierten Muster, ohne bestehende Produkte zu kopieren.`;
}
