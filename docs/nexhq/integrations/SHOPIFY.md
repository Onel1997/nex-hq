# Shopify

Status: Canonical Current-State Integration Note  
Last verified against code: 2026-08-17  
Implementation status: **PARTIAL — live read-only Image seam implemented; not universal product authority**

## Current State

The existing Shopify Admin GraphQL integration can read the live catalog. The Image product selector now requests a protected read-only projection with exact product IDs, status, type, collections, update timestamps, and variant IDs/options/SKU/availability/inventory metadata.

`ProductProductionContext` classifies every production source as:

- `SHOPIFY_LIVE`
- `DESIGN_HANDOFF_LOCAL`
- `SEED`
- `BRAIN`
- `UNKNOWN`

Only a server resolution of the selected IDs against the current Shopify response may create `SHOPIFY_LIVE` with `authoritative: true`. Missing variants and inactive products fail closed. A product without an exact selected variant carries `variantId: null`; NexHQ does not invent variant precision. Color and size are derived only from the selected live variant options. Material/fit remain unknown unless the authority supplies them.

Local Design/seed/Brain context remains visibly non-authoritative and keeps source, capture time, and version provenance. Zip Hoodies and Zippers remain valid product types. A read-only verification on 2026-08-17 returned 78 products and 18 collections and confirmed active Heavy Zip Hoodie/Oversized Zipper records with exact variants. No product, variant, collection, inventory, publication, or Shopify setting was mutated.

## Remaining Scope

This seam makes live Shopify authoritative for Image preparation when explicitly selected and verified; it does not make the separate Product Intelligence synchronous seed path Shopify-backed. Durable catalog synchronization and a broader commerce authority remain future work.

## Relevant Paths

- `lib/shopify/fetch-catalog.ts`
- `lib/shopify/types.ts`
- `lib/image/product-production-context.ts`
- `app/api/image/product-context/route.ts`
- `components/image/product-production-selector.tsx`
