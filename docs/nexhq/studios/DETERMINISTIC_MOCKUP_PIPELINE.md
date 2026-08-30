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

## Deterministic compositors

`nexhq-deterministic-compositor-v2` is the current new-job contract. It:

1. verifies base and approved Master Artwork SHA-256 checksums;
2. decodes the canonical raster without replacing stored source truth;
3. finds the largest centred axis-aligned Artwork rectangle contained by the calibrated Product PrintSurface;
4. uses exactly one uniform scale factor for width and height plus translation;
5. preserves transparency and deterministically bilinear-samples original RGBA pixels;
6. leaves natural empty space instead of stretching, squashing, rotating, or projectively warping Artwork to fill the surface;
7. alpha-composites into a lossless PNG and records source ratio, effective scale, applied rectangle, transform matrix, compositor version, and checksums.

The browser placement preview loads the private approved Artwork through an authenticated workspace-scoped route and calls the same pure aspect-lock resolver with the selected shot dimensions. `image-generation-input-v2.compositing.artworkPlacementMode` is fingerprinted as `CONTAIN_UNIFORM_ASPECT_LOCKED`. Source checksum plus output dimensions and PrintSurface geometry make the effective scale deterministic; the computed result is preserved in compositing provenance.

Historical `nexhq-deterministic-compositor-v1` jobs remain readable and retry with their original frozen perspective-fill implementation. They are not silently upgraded or reinterpreted. New production jobs do not use v1. Current v2 does not implement garment rotation, fold-aware displacement, per-pixel garment shading, or external clipping masks.

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

Final assets remain `REVIEW_REQUIRED`. The durable review record retains identity, Product, Artwork, placement, perspective, and lighting dimensions. The normal owner surface maps one concise acknowledgement to those dimensions and still requires an explicit human `APPROVED`/`REJECTED` decision with actor and timestamp.

## Current vs Target

**Implemented:** domain contracts; applied persistence; authenticated V2 Prepare/Estimate/Confirm; Shopify reference resolution, safe download, checksum, and private freezing; owner-defined versioned PrintSurface; exact fingerprint; development-only synthetic base provider; real OpenAI Stage A executor; blank-garment prompt contract; local Base print-purity gate; durable base/composite orchestration; aspect-locked fabric-aware deterministic compositor V1; composite-only retry; reload recovery; private final asset; durable human review; and mocked/golden/end-to-end tests.

**Not solved:** semantic certainty that every generative Base is blank, calibrated garment UV/depth maps, robust fold segmentation, major-fold occlusion, external clipping masks, automatic surface detection, and broad Manual Product Library UI. Fabric-aware V1 derives only bounded mild displacement, local lighting, and fine texture response from the frozen Base; it intentionally refuses to claim full cloth simulation. The local purity guard detects obvious coherent contamination and fails closed, but final human review remains required. Synthetic execution is blocked in production builds. The existing v1 paid executor is historical/draft-generative and must not be used when exact Artwork reproduction is required.

## Relevant Paths

- `lib/image/print-surface/`
- `lib/image/artwork-compositing/`
- `lib/image/paid-generation/types-v2.ts`
- `lib/image/deterministic-production/`
- `lib/product-library/`
- `agents/image/providers/openai-images-edit-provider.ts`
- `supabase/migrations/20260817170000_deterministic_mockup_foundation_v1.sql`

## Content Pack integration — 2026-08-19

Content Pack choice freezes only one stable shot ID into `image-generation-input-v2`. Pack membership and recommended aspect are planning metadata; they do not alter deterministic compositor fidelity or provider resolution. Exact shot identity participates in the existing input fingerprint.

## Semantic placement binding — 2026-08-19

New prepares may freeze `semantic-print-placement-v1` beside the canonical `PrintSurface`: `printSide`, `placementPreset`, display label, and exact resolved surface ID/version/region. Snapshot validation requires semantic resolution and `printSurface` to agree. The fingerprint covers both. Historical V2 inputs without this optional semantic layer remain valid and retain their original meaning.

Semantic placement does not alter the compositor. Stage B still consumes only the exact checksummed Artwork plus one ready normalized quad. `Beidseitig` is not accepted by Prepare because one current still output cannot honestly show independent front and back views; it remains a two-shot planning aid with no automatic job creation.

## Canonical surface plus production override — 2026-08-19

