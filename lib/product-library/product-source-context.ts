import { z } from "zod";

export const productSourceProviderSchema = z.enum([
  "MARKETPRINT",
  "BRANDSKY",
  "BRANDCANYON",
  "OTHER",
  "UNKNOWN",
]);
export const productSourceAuthoritySchema = z.enum([
  "SHOPIFY_METADATA",
  "OWNER_CONFIRMED",
  "UNKNOWN",
]);
export const productSourceEvidenceSchema = z.object({
  field: z.enum(["VENDOR", "TAG", "METAFIELD", "FULFILLMENT_SERVICE", "MANUAL"]),
  value: z.string().min(1),
}).strict();
export const productSourceContextSchema = z.object({
  sourceProvider: productSourceProviderSchema.default("UNKNOWN"),
  authority: productSourceAuthoritySchema.default("UNKNOWN"),
  evidence: z.array(productSourceEvidenceSchema).default([]),
  lastVerifiedAt: z.string().datetime().nullable().default(null),
}).strict();

export type ProductSourceContext = z.infer<typeof productSourceContextSchema>;

const KNOWN: Record<string, z.infer<typeof productSourceProviderSchema>> = {
  marketprint: "MARKETPRINT",
  brandsky: "BRANDSKY",
  brandcanyon: "BRANDCANYON",
};

function exactProvider(value: string): z.infer<typeof productSourceProviderSchema> | null {
  return KNOWN[value.trim().toLocaleLowerCase("de-DE")] ?? null;
}

function providerFromTag(tag: string): z.infer<typeof productSourceProviderSchema> | null {
  const normalized = tag.trim().toLocaleLowerCase("de-DE");
  const explicit = /^(?:supplier|source|vendor):\s*(marketprint|brandsky|brandcanyon)$/.exec(normalized);
  return exactProvider(explicit?.[1] ?? normalized);
}

/**
 * Uses only explicit Shopify metadata. Product titles and fuzzy matching are
 * deliberately excluded: unknown or conflicting evidence remains UNKNOWN.
 */
export function deriveShopifyProductSourceContext(input: {
  vendor?: string | null;
  tags?: string[];
  capturedAt: string;
}): ProductSourceContext {
  const evidence: Array<z.infer<typeof productSourceEvidenceSchema>> = [];
  const providers = new Set<z.infer<typeof productSourceProviderSchema>>();
  const vendor = input.vendor?.trim();
  if (vendor) {
    evidence.push({ field: "VENDOR", value: vendor });
    const provider = exactProvider(vendor);
    if (provider) providers.add(provider);
  }
  for (const tag of input.tags ?? []) {
    const provider = providerFromTag(tag);
    if (!provider) continue;
    providers.add(provider);
    evidence.push({ field: "TAG", value: tag });
  }
  if (providers.size === 1) {
    return productSourceContextSchema.parse({
      sourceProvider: [...providers][0],
      authority: "SHOPIFY_METADATA",
      evidence,
      lastVerifiedAt: input.capturedAt,
    });
  }
  return productSourceContextSchema.parse({
    sourceProvider: "UNKNOWN",
    authority: "UNKNOWN",
    evidence,
    lastVerifiedAt: evidence.length ? input.capturedAt : null,
  });
}

export function preserveOwnerConfirmedProductSource(
  current: ProductSourceContext | null | undefined,
  shopify: ProductSourceContext,
): ProductSourceContext {
  return current?.authority === "OWNER_CONFIRMED" ? current : shopify;
}

export const PRODUCT_SOURCE_OWNER_LABELS: Record<z.infer<typeof productSourceProviderSchema>, string> = {
  MARKETPRINT: "MarketPrint",
  BRANDSKY: "Brandsky",
  BRANDCANYON: "Brandcanyon",
  OTHER: "Andere Produktquelle",
  UNKNOWN: "Produktquelle unbekannt",
};
