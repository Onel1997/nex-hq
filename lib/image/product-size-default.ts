const OVERSIZED_PATTERN = /oversized|heavy|unisex|boxy|baggy/i;

export type ModelGarmentSizePreference = {
  preferredGarmentSize?: string | null;
};

const DEFAULT_SIZE_ORDER = ["M", "L", "S", "XL", "XXL", "XS"] as const;
const OVERSIZED_SIZE_ORDER = ["L", "M", "XL", "S", "XXL", "XS"] as const;

function normalizeSizeToken(size: string): string {
  return size
    .trim()
    .toLocaleUpperCase("de-DE")
    .replace(/^GR(?:O|Ö)SSE\s*/i, "")
    .replace(/^SIZE\s*/i, "");
}

/**
 * Deterministic default model size for mockup production.
 * Later Brand Models can supply `preferredGarmentSize`; until then prefer L on oversized garments.
 */
export function resolveDefaultGarmentSize(input: {
  availableSizes: readonly string[];
  garmentFamilyLabel: string;
  productType?: string | null;
  modelPreference?: ModelGarmentSizePreference | null;
}): string | null {
  const available = input.availableSizes
    .map((size) => size.trim())
    .filter(Boolean);
  if (!available.length) return null;

  const normalized = available.map((raw) => ({
    raw,
    token: normalizeSizeToken(raw),
  }));

  const preferred = input.modelPreference?.preferredGarmentSize?.trim();
  if (preferred) {
    const preferredToken = normalizeSizeToken(preferred);
    const exact = normalized.find((entry) => entry.token === preferredToken);
    if (exact) return exact.raw;
  }

  const order =
    OVERSIZED_PATTERN.test(`${input.garmentFamilyLabel} ${input.productType ?? ""}`)
      ? OVERSIZED_SIZE_ORDER
      : DEFAULT_SIZE_ORDER;

  for (const candidate of order) {
    const match = normalized.find((entry) => entry.token === candidate);
    if (match) return match.raw;
  }

  return available[0] ?? null;
}