Stage B now distinguishes canonical reusable Product geometry from optional job-only fine tuning. The snapshot always freezes the exact canonical `PrintSurface` owner/profile/version and original quad. If the owner adjusts placement for one visual, `print-surface-production-override-v1` freezes a replacement quad bound to that base ID/version. Runtime validates the binding and composites with the effective quad; Product Library remains unchanged. The whole snapshot fingerprint changes.

Cross-listing surface reuse is server-authorized only from persisted owner-confirmed physical-family evidence and a concrete compatible Shopify Product list. Family/title normalization and supplier name are not execution authority. Historical V2 snapshots without reuse metadata or an override remain parseable and retain their original geometry.

## Structured Stage A creative direction — 2026-08-20

For new prepares, Stage A receives the frozen `social-creative-direction-v1` projection in addition to the exact Persona and `ProductVisualInput`. The adapter prompt states scene/location, lighting, camera, composition, subject direction, Product presentation, mood, channel and aspect intent. Verified Product type, variant, color, size, material, fit, construction and frozen references remain higher authority than creative style.

Master Artwork bytes/IDs are not part of `BaseImageProvider` input material beyond the existing snapshot lineage needed for the later job; `buildDeterministicBaseProviderRequest` still exposes no `artwork` field. Stage B alone loads the checksummed Artwork. Historical compositor V2 retains flat uniform aspect-locked placement; new jobs freeze the fabric-aware V1 compositor policy described below. Creative direction cannot stretch, crop, redraw or generatively condition the Artwork.

## Template-backed Product placement (2026-08-20)

A new Prepare may reference `NEXHQ_PRODUCT_TEMPLATE` when a supported standard Product has no ready exact or verified physical-family surface. Runtime never trusts a browser quad: it loads the authorized Product Profile, re-resolves the semantic side/preset, verifies template ID/version, and materializes the exact normalized quad into the frozen V2 `PrintSurface`. Existing Product/family surfaces have precedence; unsupported Products fail closed.

Templates do not use Artwork dimensions. Stage B still verifies the Master Artwork checksum and contains it with one uniform scale inside the resolved region. The resulting surface identity/version/geometry/provenance, shot, and semantic placement participate in the snapshot fingerprint. Historical snapshots and one-job/one-asset behavior are unchanged.

## Real Stage A executor — 2026-08-20

The production executor is now connected to the existing OpenAI adapter instead of the synthetic provider. Execution is owner-triggered only after exact durable confirmation. Pre-claim checks load and verify current Artwork authority (validation only), locked Persona Master/support bytes, and frozen Product-reference bytes. The actual provider request contains **Persona + Product + Creative Direction**, with `artwork` absent and `artworkStrategy=NO_MASTER_ARTWORK_INPUT`.

The atomic claim permits one Stage A attempt. The base bytes/checksum/provider request ID are stored in the existing private stage seam before local Stage B. A Stage B failure retains the base for composite retry; absence of a durable base after a consumed paid claim becomes `UNKNOWN_PROVIDER_OUTCOME`. Standard Product templates use a non-warped axis-aligned rectangular surface; compositor V2 still preserves aspect ratio with uniform scale and translation. Historical snapshots are not rewritten.

## Mandatory blank-garment purity — 2026-08-20

The first controlled real V2 run proved that Shopify Product references can contain listing-specific legacy prints. Stage A had copied one such print into the generated shirt, and alpha compositing correctly left those Base pixels visible around transparent portions of the approved Artwork. The Product references remain useful physical-garment evidence, but their graphics are explicitly non-authoritative contamination.

New Stage A prompts therefore require the complete target garment side to be plain, solid-color, blank, and unprinted. The OpenAI adapter instructs the model to use Product references only for silhouette, fit, fabric, color, seams, collar, sleeves, pockets, and construction, and never to copy reference graphics, brand text, logos, typography, placeholders, watermarks, or ghost prints. Approved Artwork bytes remain absent from Stage A.

Before Stage B, the local Base-purity contract assesses the frozen effective print region for a coherent high-contrast graphic pattern. Suspected contamination, an unreadable Base, or an invalid region fails the job as `BASE_PRINT_ZONE_CONTAMINATED`; no composite and no reviewable asset are created. The Base remains private audit evidence and the paid claim cannot be blindly repeated. This local guard detects obvious contamination but is not represented as semantic computer-vision certainty; human final review remains mandatory.

