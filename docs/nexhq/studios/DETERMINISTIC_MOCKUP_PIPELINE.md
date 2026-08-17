# Deterministic Mockup Pipeline V1

## Non-Negotiable Fidelity Rule

The approved Master Artwork is immutable visual truth. A production provider may create the Persona, Product, pose, garment, lighting, and scene, but it must not redraw the final Artwork.

## Two-Stage Architecture

```text
WHO: approved Brand Model / Persona Master
PRODUCT: exact ProductProfile or Shopify variant + frozen visual references
HOW/WHERE: one shot and campaign direction
PRINT REQUIREMENT: target region must remain usable
        |
        v
Stage A — BASE_GENERATION (one potentially paid call)
        |
        v
Stored checksummed private base asset
        +
approved Master Artwork bytes (checksum verified)
        +
human/shot-calibrated PrintSurface
        |
        v
Stage B — DETERMINISTIC_COMPOSITE (local, retryable, no provider)
        |
        v
private final asset + compositing provenance + REVIEW_REQUIRED
```

## V1 Compositor

`nexhq-deterministic-compositor-v1` uses the existing server-side `canvas` dependency. It:

1. verifies base and Master Artwork SHA-256 checksums;
2. decodes their raster pixels at native source resolution (Stage B never resizes or replaces the stored Master Artwork);
3. calculates a projective homography from the source rectangle to a normalized calibrated quad;
4. inverse-maps destination pixels to original source RGBA pixels using deterministic bilinear sampling (a weighted average of at most four neighbouring approved source pixels; not generative redrawing);
5. clips naturally to the mapped surface;
6. alpha-composites those reconstructed pixels over the base;
7. optionally applies a deterministic uniform shading multiplier;
8. emits a lossless PNG whose pixel dimensions equal the Stage A base image, plus exact transform/provenance including source, print-region, and output sizes.

Screen-mockup sharpness is governed by **output pixel dimensions**, not DPI metadata. A 4500×5400 / 300 DPI Master Artwork remains production-grade as source truth; if Stage A is only ~768×1024, the print region has only a few hundred destination pixels and the composite will look soft even though the canonical Artwork was not downsampled. Synthetic Stage A therefore uses a minimum 2048 long-edge. Production Stage A should use the shot's requested pixel size.

No text, logo, layout, color, or element synthesis occurs. Allowed transformations are scaling, rotation as represented by geometry, perspective warp, clipping, alpha blending, and physically motivated shading/displacement. Current V1 implements projective warp, clipping, alpha blending, bilinear reconstruction, and optional uniform shading. It **does not yet implement fold-aware displacement, per-pixel garment shading, or an external clipping-mask raster**.

## PrintSurface Safety

Regions include center/left/right front, back, sleeves, legs, and custom. Geometry may be `CALIBRATED`, `HUMAN_DEFINED`, or `REQUIRES_CALIBRATION`. Shopify metadata does not fabricate geometry: an unknown surface has no quad and compositing fails closed until the owner or a shot-calibration tool defines it.

## Image Input V2

`image-generation-input-v2` freezes:

- exact Brand Model and Persona lock/package trace;
- exact Product and variant context;
- checksummed private Product reference package;
- exact approved Master Artwork identity/version/checksum;
- exact PrintSurface geometry;
- one shot/campaign direction;
- base provider/model/quality/settings;
- deterministic compositor version/settings;
- production mode.

Its fingerprint changes when Artwork, Product/variant, Product references, PrintSurface, shot, or production settings change. The base strategy is explicitly `NO_MASTER_ARTWORK_INPUT`. Historical `image-generation-input-v1` remains parseable and is not reinterpreted.

## Retry and Single-Asset Rules

- `assetCount` is literal `1`; one job remains one selected asset.
- A successful base stage is persisted before compositing.
- A composite failure is a known local failure, not an unknown provider outcome.
- Retrying the composite requires the persisted base and does not invoke the provider again.
- There is no automatic batch and no automatic provider recall after composite failure.

## Human Review

Final assets remain `REVIEW_REQUIRED`. Human review records identity, Product fidelity, exact Artwork fidelity, placement, perspective, and lighting integration. `APPROVED` or `REJECTED` requires a human actor and timestamp.

## Current vs Target

**Implemented and no-provider verified:** domain contracts; applied persistence; authenticated V2 Prepare/Estimate/Confirm; Shopify reference resolution, safe download, checksum, and private freezing; owner-defined versioned PrintSurface; exact fingerprint; development-only synthetic base provider; durable base/composite orchestration; deterministic compositor; composite-only retry; reload recovery; private final asset; six-dimension human review; and synthetic/golden/end-to-end tests.

**Not yet verified/wired:** real provider-backed V2 Stage A execution, owner UI smoke testing against live persistence, fold-aware displacement, per-pixel garment lighting, external clipping masks, automatic surface detection, and broad Manual Product Library UI. Synthetic execution is blocked in production builds. The existing live v1 paid executor is historical/draft-generative and must not be used when exact Artwork reproduction is required.

## Relevant Paths

- `lib/image/print-surface/`
- `lib/image/artwork-compositing/`
- `lib/image/paid-generation/types-v2.ts`
- `lib/image/deterministic-production/`
- `lib/product-library/`
- `agents/image/providers/openai-images-edit-provider.ts`
- `supabase/migrations/20260817170000_deterministic_mockup_foundation_v1.sql`
