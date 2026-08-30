import { z } from "zod";
import type { ShopifyCatalog } from "@/lib/shopify/types";
import { fetchShopifyCatalog } from "@/lib/shopify/fetch-catalog";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import {
  normalizeRfc3339Timestamp,
  rfc3339DateTimeSchema,
} from "@/lib/datetime/rfc3339";

export const PRODUCT_PRODUCTION_CONTEXT_VERSION =
  "product-production-context-v1" as const;

export const PRODUCT_PRODUCTION_AUTHORITIES = [
  "SHOPIFY_LIVE",
  "MANUAL_PROFILE",
  "DESIGN_HANDOFF_LOCAL",
  "SEED",
  "BRAIN",
  "UNKNOWN",
] as const;

export const productProductionContextSchema = z
  .object({
    version: z.literal(PRODUCT_PRODUCTION_CONTEXT_VERSION),
    productId: z.string().min(1).nullable(),
    variantId: z.string().min(1).nullable(),
    productName: z.string().min(1),
    productType: z.string().min(1),
    color: z.string().min(1).nullable(),
    size: z.string().min(1).nullable(),
    material: z.string().min(1).nullable(),
    fit: z.string().min(1).nullable(),
    collection: z.string().min(1).nullable(),
    availability: z.enum(["AVAILABLE", "UNAVAILABLE", "UNKNOWN"]),
    active: z.boolean().nullable(),
    authority: z.enum(PRODUCT_PRODUCTION_AUTHORITIES),
    authoritative: z.boolean(),
    provenance: z
      .object({
        source: z.string().min(1),
        sourceRecordId: z.string().min(1).nullable(),
        capturedAt: rfc3339DateTimeSchema,
        sourceVersion: z.string().min(1).nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.authority === "SHOPIFY_LIVE") {
      if (!value.productId || !value.authoritative) {
        ctx.addIssue({
          code: "custom",
          message:
            "Shopify-live production context requires a verified product ID and authoritative=true.",
        });
      }
    } else if (value.authoritative) {
      ctx.addIssue({
        code: "custom",
        message: "Only server-verified Shopify-live context is authoritative.",
      });
    }
    if (value.variantId && !value.productId) {
      ctx.addIssue({
        code: "custom",
        message: "A variant ID cannot exist without a product ID.",
      });
    }
  });

export type ProductProductionContext = z.infer<
  typeof productProductionContextSchema
>;

const nonAuthoritativeProductSelectionSchema = z
  .object({
    authority: z.enum(["DESIGN_HANDOFF_LOCAL", "SEED", "BRAIN", "UNKNOWN"]),
    productId: z.string().min(1).nullable().default(null),
    variantId: z.string().min(1).nullable().default(null),
    productName: z.string().min(1),
    productType: z.string().min(1),
    color: z.string().min(1).nullable(),
    size: z.string().min(1).nullable().default(null),
    material: z.string().min(1).nullable().default(null),
    fit: z.string().min(1).nullable().default(null),
    collection: z.string().min(1).nullable().default(null),
    availability: z.enum(["AVAILABLE", "UNAVAILABLE", "UNKNOWN"]).default("UNKNOWN"),
    active: z.boolean().nullable().default(null),
    provenance: z.string().min(1),
    sourceVersion: z.string().min(1).nullable().default(null),
    capturedAt: rfc3339DateTimeSchema,
  })
  .strict();

export const productProductionSelectionSchema = z.discriminatedUnion(
  "authority",
  [
    z
      .object({
        authority: z.literal("SHOPIFY_LIVE"),
        productId: z.string().min(1),
        variantId: z.string().min(1).nullable().default(null),
      })
      .strict(),
    z.object({
      authority: z.literal("MANUAL_PROFILE"),
      productProfileId: z.string().min(1),
      profileVersion: z.number().int().positive(),
      variantId: z.string().min(1),
    }).strict(),
    nonAuthoritativeProductSelectionSchema,
  ],
);

export type ProductProductionSelection = z.infer<
  typeof productProductionSelectionSchema
>;

function optionValue(
  selectedOptions: Array<{ name: string; value: string }>,
  matcher: RegExp,
): string | null {
  return (
    selectedOptions.find((option) => matcher.test(option.name.trim()))?.value.trim() ||
    null
  );
}

export async function resolveProductProductionContext(
  selection: ProductProductionSelection,
  dependencies: { fetchCatalog?: () => Promise<ShopifyCatalog>; now?: () => string } = {},
): Promise<ProductProductionContext> {
  const parsed = productProductionSelectionSchema.parse(selection);
  const now = normalizeRfc3339Timestamp(
    dependencies.now?.() ?? new Date().toISOString(),
  );

  if (parsed.authority !== "SHOPIFY_LIVE") {
    if (parsed.authority === "MANUAL_PROFILE") {
      throw new PersonaDomainError(
        "Manual Product context must be resolved from the durable workspace-scoped Product Profile repository.",
        "WORKFLOW",
      );
    }
    return productProductionContextSchema.parse({
      version: PRODUCT_PRODUCTION_CONTEXT_VERSION,
      productId: parsed.productId,
      variantId: parsed.variantId,
      productName: parsed.productName,
      productType: parsed.productType,
      color: parsed.color,
      size: parsed.size,
      material: parsed.material,
      fit: parsed.fit,
      collection: parsed.collection,
      availability: parsed.availability,
      active: parsed.active,
      authority: parsed.authority,
      authoritative: false,
      provenance: {
        source: parsed.provenance,
        sourceRecordId: parsed.productId,
        capturedAt: normalizeRfc3339Timestamp(parsed.capturedAt),
        sourceVersion: parsed.sourceVersion
          ? normalizeRfc3339Timestamp(parsed.sourceVersion)
          : parsed.sourceVersion,
      },
    });
  }

  const catalog = await (dependencies.fetchCatalog ?? fetchShopifyCatalog)();
  const product = catalog.products.find((item) => item.id === parsed.productId);
  if (!product) {
    throw new PersonaDomainError(
      "The selected Shopify product was not found in the live catalog.",
      "WORKFLOW",
    );
  }
  const variant = parsed.variantId
    ? product.variants.find((item) => item.id === parsed.variantId)
    : null;
  if (parsed.variantId && !variant) {
    throw new PersonaDomainError(
      "The selected Shopify variant was not found on the live product.",
      "WORKFLOW",
    );
  }
  const active = product.status.toUpperCase() === "ACTIVE";
  if (!active) {
    throw new PersonaDomainError(
      "The selected Shopify product is not active.",
      "WORKFLOW",
    );
  }

  return productProductionContextSchema.parse({
    version: PRODUCT_PRODUCTION_CONTEXT_VERSION,
    productId: product.id,
    variantId: variant?.id ?? null,
    productName: product.title,
    productType: product.productType,
    color: variant
      ? optionValue(variant.selectedOptions, /^(color|colour|farbe|couleur)$/i)
      : null,
    size: variant
      ? optionValue(variant.selectedOptions, /^(size|größe|groesse|taille)$/i)
      : null,
    material: null,
    fit: null,
    collection: product.collections[0] ?? null,
    availability: variant
      ? variant.availableForSale
        ? "AVAILABLE"
        : "UNAVAILABLE"
      : "UNKNOWN",
    active,
    authority: "SHOPIFY_LIVE",
    authoritative: true,
    provenance: {
      source: "Shopify Admin GraphQL live read",
      sourceRecordId: variant?.id ?? product.id,
      capturedAt: now,
      sourceVersion: normalizeRfc3339Timestamp(
        variant?.updatedAt ?? product.updatedAt,
      ),
    },
  });
}

export function productContextsEqual(
  left: ProductProductionContext,
  right: ProductProductionContext,
): boolean {
  return JSON.stringify(productProductionContextSchema.parse(left)) ===
    JSON.stringify(productProductionContextSchema.parse(right));
}
