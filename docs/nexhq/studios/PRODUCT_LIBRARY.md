# Product Library

## Domain Decision

Product is independent from Artwork and Persona. A Product describes the garment/object being photographed; it never embeds the approved graphic and never owns Persona identity.

## Current State (2026-08-17)

The typed `product-profile-v1` foundation supports:

- authorities `SHOPIFY_LIVE`, `MANUAL_PROFILE`, `SEED`, and `UNKNOWN`;
- open-ended product types (including T-shirts, hoodies, zip hoodies, joggers, pants, jackets, and future categories);
- optional Shopify product/variant identity;
- colorways, sizes, collections, availability, material, GSM, fit, and construction details;
- collar, sleeves, zipper, pockets, seams, print/embroidery regions;
- front/back/side/detail/unclassified visual references with dimensions and provenance;
- version and timestamps.

The schema prevents a manual profile from claiming a Shopify product ID and requires an exact Shopify ID for `SHOPIFY_LIVE`.

`ProductReferencePackage` captures Shopify image IDs, URLs, dimensions, explicit alt text, product version, and capture time. Only featured status or explicit alt text is used to assign a view role; unknown views remain `UNCLASSIFIED`. Before paid confirmation, the safe freezer can fetch HTTPS Shopify CDN bytes, enforce MIME/size/redirect controls, checksum them, and persist a private frozen object identity. Mutable remote URLs are not sufficient as exact paid-job truth.

The authenticated read-only endpoint is `POST /api/image/product-reference-package`. A live read-only verification on 2026-08-17 resolved one current Shopify product with matching ID, one dimensioned image reference, variant data, and product `updatedAt`. It did not mutate Shopify.

## Persistence Status

Applied migration `20260817170000_deterministic_mockup_foundation_v1.sql` creates server-only `product_profiles` and private `product-profile-references`. The repository now persists immutable profile versions and exact named PrintSurfaces. The owner-facing V2 minimum flow can resolve a live Shopify product/variant, freeze supported references privately, checksum them, and save an explicit `front_center` quad. A broad Manual Product Library UI and manual-reference upload orchestration remain target work.

## Authority Rules

1. Shopify is authoritative only after a live server read.
2. Manual profiles are owner-managed truth, never Shopify truth.
3. Seed/unknown profiles remain visibly non-authoritative.
4. Exact variant claims require a verified variant ID.
5. Product references are not Artwork references and are not Persona references.

## Relevant Paths

- `lib/product-library/types.ts`
- `lib/product-library/product-reference-package.ts`
- `lib/product-library/freeze-product-references.ts`
- `lib/shopify/fetch-product-detail.ts`
- `app/api/image/product-reference-package/route.ts`
- `supabase/migrations/20260817170000_deterministic_mockup_foundation_v1.sql`

## Minimum Owner Calibration Runtime

`POST /api/image/v2/product-profiles/calibrate` accepts only an authenticated exact `SHOPIFY_LIVE` Product and variant plus a supported semantic print region, four-corner normalized quad and explicit owner attestation. It re-reads Shopify without mutation, safely freezes available CDN imagery, preserves unknown roles as `UNCLASSIFIED`, stores checksums/private identities, and creates a new Product profile/PrintSurface version only when owner-defined production truth changes. It never invents geometry.

## Owner UX shell — 2026-08-17

A `/agents/products` owner route now presents the read-only Shopify catalog as **Shopify verifiziert**, including images, type, status, inventory, colors, variants and unclassified reference imagery. Manual Products remain a separate, honest unavailable-persistence shell; no manual profile is fabricated and no Shopify write exists.

## Final UX Cleanup — 2026-08-17

The Product Library now inherits the same Geist Sans type scale, card spacing, focus states, blue/cyan selection language, German loading/error/empty states and collapsed technical details as Persona, Design and Image. The read-only Shopify versus unavailable Manual Profile distinction is unchanged; this pass added no persistence or Shopify mutation.

## Product Intelligence + Manual Product Library V1 — 2026-08-17

