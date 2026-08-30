# Shopify Studio

Shopify Studio exposes live commerce truth and operational workflows. It does not own Artwork, Persona, or Image production authority.

## Current Image Production Seam

- Read-only Admin GraphQL catalog resolution supplies verified product/variant identity, selected options, availability, collections, and update versions.
- Product detail resolution now exposes Shopify image identity, HTTPS URL, alt text, dimensions, product `updatedAt`, and variant availability/version.
- Product imagery is converted to a provider-neutral `ProductReferencePackage`; unknown views remain `UNCLASSIFIED` rather than being fabricated.
- Before paid v2 confirmation, exact remote bytes must be checksummed and privately frozen. URLs are transient source references, not permanent exact-input truth.
- No Shopify mutation or publishing is part of Image production.

Manual Product profiles live in the separate Product Library and must not claim Shopify authority. See [Product Library](./PRODUCT_LIBRARY.md).
