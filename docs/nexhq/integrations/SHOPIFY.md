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

## Product Visual References (2026-08-17)

`fetchShopifyProductDetail` now reads image IDs, URLs, alt text, dimensions, product `updatedAt`, and variant availability/version in addition to the existing drawer data. `ProductReferencePackage` assigns `FEATURED` from actual featured status and view roles only from explicit alt text; it does not invent front/back/side semantics.

The authenticated Image endpoint resolves this package read-only. A server freezer restricts fetches to HTTPS Shopify CDN hosts, refuses redirects/unsupported MIME/oversize content, computes SHA-256, and delegates private persistence before paid confirmation. Frozen content checksum and object identity become v2 fingerprint inputs; remote URLs alone are never exact execution truth. The Storage bucket and Product profile persistence from migration `20260817170000_deterministic_mockup_foundation_v1.sql` are applied and verified private. The V2 calibration endpoint invokes this read-only resolution/freezing path; it performs no Shopify mutation.

A live read-only check on 2026-08-17 successfully returned matching Product identity, dimensioned imagery, variant data, and a Product update version. No Shopify mutation occurred.

## V2 Runtime Use

V2 calibration performs Shopify Admin GraphQL reads only. Remote image bytes are accepted only from allowlisted HTTPS Shopify CDN hosts, redirects are refused, MIME and streaming byte limits are enforced, and exact content is copied into private NexHQ storage before confirmation. Shopify URLs remain provenance; private object path + checksum are the execution identity. No Product, variant, inventory, publication, or media mutation occurs.

## Product enrichment boundary — 2026-08-17

A read-only sync service materializes Shopify catalog truth into versioned NexHQ Product Profiles. Owner production metadata is merged into the NexHQ profile but never written to Shopify and never overrides Shopify Product/variant identity, status, availability or update version. Re-sync preserves owner roles, frozen references when source identity is unchanged, construction knowledge and PrintSurfaces. Remote references are distinguished from privately frozen production references.

## Product source metadata audit (2026-08-19)

The read-only catalog query now includes Shopify `vendor` alongside tags, variants, options, collections, availability, images and update timestamps. Product source derivation accepts only exact vendor values or explicit supplier/source tags. It never uses Product titles. A controlled read-only audit returned 78 Products / 18 collections: 70 with explicit MarketPrint evidence, 8 unresolved because their vendor metadata is not an explicitly recognized supplier, and no verified Brandsky or Brandcanyon evidence. Metafields and fulfillment-service source evidence are not read by the current integration and remain unverified. Shopify was not mutated.