`base-print-purity-v2` was introduced after a persisted blank beige Base produced a v1 false positive. The exact frozen placement remains the reported/overlay region, while signal analysis uses a bounded inner print core that excludes collar, skin, placement boundaries, and structural seams. Smooth lighting gradients, ordinary folds, and fabric grain therefore do not satisfy the combined color-outlier, sharp-edge, and connected-component thresholds. Obvious central text/logo/graphic fixtures still fail. Historical v1 assessments remain unchanged and auditable.

Authenticated owners can inspect the exact private pre-Artwork image under **Technische Details → Stage-A Basisbild**. A workspace-bound server route checksum-verifies and streams the private image with no-store headers, then overlays the exact frozen placement quad; no storage path or storage URL is returned to the browser.

For new T-shirt `FRONT_LARGE` jobs, a versioned job-only tuning converts the resolved Product surface bounds to an axis-aligned rectangle, expands them by 12%, and shifts the centre 2% of output height upward. The canonical Product surface is unchanged. The frozen override and effective geometry change the fingerprint; compositor V2 still uses only uniform scale plus translation. Historical snapshots remain untouched.

## Identity, print-zone and placement quality hardening — 2026-08-20

OpenAI Stage A keeps the Persona Master first and uses `input_fidelity=high`; the prompt marks that Master as the non-negotiable, highest-priority human constraint. Supporting identity images reinforce the same locked person. Product references follow as garment-only evidence and may never affect casting, facial identity, hair, ethnicity, or body identity. Creative direction may change scene and pose, never WHO.

The blank-garment contract is repeated at both the provider-neutral request and OpenAI adapter boundary. In addition to zero foreign graphics, Stage A requests a frontally readable, gently tensioned and unobstructed target zone. This is a production constraint for the existing flat deterministic compositor, not generative Artwork reproduction.

Historical T-shirt tuning v1/v2 remains parseable. New non-family `FRONT_LARGE` jobs use `NEXHQ_FRONT_LARGE_TUNING_V3`: an axis-aligned rectangle 32% larger than canonical bounds with its centre moved 5.5% of output height downward into the shirt body. The v3 override is fingerprinted and never mutates Product truth.

## Fabric-Aware Artwork Integration V1 — 2026-08-20

New prepares freeze `nexhq-deterministic-compositor-v3-fabric-aware-v1` plus a bounded `FABRIC_AWARE_PRINT_V1` policy. Stage B still checksum-verifies the exact approved Artwork and first resolves the same centred uniform-scale contain rectangle used by compositor V2. It then samples only the frozen Base raster to derive mild local cloth response: displacement is capped at 1.2% of the applied Artwork rectangle and fades to zero at its boundary; local luminance/fine texture modulate print shading within fixed limits; a small fixed ink-opacity blend lets underlying fabric texture remain visible. No provider, repaint, semantic edit, independent X/Y scale, rotation, or unbounded warp is involved.

The snapshot fingerprints the exact integration policy. Provenance records the source Artwork checksum, unchanged source aspect ratio, effective uniform scale/rectangle, maximum applied displacement, shading range, and `sourceAuthorityPreserved=true`. Historical compositor V1 and V2 snapshots remain parseable and execute with their frozen meaning.

V1 is intentionally conservative. It improves the previous sticker-like source-over result on gently tensioned fabric, but it does not claim a calibrated UV map, semantic fold/occlusion mask, screen-print ink simulation, or safe handling of severe folds and hands over the print zone. Stage A therefore explicitly requests a frontally readable, gently tensioned, minimally obstructed blank region; human review remains mandatory.

## Live production owner state — 2026-08-20

During the single long real execution request, Image Studio polls the durable job read model without issuing a second execution action. The owner sees stable German phases for confirmation, private reference preparation, Base generation, local Artwork application, result persistence, and review readiness. Reloaded confirmed work alone offers **Produktion fortsetzen**; active/running or unknown-outcome jobs never offer a duplicate paid attempt. Raw diagnostics remain under **Technische Details**.

## Product Family placement input (2026-08-20)

`owner-artwork-placement-v1` permits only uniform scale and translation inside a versioned family Front/Back printable rectangle. The normalized rectangle comes from a private green-overlay calibration asset, but that asset is explicitly provider-ineligible and never reaches Stage A. Exact color+side blank references are the preferred Product evidence.