CURRENT STATE: `product_profiles` is now the durable, immutable-versioned Product knowledge aggregate for both `SHOPIFY_LIVE` and `MANUAL_PROFILE`. Shopify sync preserves catalog identity, exact variants, availability and active state as canonical live truth while owner enrichment (material, GSM, fit, construction, print methods, reference roles and PrintSurfaces) is stored separately in NexHQ and survives re-sync. Manual profiles can be drafted without Shopify, have explicit unknown availability, private checksummed reference uploads, owner-assigned image roles, and versioned human-defined Product/variant surfaces including leg and split-front regions.

The German owner UI supports manual creation, progressive enrichment, private photos, role assignment, explicit normalized geometry and readiness blockers. Manual-to-Shopify linking records an explicit owner-attested relationship only; it does not change authority or merge records. The existing applied Product Profile schema is sufficient, so this milestone adds no migration.

## Video consumption — 2026-08-18

Video input freezes the exact Product Profile/version/variant plus material, GSM, fit, construction and frozen reference package. Missing or unfrozen reference truth fails closed. Product Library remains independent of Persona, Artwork and Video projects.

## Product source context (2026-08-19)

Product profiles carry a versioned `ProductSourceContext`: `MARKETPRINT`, `BRANDSKY`, `BRANDCANYON`, `OTHER`, or `UNKNOWN`, with `SHOPIFY_METADATA`, `OWNER_CONFIRMED`, or `UNKNOWN` authority and explicit evidence. Exact vendor values and explicit `supplier:` / `source:` tags may establish Shopify evidence; titles and fuzzy matches never do. Conflicting evidence fails closed.

Read-only live audit: 78 Products, 18 collections, vendor metadata on all 78, tags on 70. Current evidence resolves 70 to MarketPrint and 8 unresolved because the remaining vendor metadata is not an explicitly recognized supplier; Brandsky and Brandcanyon are currently **not verified in the inspected catalog**. No Shopify mutation occurred.

## Semantic placement consumer boundary (2026-08-19)

Product Library remains the canonical owner of exact, versioned PrintSurfaces. Image Studio may describe a requested placement semantically, but production resolution uses Product type, exact variant, region, geometry status and surface version from the Product Profile. Zip Hoodie centered-front assumptions are rejected; Jogger/Pants use leg regions; missing and ambiguous geometry remain blockers. Manual Product surfaces are created/edited in Product Library rather than silently calibrated by Image Studio.

## Reusable PrintSurface authority — 2026-08-19

A PrintSurface is versioned Product geometry. It does not contain Artwork identity and an Artwork rename/version change cannot change it. Product Library may scope a surface to one profile/exact variant or, after explicit owner confirmation, to a physical Product family and compatible normalized variants. A family surface records its canonical owner profile/version, stable physical-product key, concrete compatible Shopify Product IDs, actor, and time. MarketPrint or another supplier label is useful evidence context but never sufficient by itself.

Image Studio consumes the exact surface owner/version. If the selected Shopify listing has not yet frozen its own Product references, the setup action can create/update that exact Product Profile while continuing to reference the already calibrated family surface. Editing canonical geometry creates a new Product Profile/surface version. A one-job fine adjustment does not update Product Library.

The Product detail **Druckflächen** section groups front and rear regions and shows ready/not-configured state, version, family/profile scope, and variant scope without exposing coordinates by default.

## Product truth in varied Social scenes — 2026-08-20

Social variation consumes Product Profile identity/version, exact variant, color/size, construction, material/GSM/fit, Product references, source context and the selected PrintSurface. Scene or mood is never permission to invent another garment. Product-only and Markenmodel-based presets are filtered by canonical shot requirements; Product presentation is normalized accordingly. No Product Library schema or authority changed.

## Advanced calibration and standard fallback (2026-08-20)

Manual four-point management now lives only under **Technische Produktdaten · Druckflächen kalibrieren**. It is optional for special Products and owner-specific geometry, not a routine Image Studio task. An existing ready Product surface remains the highest placement authority and overrides any NexHQ standard template. Persisted, owner-verified physical-family reuse is second.

