/**
 * Canonical German-facing product and silhouette labels.
 */

const SILHOUETTE_ALIASES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /zip[\s-]?hoodie|hoodie\s+zip/i, canonical: "Zip Hoodie" },
  {
    pattern: /premium\s+heavyweight\s+hoodie|heavyweight\s+hooded|heavy\s+hoodie|heavyweight\s+hoodie/i,
    canonical: "Heavyweight Hoodie",
  },
  { pattern: /oversize[d]?\s+hoodie/i, canonical: "Oversized Hoodie" },
  { pattern: /oversize[d]?\s+t-?shirt|oversize[d]?\s+tee|boxy\s+tee/i, canonical: "Oversized T-Shirt" },
  { pattern: /long\s*sleeve/i, canonical: "Long Sleeve" },
  { pattern: /zip\s+hoodie/i, canonical: "Zip Hoodie" },
];

const INCOMPLETE_SILHOUETTE_RE =
  /^(oversized|oversize|heavyweight|heavy|premium|cotton|hoodie|zip|fleece)$/i;

const GSM_RE = /(\d{3})\s*gsm/i;

export function isIncompleteSilhouette(label: string): boolean {
  const trimmed = label.trim();
  if (!trimmed) return true;
  if (INCOMPLETE_SILHOUETTE_RE.test(trimmed)) return true;
  const words = trimmed.split(/\s+/);
  return words.length === 1 && INCOMPLETE_SILHOUETTE_RE.test(words[0]);
}

export function normalizeSilhouetteLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed || isIncompleteSilhouette(trimmed)) return null;

  for (const { pattern, canonical } of SILHOUETTE_ALIASES) {
    if (pattern.test(trimmed)) return canonical;
  }

  if (/sherpa|jacke|jacket|shorts|pants|cargo|footwear|beanie|mütze|hat|tee\b|t-shirt/i.test(trimmed)) {
    return trimmed;
  }

  if (/hoodie/i.test(trimmed) && !isIncompleteSilhouette(trimmed)) {
    if (/zip/i.test(trimmed)) return "Zip Hoodie";
    if (/heavyweight|heavy|premium/i.test(trimmed)) return "Heavyweight Hoodie";
    if (/oversized|oversize/i.test(trimmed)) return "Oversized Hoodie";
    return "Heavyweight Hoodie";
  }

  return trimmed;
}

export function silhouetteDedupeKey(label: string): string {
  const canonical = normalizeSilhouetteLabel(label);
  return (canonical ?? label).toLowerCase().replace(/\s+/g, " ").trim();
}

export function dedupeSilhouettes(labels: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const label of labels) {
    const canonical = normalizeSilhouetteLabel(label);
    if (!canonical) continue;
    const key = silhouetteDedupeKey(canonical);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(canonical);
  }
  return result;
}

export function normalizeGsmTrait(trait: string): string | null {
  const match = trait.match(GSM_RE);
  if (!match) return null;
  return `${match[1]} GSM`;
}

export function normalizeFabricTrait(trait: string): string | null {
  const lower = trait.toLowerCase();
  if (GSM_RE.test(trait)) return null;
  if (/heavyweight\s+fleece|fleece/i.test(lower)) return "Heavyweight Fleece";
  if (/organic\s+cotton/i.test(lower)) return "Organic Cotton";
  if (/heavyweight\s+cotton/i.test(lower)) return "Heavyweight Cotton";
  if (/cotton/i.test(lower)) return "Cotton";
  if (/french\s+terry/i.test(lower)) return "French Terry";
  return null;
}

export function partitionMaterialTraits(traits: string[]): {
  weights: string[];
  fabrics: string[];
} {
  const weights: string[] = [];
  const fabrics: string[] = [];
  const seenWeights = new Set<string>();
  const seenFabrics = new Set<string>();

  for (const trait of traits) {
    const gsm = normalizeGsmTrait(trait);
    if (gsm) {
      const key = gsm.toLowerCase();
      if (!seenWeights.has(key)) {
        seenWeights.add(key);
        weights.push(gsm);
      }
      continue;
    }
    const fabric = normalizeFabricTrait(trait);
    if (fabric) {
      const key = fabric.toLowerCase();
      if (!seenFabrics.has(key)) {
        seenFabrics.add(key);
        fabrics.push(fabric);
      }
    }
  }

  weights.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  return { weights, fabrics };
}

export function dedupeMaterialTraits(traits: string[]): string[] {
  const { weights, fabrics } = partitionMaterialTraits(traits);
  return [...weights, ...fabrics];
}