For a direct Product-reference mockup, calibrated reference coordinates can be used on the matching canvas. Generated Social/model images must not reuse screenshot coordinates blindly. Historical V1/V2 snapshots retain their frozen behavior; new `GENERATED_GARMENT_RELATIVE_V3` runs register a local garment-relative axis-aligned region from the actual Stage-A Base and bind the exact semantic preset. Unknown or low-confidence evidence fails closed. Fabric-Aware V1 remains bounded inside that result. Full garment segmentation/UV mapping remains a later quality milestone rather than an implied guarantee.

## Generated Garment Registration V2 — 2026-08-21

New Product Family production runs: frozen Product Family calibration + owner placement → one blank Stage-A Base → local face/neck exclusion and connected garment-colour registration → registered print region → Base purity → Fabric-Aware V1 → one review asset.

`GENERATED_GARMENT_RELATIVE_V3` never maps calibration pixels directly to a lifestyle canvas. The region must remain within the detected garment body and below face/neck exclusion. Large-front intent additionally requires a large central region and forbids size reduction. Unsupported Products, declared-colour mismatch, missing garment evidence, region escape, chest-like downgrade, or low confidence stop locally after the persisted Base and before Stage B. Historical V1/V2 jobs use their frozen behavior unchanged.

V2 is deterministic colour/component registration with optional local face landmarks, not semantic AI repainting, full cloth UV recovery, or occlusion-aware segmentation. Severe pose, heavy overlap, very similar garment/background colours, or ambiguous views may intentionally fail closed.

## SAM 3 precision mask + Garment Registration V3 — 2026-08-21

New Product Family V3 execution is: one Stage-A Base → one checksum-bound SAM 3 segmentation → local mask validation/selection → Garment Registration V3 → registered purity region → mask-clipped Fabric-Aware V1 → one review asset. SAM receives no Artwork and cannot choose placement. Candidate selection combines V3-hint overlap, expected garment position/size, component coherence, confidence, and garment-kind plausibility; the largest candidate is never selected blindly.

The normalized private mask must match Base width/height exactly and is bound to job, Base checksum, provider/model/version, and a stable idempotency key. Tiny, background-sized, disconnected, skin/body, wrong-kind, or implausibly positioned masks fail before Stage B. The mask's private storage path is derived server-side and never emitted in public recovery/diagnostic JSON.

V3 uses the mask as its strongest boundary evidence, then applies Product Family safety semantics and frozen MarketPrint/owner intent. The compositor verifies mask/Base checksums and dimensions, requires at least 98.5% mask coverage of the locked applied rectangle, and refuses material clipping. Every actual output Artwork pixel is clipped to the validated mask. The exact approved Artwork remains the sole design source; SAM does not repaint it. Composite-only recovery reloads the stored mask and never calls segmentation again.

### fal SAM 3 Image transport

`FalSam3GarmentSegmentationProvider` calls `fal-ai/sam-3/image` through `@fal-ai/client` after the atomic paid job claim. Input is an exact Base data URI, garment prompt, PNG output, multiple-mask mode (maximum three), scores and boxes. Artwork, design labels, Persona metadata and private storage paths are absent. Output URLs are accepted only as image data URIs or trusted HTTPS fal media hosts, then checksum-bound and persisted privately.

Application atomic claiming, a stable `Idempotency-Key`, and checksum-derived stored-mask reuse protect the one-call boundary. A composite retry starts from the persisted Base/mask and cannot enqueue fal again. The segmentation maximum is versioned in the frozen policy and combined estimate; local registration/compositing remains uncharged.

## Surface-Conforming Print Integration V1 — 2026-08-23

New Product Family jobs freeze `nexhq-surface-conforming-integration-v1` inside the existing Fabric-Aware V3 compositor policy. After SAM validation and Garment Registration V3, Stage B builds a deterministic 7×9 displacement mesh from the exact Base luminance, local gradients, texture residuals, and garment-mask row geometry. The mesh is pinned to zero at the owner-authoritative placement boundary and remains inside the existing 2% total displacement ceiling. It may express mild silhouette perspective, torso curvature, fold direction, and local cloth response; it cannot redraw Artwork, change typography, rotate, apply independent global X/Y scale, or leave the registered region.