For supported standard T-Shirts, Hoodies, safe Zip-Hoodie regions, Joggers, and Pants, Image Studio may materialize a versioned `NEXHQ_PRODUCT_TEMPLATE` as deterministic Product placement truth. A template never establishes Shopify identity or physical-family equivalence and never contains Artwork identity. Unknown/custom categories receive no template and remain blocked until advanced Product data supplies an exact surface.

## Image owner-flow containment (2026-08-20)

Image Studio consumes exact Product/variant, source context, Product Profile version, references, and placement authority without displaying those implementation details in routine production. The owner sees Product, color, size, and a small verified supplier/Shopify label when supported by actual evidence. Unsupported placement links to **Produktdetails öffnen**; calibration and physical-family evidence remain Product Library technical administration only.

## Product Families, colors, blanks, and green calibration (2026-08-20)

A Product Family is an owner-facing projection of one canonical, versioned Manual Product Profile—not a second Product system. The owner creates a garment category, adds colors, and uploads private blank Front/Back images for each color. Optional supplier and explicit Shopify Product/variant mappings remain provenance/background commerce linkage; a supplier name alone never proves blank equivalence.

The family owns exactly one reusable Front and one Back placement template by default. A MarketPrint screenshot with the green print area is stored with `PRINT_AREA_CALIBRATION` purpose and `providerEligible=false`. Local pixel analysis detects the largest coherent green region; the owner moves/resizes one rectangle and saves a new template/Profile version. Coordinates, IDs, hashes, and PrintSurface internals remain absent from normal UI.

Blank Product images are provider-eligible garment evidence. Calibration images are never Product appearance evidence, contamination input, or Artwork authority. Existing Product materials, GSM, fit, construction, variants, PrintSurfaces, Shopify sync, and historical versions remain available.

## Product Family owner-state polish (2026-08-21)

Blank Front/Back uploads now begin directly from the selected file and reconcile from the returned canonical Product Profile version. The persisted thumbnail, **Hochgeladen ✓**, and **Ersetzen** state appear without a refresh or unrelated save action. Replacing a blank creates a new Product Profile version and replaces that color/side slot in current truth while historical versions retain their prior reference.

Green-overlay calibration has explicit draft, dirty, saving, ready, and error presentation. A saved Front/Back editor collapses to a compact **Druckfläche bereit** card; **Bearbeiten** reopens it, unchanged geometry has no active save action, and a changed rectangle exposes **Änderungen speichern**. Product Family readiness now requires a production-eligible Product status, active family/color, supported garment type, and at least one same-side pair of a checksum-complete private blank plus a saved placement template.

Normal family layout is **Produkt → Farben → Druckfläche → Shopify-Zuordnung → Technische Details**. Reference roles, variants, IDs, checksums, raw assets, and advanced surfaces remain available only inside the collapsed technical section.

## Image Studio production read model — 2026-08-21

`GET /api/product-library/profiles?view=image-production` is the lean Product Family production projection. It returns canonical family, colors, variants, blank-reference readiness and saved placement templates without signing every reference preview. The full Product Library view still creates authenticated previews for management. Writes invalidate the short-lived Image Studio family cache; no job, approval, confirmation, or recovery state is cached.

MarketPrint calibration remains Product Family + side truth. For lifestyle output its rectangle becomes garment-relative intent and is registered against the actual Stage-A garment; it is never reused as raw lifestyle-image screen coordinates.

The semantic Image Studio placement remains a separate frozen execution choice above that family calibration. In particular, a T-shirt large-front selection uses the main central printable body region; left-chest and centre-chest use smaller distinct garment-relative templates. Product Family geometry is not mutated by this interpretation.

## Product truth with SAM 3 evidence — 2026-08-21

SAM 3 does not add or infer Product Library truth. Product Family still defines garment type and construction; blank references still define visual garment evidence; family-wide MarketPrint templates still define relative printable areas. The adapter receives only the selected garment type/side and private Stage-A Base. It cannot change color, family, side, preset, owner placement, or Shopify mapping.

The whole garment mask is never treated as printable. Registration V3 derives the Product-rule-safe torso or leg subregion: sleeves/collars are excluded for shirts, hood/strings/pocket remain Product-rule constraints for hoodies, centered zip crossing stays unavailable unless the family explicitly supports it, and jogger placement stays on the selected leg region.
