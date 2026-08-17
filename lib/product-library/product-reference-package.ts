import { z } from "zod";

import type { ShopifyProductDetail } from "@/lib/shopify/fetch-product-detail";
import {
  productReferenceRoleSchema,
  productVisualReferenceSchema,
} from "@/lib/product-library/types";

export const PRODUCT_REFERENCE_PACKAGE_VERSION = "product-reference-package-v1" as const;

export const productReferencePackageSchema = z.object({
  schemaVersion: z.literal(PRODUCT_REFERENCE_PACKAGE_VERSION),
  packageId: z.string().min(1),
  authority: z.enum(["SHOPIFY_LIVE", "MANUAL_PROFILE", "SEED", "UNKNOWN"]),
  productProfileId: z.string().min(1).nullable(),
  shopifyProductId: z.string().min(1).nullable(),
  productVersion: z.string().min(1).nullable(),
  references: z.array(productVisualReferenceSchema),
  capturedAt: z.string().datetime(),
  provenance: z.string().min(1),
});

export const productVisualInputSchema = z.object({
  contractVersion: z.literal("product-visual-input-v1"),
  productProfileId: z.string().min(1).nullable(),
  authority: z.enum(["SHOPIFY_LIVE", "MANUAL_PROFILE", "SEED", "UNKNOWN"]),
  shopifyProductId: z.string().min(1).nullable(),
  variantId: z.string().min(1).nullable(),
  color: z.string().min(1).nullable(),
  material: z.string().min(1).nullable(),
  fit: z.string().min(1).nullable(),
  construction: z.record(z.string(), z.unknown()),
  referencePackage: productReferencePackageSchema,
});

export type ProductReferencePackage = z.infer<typeof productReferencePackageSchema>;
export type ProductVisualInput = z.infer<typeof productVisualInputSchema>;

function inferReferenceRole(
  altText: string | null,
  featured: boolean,
): z.infer<typeof productReferenceRoleSchema> {
  if (featured) return "FEATURED";
  const normalized = altText?.toLowerCase() ?? "";
  if (/\bfront\b/.test(normalized)) return "FRONT";
  if (/\bback\b|\brear\b/.test(normalized)) return "BACK";
  if (/\bside\b|\bprofile\b/.test(normalized)) return "SIDE";
  if (/\bdetail\b|\bclose[ -]?up\b|\bfabric\b|\bmaterial\b/.test(normalized)) {
    return "DETAIL";
  }
  return "UNCLASSIFIED";
}

/**
 * Captures durable Shopify media identity and metadata. URLs remain remote,
 * transient execution inputs; callers must never persist expiring signed URLs.
 * A role is inferred only from featured status or explicit alt text.
 */
export function buildShopifyProductReferencePackage(
  product: ShopifyProductDetail,
  capturedAt: string,
): ProductReferencePackage {
  const featuredUrl = product.imageUrl;
  return productReferencePackageSchema.parse({
    schemaVersion: PRODUCT_REFERENCE_PACKAGE_VERSION,
    packageId: `shopify:${product.id}:${product.updatedAt}`,
    authority: "SHOPIFY_LIVE",
    productProfileId: `shopify:${product.id}`,
    shopifyProductId: product.id,
    productVersion: product.updatedAt,
    capturedAt,
    provenance: "Shopify Admin GraphQL read-only product image metadata",
    references: product.imageReferences.map((image) => ({
      referenceId: image.id,
      source: "SHOPIFY_MEDIA",
      role: inferReferenceRole(image.altText, image.url === featuredUrl),
      sourceImageId: image.id,
      sourceUrl: image.url,
      privateStoragePath: null,
      width: image.width,
      height: image.height,
      altText: image.altText,
      variantIds: [],
    })),
  });
}