The validated SAM mask remains the hard output boundary. New Product Family execution requires at least 98.5% mask coverage and rejects missing mask evidence, implausible surface geometry, excessive required warp, insufficient confidence, or estimated typography distortion above the frozen safety limit. A refusal persists diagnostic evidence and creates no reviewable composite. Historical Fabric V1/V1.1 jobs contain no surface contract and retain their frozen pixel response.

Before application, the raw raster-derived mesh is deterministically regularized while its boundary stays pinned. Typography safety then evaluates the transform that is actually sampled: local principal scale, axis-angle/shear, area change, and rotation-invariant strain discontinuity. Rigid local rotation and garment curvature are not themselves typography damage. Completely transparent source cells are excluded from this analysis only; canonical Artwork bounds and pixels remain unchanged. Strong shear, scale change, discontinuity, mask clipping, or warp-bound violations still fail closed.

Successful provenance records mesh/version, raw-versus-applied warp, safety clamps, curvature/fold/shading/texture evidence, mask coverage, surface-evidence reliability, flat-overlay risk, the Jacobian typography metric, dominant cells, and transparent-cell handling. Surface-evidence reliability describes mask/topology evidence, not subjective aesthetic quality, and typography remains a separate hard gate. These are deterministic measurements from the Base and mask, not generated quality claims; controlled visual QA and human review remain mandatory.
# Strict contain placement authority

For new Product Family jobs, Garment Registration V3 first resolves the full
physical printable region. Stage B then applies the frozen owner scale and X/Y
translation through `nexhq-strict-artwork-contain-fit-v1`:

`scale = min(printWidth / artworkWidth, printHeight / artworkHeight)`

The approved Artwork pixel rectangle remains complete and aspect-locked. Local
fabric/surface response may physically modulate sampling inside that rectangle,
but it may not crop the source bounds or introduce independent global X/Y
scaling. Any required garment-mask clipping now fails closed rather than
silently discarding Artwork pixels. Compositing provenance records source and
target dimensions, uniform scale, unused space, owner offsets, and explicit
`cropApplied: false` / `distortionApplied: false` evidence.
## Owner Print Footprint V1

For new Product Family T-shirt jobs with `FRONT_LARGE`, NexHQ freezes
`nexhq-owner-print-footprint-v1`. The one strict CONTAIN calculation from the
MarketPrint calibration and the owner's scale/X/Y becomes the global footprint
authority. Registration maps that footprint to the detected garment body;
Surface-Conforming and Fabric-Aware stages may change local sampling only and
must not reduce the boundary footprint. Registration or compositing fails
closed when linear retention falls outside the bounded 4% raster/surface
envelope. Historical snapshots without this optional contract retain their
frozen interpretation.

## Front-Torso Print Envelope V1

New Product Family T-shirt jobs with `FRONT_LARGE`, a validated SAM mask and
`nexhq-owner-print-footprint-v1` derive
`nexhq-front-torso-print-envelope-v1` before mapping the Artwork. The full SAM
garment remains clipping evidence, while robust lower/central row spans define
the physical shirt body without sleeve wings or dropped-shoulder flare. The
upper boundary is below the frozen face/neck exclusion and the lower boundary
avoids the unstable hem edge.

MarketPrint and owner placement are mapped once into that torso frame. The
Surface-Conforming stage consumes the registered footprint and cannot repair or
redefine its global location. Unstable width, inseparable sleeves, missing
collar clearance, cropped torso evidence, or a footprint leaving the envelope
fails closed. Technical preview layers full SAM outline, torso envelope and
final registered print region; historical jobs without the optional envelope
retain their frozen geometry.

## Depth-Aware Surface Integration V1 — 2026-08-23

For new T-shirt Product Family snapshots, the compositing policy may additionally
freeze `nexhq-depth-aware-surface-integration-v1`. Its authority begins only
after identity verification, checksum-bound SAM validation, Front Torso Envelope
resolution, Garment Registration V3, and the single owner-authoritative CONTAIN
calculation. It cannot modify any of those global results.

The local estimator is deterministic and server-local. It consumes only the
frozen Stage-A raster, validated mask, and registered print rectangle. A robust
mask centreline slope estimates the relative shirt-plane lean, mask-width change
provides bounded perspective evidence, and low-pass luminance variation provides
a relative local surface-depth proxy. The resulting guidance is merged into the
existing Surface-Conforming mesh; the exact combined mesh is then checked for
local scale, shear, area and strain discontinuity before Fabric-Aware sampling.
All outer nodes are pinned, so global footprint, size and translation are
unchanged and no second contain pass exists.

Depth evidence below the frozen confidence floor, unsafe required lean/warp,
insufficient mask coverage, or typography risk refuses Stage B. A strong but
unsafe field is never replaced by a silent planar fallback. Refusal remains a
controlled, durable composite failure eligible only for the existing safe
Stage-B retry boundary. There is no planning-time provider call and no new cost.
Historical jobs without the optional policy remain byte-for-byte interpreted by
their frozen Surface/Fabric settings.

## Print-ready + real-depth production path (2026-08-23)

`Stage-A Base → identity gate → local print-readiness preflight → SAM → front torso envelope / registration → purity → fal Depth Anything V2 → pinned-boundary depth-aware mesh → surface/fabric composite → review`

Depth is bound to job ID, exact Base SHA-256, provider, model, and adapter version. A validated normalized map is private and reused after composite failure. A Depth failure preserves Stage A, identity, SAM, registration, and purity; explicit continuation runs Depth and Stage B only. A composite failure after validated Depth runs deterministic Stage B only. Historical snapshots without the new optional contracts retain their frozen behavior.

## Owner Vertical Placement V1 — 2026-08-24

For supported front placements the single Product Family owner placement now
freezes `nexhq-owner-vertical-placement-v1`. The contract binds the preview Y,
owner offset, canonical contained Artwork rectangle, torso-envelope mapping and
expected final Y before paid execution. Garment Registration V3 may translate
that footprint only for an evidenced collar/hem safety clamp within the frozen
4% linear tolerance; anything larger refuses Stage B with the height-specific
owner message.

The compositor verifies that the registered and final global Y are identical.
It records zero secondary contain, global scale, and global translation passes.
Depth and Surface-Conforming can move only bounded interior mesh samples. New
vertical-contract jobs increase plane, perspective, and relative-depth response
slightly while retaining the existing displacement ceiling family, pinned
boundary, SAM clipping, and Jacobian typography gate. Historical jobs without
the optional contract retain their frozen settings and recovery semantics.

## Surface Realism Refinement V1 — 2026-08-25

For new Product Family T-shirt `FRONT_LARGE` prepares, the frozen fabric policy
may include `nexhq-surface-realism-refinement-v1`. The pass runs after the
validated Depth-Aware/Surface-Conforming mesh and before final Fabric-Aware
sampling. It fits a deterministic low-frequency surface plane to the exact
Base-bound depth grid, removes that plane to derive local normal-like gradients
and curvature residuals, blends real depth with a small Base-luminance
cross-check, and adds only a bounded pinned-boundary interior displacement.

The exact combined mesh is rechecked by the existing Jacobian typography gate.
More than 10% clamped refinement evidence, unsafe surface direction, weak mask
or depth evidence, or excessive typography deformation refuses Stage B instead
of falling back to a flat print. Fabric light/texture transfer remains scalar,
hue-preserving, and bounded. Composite-only retry reuses the exact Base,
identity, SAM, torso registration, Depth, owner footprint, and Y authority;
there is no paid call or new global transform.

## Garment-masked Depth Plane V1.1 — 2026-08-26

New eligible snapshots freeze
`nexhq-depth-aware-surface-integration-v1.1-garment-plane`. The previous V1
perspective diagnostic used the slope of full SAM-mask row widths. On oversized
shirts, sleeve-inclusive upper rows and torso-only lower rows could saturate the
perspective score even when the mesh transform sampled by Stage B remained
small. V1.1 instead fits low-frequency depth with deterministic robust
regression inside `SAM mask ∩ registered torso ∩ print neighbourhood`, rejects
plane outliers, detrends the plane before local fold gradients, and bases warp
safety on the candidate node transform actually sampled by the compositor.

Diagnostics separate requested, safely bounded, applied, and rejected warp,
including node clamp counts, raw/normalized plane slopes, normalization range,
and analysis scope. Background depth never participates. The outer footprint,
owner X/Y, one-CONTAIN count, typography Jacobian gate, SAM clipping, and total
displacement ceiling are unchanged. Historical V1 snapshots remain parseable
with their frozen interpretation; a V1 refusal is not upgraded by Stage-B
retry and requires a newly prepared versioned job.

## Hybrid low-depth evidence V1.2 — 2026-08-26

New eligible T-shirt snapshots freeze
`nexhq-depth-aware-surface-integration-v1.2-hybrid-low-depth`. A validated real
Depth Anything map is classified relative to its frozen validation floor as
`DEPTH_STRONG`, `DEPTH_MODERATE`, `DEPTH_LOW_STABLE`, or `DEPTH_UNSAFE`.
Low amplitude alone is not an error: a map above its validation floor with low
discontinuity, stable SAM/torso geometry, sufficient garment-only samples, mild
plane/perspective evidence, and corroborating Base fabric evidence becomes
`NEAR_PLANAR_HYBRID`.

The hybrid policy retains the prior SAM and torso weights and redistributes the
amplitude-only confidence share across discontinuity stability, masked sample
coverage, validation-floor margin, and local fabric evidence. Near-planar mode
attenuates local depth residuals and blends real depth with Base luminance/fold
evidence. It does not add a contain, scale, translation, crop, or border move.
Surface Realism and Fabric-Aware shading/texture remain active after the hybrid
decision. Corrupt, sub-floor, discontinuous, contradictory, poorly sampled, or
unsafe transforms still fail closed. V1 and V1.1 remain frozen and require a
fresh Prepare rather than reinterpretation after a depth refusal.

## Oriented Front Print Plane V2 — 2026-08-26

For newly prepared T-shirt `FRONT_LARGE`, `FRONT_CENTER_CHEST`, and
`FRONT_LEFT_CHEST` jobs, Garment Registration V3 resolves
`nexhq-oriented-front-print-plane-v2` after the torso envelope. Robust fits use
only SAM-confirmed, sleeve-suppressed torso rows to estimate centerline lean and
bounded width convergence. The result is a deterministic TL/TR/BR/BL quad,
not a second owner transform.

The quad preserves the exact requested centre and mean footprint. It is
accepted only when every corner remains inside the printable torso, sampled SAM
containment is at least the frozen policy minimum, collar/hem clearance holds,
and orientation evidence is stable. There is no rectangle fallback for a V2
snapshot. The compositor performs the single strict CONTAIN in the frozen
logical owner bounds, projectively maps that contained unit into the oriented
quad, then applies Depth-Aware V1.2 and Surface Realism only as bounded local
interior transforms. The final conservative typography gate covers global
perspective plus local Jacobian risk.

## Oriented Torso Coordinate Frame V2.1 — 2026-08-26

`nexhq-oriented-front-print-plane-v2.1-torso-frame` replaces post-hoc rotation
for fresh prepares only. Stable garment-only boundary fits define an origin,
orthogonal U/V axes, safe local width/height, and a mildly projective torso-safe
quad. The existing authoritative print bounds are converted once into local
U/V ratios and projected into that quad; there is no extra contain, scale,
translation, or automatic shrink.

The registration gate samples the projected print against the actual convex
torso polygon and the validated SAM mask. Local collar/hem/side overflow is
reported explicitly. Evaluations not reached because an earlier orientation
gate failed are persisted as `NOT_EVALUATED`, never numeric zero. Depth-Aware
V1.2, Surface Realism, and the Fabric-Aware compositor consume the projected
quad unchanged and retain their existing local-only responsibilities.
## Normal-assisted oriented torso V2.2

New eligible jobs use this frozen order:

`Stage A → Identity → SAM → MiDaS normal → torso polygon → normal-assisted
oriented torso frame → owner UV footprint → Depth Anything V2 → local surface
mesh → fabric composite`.

MiDaS uses `fal-ai/image-preprocessors/midas` through a provider-neutral
`NormalEstimationProvider`. Its RGB normal convention is decoded as signed
unit vectors (`X` right, `Y` up, `Z` camera-facing); raster analysis uses image
`Y` down. A low-frequency structure tensor provides bounded image-plane
surface-direction support. Background, sleeves, and collar transition are not
orientation evidence. The request is idempotent by job, Base SHA-256,
provider, model, and adapter version. A valid persisted normal map is not
called again by deterministic Stage-B retry.

MiDaS normal supports the global receiving-plane direction. Depth Anything V2
continues to support local relative depth/curvature. A downstream cross-check
may refuse contradictory surface-facing evidence, but Depth never reorients,
rescales, or translates the frozen owner footprint.
