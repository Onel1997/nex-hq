# Decision Log

Status: Canonical append-only architectural decisions.

## 2026-08-19 — Apply Artwork display name migration

**Decision:** Apply `20260818220000_artwork_display_name_v1.sql` after controlled preflight/dry-run, verifying linked project, exact pending migration list, additive-only SQL, and post-apply live schema. Do not auto-assign an owner-facing name.

**Why:** Application code already treats `display_name` as editable metadata separate from original filename and immutable production identity. Durable columns were the remaining schema blocker for rename-across-reload and Image/Video label reuse.

**Implementation:** Migration applied to `lggogmvpktedkimbpzix`. Post-apply: history synchronized; nullable `display_name`/`original_file_name` live with trim/length checks; RLS deny-by-default unchanged; no public/anon write grants; existing Artwork identity/checksum/status/storage path unchanged with `NULL` name fields. Targeted display-name, authority, handoff, bootstrap, Video label, and auth/workspace tests pass; TypeScript and targeted lint clean. No provider calls.

## 2026-08-18 — Apply Persona Video Readiness migration

**Decision:** Apply `20260818160000_persona_video_readiness_v1.sql` after controlled preflight/dry-run, verifying linked project, exact pending migration list, additive-only SQL, and post-apply live schema.

**Why:** Application code was already migration-ready; durable Video identity review evidence, Video readiness authority binding, and explicit Video Use approval RPCs were the remaining schema blockers for the manual Persona Video approval flow. No human review or approval was performed during apply/verification.

**Implementation:** Migration applied to `lggogmvpktedkimbpzix`. Post-apply: migration history synchronized, 11 new authority columns on `persona_personas`, evidence-completeness checks and workspace-safe FKs (NOT VALID), two SECURITY DEFINER RPCs with service_role-only EXECUTE, RLS unchanged. North African Street Premium remains `video_identity_ready=false`, `video_use_approved=false`. 1244 tests pass; TypeScript and build clean.

## 2026-08-18 — Apply Video Studio Foundation migration

**Decision:** Apply `20260818003000_video_studio_foundation_v1.sql` after controlled preflight/dry-run, verifying linked project, exact pending migration list, additive-only SQL, and post-apply live schema.

**Why:** Application code was already migration-ready; Video Studio tables, the atomic claim RPC, and private storage were the remaining schema blockers for Video Studio operation. Provider calls remain disabled; no real generation was performed.

**Implementation:** Migration applied to `lggogmvpktedkimbpzix`. Post-apply: migration history synchronized, three Video tables live, all constraints/indexes/FKs verified, RLS deny-by-default (0 policies), service_role-only grants, `claim_video_generation_job` SECURITY DEFINER with `status='confirmed'`+`confirmed_at IS NOT NULL`+TTL guard, workspace-source trigger active, `video-production-assets` bucket private. All prior buckets unaffected. Persona Video state unchanged (0 eligible). 1237 tests pass; TypeScript and build clean.

## 2026-08-17 — Design and Image production authority split

**Decision:** Persona owns immutable WHO, Design owns immutable approved WHAT, Shopify is authoritative for PRODUCT only after live server verification, and Image owns campaign/shot/job/output/review state. Browser handoff and Brain reports may transport/project this data but cannot authorize paid production.

**Why:** The prior path could freeze browser artwork only during paid preparation, mix product sources, and lose production intent/review state on refresh. Production inputs require independent durable identity, version, checksum, authority, and provenance.

**Implementation:** Additive tables `design_master_artworks`, `image_production_projects`, and `image_production_assets`; typed `ProductProductionContext`; project-linked exact-input jobs; private scoped buckets; human review state. Migrations applied 2026-08-17 to `lggogmvpktedkimbpzix`.

## 2026-08-17 — Apply Image production migrations without enabling paid runtime

**Decision:** Apply the two additive Image/Design authority migrations after controlled preflight/dry-run, but keep `NEXHQ_IMAGE_PAID_GENERATION_ENABLED=false` and perform no provider calls during apply/verification.

**Why:** Application code was already migration-ready; live schema durability was the remaining blocker for safe Prepare/Estimate workflow testing. Paid execution remains a separate controlled step.

**Implementation:** `20260817013000_image_paid_generation_jobs.sql` and `20260817030000_design_image_production_authority.sql` applied in order; post-apply schema/RLS/grants/bucket verification recorded in [[docs/nexhq/studios/IMAGE_PAID_MIGRATION_PREFLIGHT_2026-08-17.md]].

## 2026-08-17 — Separate free deterministic planning from paid execution

**Decision:** The production `/api/image/run` route builds a deterministic shot plan without invoking a paid LLM. Paid image execution begins only after exact inputs, estimate, fingerprint, owner confirmation, and atomic claim.

**Why:** A planning click before estimate/confirmation must not incur paid provider cost. Provider-neutral domain inputs also must remain separate from the OpenAI adapter representation.

## 2026-08-17 — Private generated assets require human review

**Decision:** New generated output is stored in private `image-production-assets`, persisted with exact lineage, and enters `REVIEW_REQUIRED`; only an authenticated human may set `APPROVED` or `REJECTED`. Temporary signed URLs are access projections, not durable provenance.

## 2026-08-17 — Approved Artwork is applied deterministically, never recreated by the production provider

**Decision:** Exact mockup production uses two stages. Stage A generates a Persona/Product/scene base without Master Artwork input. Stage B verifies the approved Artwork checksum and applies its original RGBA pixels to a calibrated `PrintSurface` using deterministic transforms/compositing. The old dual-reference edit is classified as historical/draft-generative behavior, not exact production.

**Why:** Read-only forensics proved the first live v1 job executed the exact frozen input, while the provider still changed typography and design content. Prompt instructions and high input fidelity are not an immutable pixel contract.

## 2026-08-17 — Artwork, Product, Persona, and Image Production are separate authorities

**Decision:** Design Studio becomes a reusable Artwork Library independent of Product. Product Library owns Shopify-live and manual Product profiles/references. Persona owns Brand Model identity. Image Studio owns only the frozen composition/project/job/assets/review boundary.

**Why:** Artwork must be reusable across products; future/manual products can predate Shopify; Product imagery and construction are not Artwork; Persona identity must never be mixed with either.

## 2026-08-17 — Composite failure must reuse the paid base

**Decision:** V2 persists explicit `BASE_GENERATION` and `DETERMINISTIC_COMPOSITE` stage outputs. A successful base is a hard retry boundary. Composite failure is locally retryable from that base and never silently triggers another paid provider call.

**Implementation status:** The additive migration is applied and verified. V2 repositories, exact Prepare/Estimate/Confirm, Product-reference freeze/calibration, synthetic Stage A, deterministic Stage B, retry, recovery, and human review are wired and no-provider tested. A real provider-backed Stage A remains separately unauthorized and unverified.

## 2026-08-17 — Synthetic Stage A is a development/test capability, not a production provider

**Decision:** V2 proves its orchestration with a deterministic local canvas base that performs zero network calls. The authenticated execution route refuses synthetic execution in production builds. A future real Stage A must implement the same `BaseImageProvider` seam and requires separate authorization and validation.

**Why:** Persistence, fingerprinting, compositing, retry, reload, and review can be verified without spending provider credit or risking another generative Artwork failure. Synthetic success is not evidence that a real provider will preserve Persona/Product fidelity or expose a usable garment surface.

## 2026-08-17 — V1 and V2 executors are contract-disjoint

**Decision:** Legacy repositories select only rows whose input contract/mode markers are null. V2 repositories select only `image-generation-input-v2` + `DETERMINISTIC_COMPOSITE`. V1 remains historical/draft-generative and cannot consume a V2 confirmation; V2 cannot reinterpret a historical job.

## 2026-08-17 — Product Library is the Image production knowledge authority

**Decision:** Reuse the versioned `product_profiles` aggregate for Shopify canonical snapshots plus NexHQ enrichment and for independent Manual Product Profiles. Shopify authority and manual production metadata coexist without silent override. Manual profiles never claim Shopify authority; optional linking is explicit, actor-attributed and non-merging.

**Why:** Artwork must remain reusable and independent, while Image V2 needs one frozen Product Profile version, exact variant semantics, references, construction and calibrated surface. Insert-only versions preserve historical job truth and make all production-critical changes fingerprint-visible without duplicating the existing schema.

## 2026-08-18 — Production Video starts from approved Image authority

**Decision:** Video V1 production mode accepts only a durable human-approved deterministic Image Studio asset whose Persona/Product/Artwork lineage exactly matches the selected authorities. Text-to-video remains draft/future.

**Why:** The approved source provides the strongest current continuity and prevents a browser upload from impersonating production truth. It still does not guarantee frame-level Artwork fidelity.

## 2026-08-18 — Video is a standalone safe job domain

**Decision:** Video has separate projects/jobs/assets, a versioned snapshot, 30-minute confirmation, atomic single claim, one-job/one-output uniqueness, UNKNOWN_OUTCOME and human review. It does not reuse Image job tables.

**Why:** Shared safety principles are reusable; persistence semantics and async Video provider capabilities are domain-specific.

## 2026-08-18 — Video identity readiness and Video use are separate lock-bound human authorities

**Decision:** A general/pre-lock identity checklist, Image approval, Identity Lock or Brand Cast membership cannot grant Video eligibility. A human first reviews the exact current lock/reference package for Video identity suitability. The owner then separately confirms Video Studio use. Both decisions are persisted with actor/time and exact lock/review/fingerprint bindings.

**Why:** A raw boolean can survive stale identity state and does not explain the human evidence used. Exact bindings make lock advancement, package change and rights revocation fail closed while preserving historical jobs and audit evidence.

## 2026-08-19 — Content Packs are selection projections, never batch authority

**Decision:** Implement Basis-Pack and Winning Design Expansion as stable shot catalogs projected into the existing Image V2 single-asset workflow. Progress is derived from exact durable lineage; no new batch table or executor is introduced.

**Reason:** Weekly content planning benefits from repeatable coverage, while cost confirmation and deterministic Artwork fidelity require one independently reviewed asset at a time.

## 2026-08-19 — Supplier identity requires explicit Product evidence

**Decision:** Add `ProductSourceContext` to Product Profile, Image and Video snapshots. Recognize MarketPrint, Brandsky and Brandcanyon only from exact Shopify vendor/explicit source tags or later owner confirmation; never infer from title. Conflicts and absence remain unknown.

**Reason:** Supplier knowledge can improve later calibration and production guidance, but an incorrect supplier claim would corrupt Product truth.

## 2026-08-19 — Semantic placement translates owner intent but never replaces PrintSurface

**Decision:** Present front/back apparel language and Product-compatible placement presets in Image Studio, then resolve each single-side choice to exactly one ready Product `PrintSurface` whose profile/variant/family scope is explicitly authorized. Freeze both semantic choice and resolved surface in new V2 snapshots. Missing, ambiguous and incompatible geometry fails closed. Keep the four-point editor as advanced explicit calibration. Model `Beidseitig` only as two individually executed views because the current one-job/one-still contract owns one PrintSurface.

## 2026-08-19 — PrintSurface is reusable Product truth; fine tuning is job-local

**Decision:** Store calibration on the versioned Product Profile. Permit cross-listing inheritance only with explicit owner-confirmed physical-blank equivalence, a stable family key, concrete compatible Shopify Product IDs, and explicit compatible-variant policy. Keep profile-local historical surfaces valid. Never infer equivalence from Artwork, supplier alone, or listing-title similarity.

**Decision:** Separate canonical recalibration from a one-job visual override. The latter binds to the exact canonical surface ID/version, participates in the V2 fingerprint, and cannot alter Product Library truth.

**Decision:** Implement `Beidseitig` as a non-executing two-entry plan. Each front/back entry resolves a truthful side-specific shot and remains one independently prepared, confirmed, generated, and reviewed asset.


## 2026-08-19 — New exact-production jobs lock Artwork aspect ratio

**Decision:** `nexhq-deterministic-compositor-v2` permits translation and one uniform scale only. It contains the original checksummed Artwork inside the resolved Product PrintSurface and leaves natural empty space rather than stretching, squashing, rotating, or projectively warping it. The policy is fingerprinted and effective scale/rectangle are provenance. Historical compositor-v1 snapshots retain their original projective-fill interpretation.

**Reason:** A Product placement region may define available space, but it cannot override Artwork proportions. Exact visual content is more important than filling every boundary.

## 2026-08-19 — Simplify Image owner workflow without weakening authority

**Decision:** Collapse the normal Image journey to four broad phases, make Social Content Assets primary and Shopify Mockups secondary, replace six owner checkboxes with one explicit review acknowledgement, hide synthetic QA by default, and default new Product calibration to the exact selected variant. Cross-variant/family reuse remains an explicit advanced attestation. No confirmation, fingerprint, review, RLS, or one-job/one-asset rule changes.

## 2026-08-20 — Social variety is structured planning, not random prompt or batch authority

**Decision:** Freeze `social-creative-direction-v1` in every new owner-prepared V2 job. Keep Shopify Mockups on a small consistent preset set and Social Content on a broad compatible preset set. Treat scene, location, lighting, camera, composition, presentation, mood, channel and aspect as explicit production inputs whose changes invalidate confirmation.

**Decision:** Keep Social variation plans local/non-executing in V1 with zero automatic jobs. Anti-repetition suggestions rank supplied planning history only. Research direction is not production authority.

**Reason:** Milaene needs broad weekly asset variety from the same exact Artwork and Product without allowing stylistic variation to corrupt Product, Persona, PrintSurface or deterministic Artwork truth.

## 2026-08-20 — Remove routine PrintSurface setup without removing PrintSurface authority

**Decision:** Resolve normal semantic placement through ordered Product truth: exact owner/Product surface, verified persisted physical-family surface, conservative versioned NexHQ Product-family template, then fail closed. Keep manual four-point calibration only in Product Library technical data. The server re-derives standard templates and freezes the resulting PrintSurface; the browser cannot submit arbitrary template geometry.

**Decision:** Remove the separate owner-facing Aufnahme phase because Content Pack is already the canonical single-shot selector, and resolve creative-direction defaults synchronously to prevent transitional layout flicker. Canonical shot identity, V2 fingerprints, historical jobs, Stage B, uniform Artwork scale, and one-job/one-asset do not change.

## 2026-08-20 — Complex internals, simple Image owner flow

**Decision:** Keep all Image V2 authority, versioning, confirmation, compositing, recovery, history, and review contracts intact while reducing the normal UI to four phases and owner-relevant choices. Make creative direction preset-first, limit Shopify to three consistent choices, group Winning content by purpose, hide synthetic execution and raw lineage under Technical Details, and replace the visible review checklist with one explicit Freigeben/Ablehnen decision mapped to the existing durable dimensions.

**Reason:** Daily content production should expose creative and commercial decisions, not implementation mechanics. Simplifying the projection reduces errors without weakening the underlying safeguards.

## 2026-08-20 — Connect real deterministic Stage A, preserve Artwork-free generation

**Decision:** Reuse the existing OpenAI Images edit adapter and deterministic v2 job/stage/asset repositories. Resolve the current locked Persona Master + 5/5 support package and frozen Product references as private bytes before an atomic paid claim. Build Stage A with no Artwork property, persist one base, then run local Stage B. Quarantine ambiguous post-claim failures as unknown outcome and never blind-retry.

**Decision:** Treat Content Pack progress as silent optional history; default a sole eligible Model once; add direct read-only selection from the approved Artwork Library; and materialize NexHQ standard Product templates as non-warped axis-aligned rectangles. Historical jobs and owner/Product calibrated authority remain unchanged.

**Operational status:** The owner subsequently enabled the guarded localhost configuration and authorized one controlled real run. The executor completed, and the resulting Product-reference print-contamination defect is addressed by the next decision. No provider call was made while implementing that fix.

## 2026-08-20 — Blank Base print-zone purity is mandatory

**Decision:** Treat every design, logo, word, or graphic visible in a Product reference as non-authoritative for Stage A. Instruct the provider to generate a completely blank target garment side, then run a local print-region purity guard before deterministic compositing. Suspected contamination becomes `BASE_PRINT_ZONE_CONTAMINATED`; Stage B and review asset creation are refused, and the consumed paid attempt is never automatically repeated.

**Decision:** Tune new T-shirt `FRONT_LARGE` jobs with a fingerprinted, axis-aligned job override that is 12% larger and 2% of output height higher than the resolved canonical surface bounds. Keep canonical Product geometry and all historical snapshots unchanged. Continue applying the exact approved Artwork with uniform scale and translation only.

**Reason:** The first controlled real V2 output showed that a design-bearing Shopify Product reference can cause a provider to bake an old print into the Base. Source-over Stage B cannot erase that print without corrupting transparent approved Artwork content. Base purity must therefore be enforced before the approved Artwork becomes the sole final print authority.

## 2026-08-20 — Identity and premium scene direction are explicit Stage A priorities

**Decision:** Keep the Persona Master first in the OpenAI edit input, retain the complete locked support package and high input fidelity, and make exact identity the non-negotiable human-subject priority. Product references define garment truth only; preset, location, mood, styling, and cultural cues cannot recast or reinterpret the selected Markenmodel.

**Decision:** Project a global premium commercial-fashion quality contract plus preset-specific environment direction into new Stage A prompts. Urban, parking, stadium, studio, and interior presets require intentional clean environments and reject low-grade scenery, clutter, accidental text/logos, and cultural stereotypes. This remains derived creative direction, not production authority.

**Decision:** Supersede new standard T-shirt front-large tuning with fingerprinted v2 geometry: 20% larger and 2.5% of output height higher. Preserve axis alignment, exact Artwork bytes, uniform aspect-locked scale, canonical Product geometry, and all historical v1 snapshots.

**Reason:** The first controlled result showed identity drift, weak scene art direction, and a conservative print footprint. Stronger provider constraints and Base capture conditions improve the existing two-stage system without introducing generative Artwork or changing authority boundaries.

## 2026-08-20 — Fabric-aware Stage B is bounded deterministic physical adaptation

**Decision:** New Image V2 prepares use `nexhq-deterministic-compositor-v3-fabric-aware-v1`. Stage B first preserves the approved Artwork through uniform aspect-locked contain placement, then applies only bounded Base-derived displacement, local light/shadow response, fine cloth-texture response, and fixed print opacity. The policy and limits are frozen in the input fingerprint and recorded in provenance. The implementation samples only the checksummed Artwork and checksummed Base; it cannot redraw, replace, rotate, globally stretch, or semantically edit the design.

**Decision:** Keep compositor v1/v2 parsers and execution semantics unchanged for historical snapshots. Do not reinterpret old assets. Treat severe folds, semantic garment segmentation, UV mapping, depth-aware occlusion, and full tracking as later work rather than pretending V1 solves them.

**Reason:** A flat source-over layer preserved authority but looked detached from real cloth. Conservative deterministic physical response improves garment integration without transferring Artwork authority to a generative provider.

## 2026-08-20 — Real Image execution exposes one truthful owner state machine

**Decision:** During the existing single execution request, Image Studio polls durable job state read-only and maps it to stable German phases for confirmation, Base creation, compositing, persistence, and review. Polling never claims or executes a job. Duplicate clicks remain disabled, `UNKNOWN_OUTCOME` never offers blind retry, and **Produktion fortsetzen** appears only for a safely recovered confirmed attempt or a known pre-claim continuation.

**Reason:** A 20–40 second synchronous request with only a disabled button looked broken. Owner clarity can improve without adding a queue, creating a second executor, or weakening paid-attempt safety.

## 2026-08-20 — Base-purity evidence is inspectable and v2 masks structural boundaries

**Diagnosis:** Read-only inspection of the latest failed deterministic job proved its persisted Base garment was blank. `base-print-purity-v1` evaluated a frozen box extending across beard, neck, and collar; its largest sharp connected component was only marginally above the v1 threshold and came from the face, not a garment graphic.

**Decision:** Keep the exact frozen placement as audit geometry, but use `base-print-purity-v2` to score a bounded inner print core. Preserve the combined outlier/edge/connected-component gate for obvious graphics. Do not retry or rewrite the historical failed job. Add an authenticated, checksum-verified server-streamed Stage-A Base preview with the exact placement overlay and no private storage URL/path exposure.

**Reason:** Normal anatomy, smooth fabric lighting, seams, folds, and grain must not impersonate a print. Diagnostic evidence must remain owner-inspectable without weakening workspace/private-storage boundaries.

## 2026-08-20 — Product Family is an additive owner projection over Product Profile

**Decision:** Represent owner-created Product Families, colors, family-wide Front/Back placement templates, and optional explicit Shopify mappings inside the existing versioned Product Profile boundary. Store blank references and green calibration assets in the existing private reference system with explicit purposes. Never send green overlays to Stage A; prefer exact color/side blanks.

**Decision:** Freeze MarketPrint-style owner placement as uniform scale + translation with a locked aspect ratio. Calibration screen coordinates are valid for the matching blank mockup canvas only. Generated lifestyle assets use a separate conservative garment-relative mapping for known garment types and fail closed for unknown types. Preserve the existing fabric-aware compositor and every Content Pack/creative system.

**Reason:** The owner needs garment → color → side → place Artwork simplicity without losing Shopify commerce truth, Product authority, deterministic Artwork authority, or historical compatibility. The existing Product Profile JSON boundary supports this additively, so no migration or competing Product system is justified.

## 2026-08-21 — Product Family selection uses an independent fast path

**Decision:** Do not gate canonical Product Family data on the live Shopify catalog, full signed Product-reference previews, durable report persistence, or optional history. Read the lean Product Family projection independently, render canonical shot cards locally, defer history, coalesce short-lived stable reads, and invalidate on Product writes. Durable report/authority resolution remains required before Prepare.

**Reason:** The former client `Promise.all` waited for the slowest unrelated catalog source, while shot cards depended on a background report write. That structural critical path made correct static choices appear disabled for the full 20–30 second owner-observed wait.

## 2026-08-21 — Large front print is strict semantic authority

**Decision:** New Product Family jobs use `GENERATED_GARMENT_RELATIVE_V3`. MarketPrint calibration and owner scale/translation remain physical intent, while the frozen semantic preset chooses a distinct garment-relative execution template. `FRONT_LARGE` must remain large, central and below the collar with no hidden size reduction. If that cannot be proven from the Stage-A garment mask, fail before Stage B instead of falling back to a chest print. Preserve V1/V2 job interpretation.

## 2026-08-21 — Generated garment geometry is execution evidence

**Decision:** `GENERATED_GARMENT_RELATIVE_V2` introduced the first local Product Family garment-registration path. After the one paid Base is persisted, it finds garment boundaries, applies face/neck exclusion, maps frozen MarketPrint/owner intent in garment coordinates, and requires confidence/coverage before purity and Fabric-Aware Stage B. Its historical interpretation remains frozen; V3 now supersedes it for new jobs.

**Reason:** A Product-template screenshot and generated lifestyle image have different framing, pose, scale, curvature and garment position. Copying screen coordinates preserved neither placement intent nor visual attachment. Fail-closed local registration improves correctness without another provider call or transferring Artwork authority.

## 2026-08-21 — SAM 3 is precision boundary evidence, not authority

**Decision:** Put SAM 3 behind a provider-neutral, server-only `GarmentSegmentationProvider`. Freeze its policy for new Product Family V3 jobs, bind one private mask to the exact job/Base checksum/model/version, validate and select candidates locally, and reuse that mask for V3 registration, deterministic clipping, and authenticated diagnostics. Do not call SAM during planning and do not reinterpret historical jobs.

**Decision:** Preserve the authority chain: Product Family and Product rules define the garment; MarketPrint defines printable-area intent; owner placement defines uniform scale/translation; Artwork remains the sole design truth; V3 maps these into the validated mask; Fabric-Aware V1 renders and clips. `FRONT_LARGE` remains large/central or fails. SAM cannot pick a placement or create a chest fallback.

**Reason:** A semantic garment mask gives materially stronger pixel-boundary evidence than color-component analysis in varied scenes while retaining deterministic placement and Artwork control. A local validation/clipping boundary prevents provider mask mistakes from leaking Artwork onto skin, props, or background.

## 2026-08-21 — fal is the default hosted SAM 3 transport

**Decision:** Use fal's official `fal-ai/sam-3/image` endpoint through a server-created `@fal-ai/client`, with `FAL_KEY` as the only required credential. Send the private Base as a data URI, request multiple raw PNG masks with scores/boxes, and normalize them behind `GarmentSegmentationProvider`. Retain the generic HTTPS adapter only as an explicit compatibility option.

**Reason:** The hosted adapter removes the operational and security burden of a custom SAM server without coupling Garment Registration V3 or Image Studio to fal. Provider-specific transport ends at the canonical mask contract; MarketPrint, owner placement, `FRONT_LARGE`, Artwork and Fabric-Aware authority remain unchanged.

## 2026-08-23 — Surface conformity is bounded local evidence inside Fabric-Aware Stage B

**Decision:** For new Product Family jobs only, freeze `nexhq-surface-conforming-integration-v1` inside the existing Fabric-Aware compositor. Derive a deterministic low-resolution displacement mesh from the exact Base raster and validated SAM mask after Garment Registration V3. Keep the placement rectangle, source checksum, global aspect ratio, `FRONT_LARGE`, and owner scale/translation authoritative; pin warp to zero at placement boundaries and cap the combined surface/fold response inside the existing displacement ceiling.

**Decision:** Fail closed before producing a review asset when mask coverage, surface geometry, evidence confidence, required warp, or typography-distortion safety is insufficient. Persist only scalar diagnostic evidence and never reinterpret historical jobs without the optional surface contract.

**Reason:** A single flat rectangle plus per-pixel light response preserved design authority but did not sufficiently follow torso perspective and coherent cloth structure. A bounded mesh materially improves physical attachment without AI repainting, a new provider, a new placement authority, or a migration.

## 2026-08-23 — Typography safety measures the applied local transform

**Decision:** Regularize noisy raster-derived Surface-Conforming mesh samples before application, then gate the exact applied mesh with a rotation-invariant local Jacobian analysis: principal scale, shear/axis-angle change, area change, and neighboring strain discontinuity. Ignore only fully transparent Artwork cells during analysis; retain the complete canonical raster during placement and compositing. Keep the frozen 7.5% safety bound and fail closed for genuinely unsafe local deformation.

**Decision:** Treat the legacy `effectivePrintRealismConfidence` field as versioned surface-evidence reliability for new evidence: validated mask, garment geometry stability, and unclamped mesh evidence. Typography is a separate hard gate and is not counted a second time. Composite-only retry may claim `SURFACE_INTEGRATION_UNSAFE` jobs but must reuse the exact persisted Base, passed identity assessment, validated SAM mask, V3 registration, and clean purity result.

**Reason:** The old maximum neighboring-displacement gradient mixed rotation, shear, and raster noise into one scalar and the confidence formula then penalized that scalar a second time. The first real QA Base exposed a sharp raw row-to-row mesh reversal despite only a 4.87 px maximum node displacement. Deterministic mesh regularization plus actual-transform validation preserves the protection without paying for or regenerating Stage A/SAM.
## 2026-08-23 — Owner footprint is distinct from local surface deformation

- `FRONT_LARGE` Product Family jobs freeze `nexhq-owner-print-footprint-v1`.
- MarketPrint + owner CONTAIN placement is resolved once; garment registration
  owns global placement transfer.
- Surface-Conforming V1 keeps zero displacement at the print boundary and may
  adapt only the interior pixel mapping.
- A print that cannot retain the requested footprint fails closed instead of
  receiving another contain, inset, or chest-scale fallback.
- Historical jobs are not reinterpreted.

## 2026-08-23 — FRONT_LARGE uses a torso-only envelope, never the full shirt silhouette

- The validated SAM mask remains full-garment clipping evidence.
- New Product Family T-shirt `FRONT_LARGE` jobs derive a versioned central
  torso envelope from stable lower/central mask rows before mapping MarketPrint
  and owner footprint intent.
- Sleeve wings, dropped shoulders and collar pixels cannot define print bounds.
- Surface/Fabric stages consume this geometry; they do not repair it.
- Unsafe torso extraction fails closed, and historical registrations retain
  their frozen interpretation.

## 2026-08-23 — Depth-aware evidence may adapt only local sampling

**Decision:** Freeze `nexhq-depth-aware-surface-integration-v1` for new T-shirt
Product Family jobs. Derive a deterministic relative surface field from the
frozen Stage-A raster and validated SAM mask, then merge it with the existing
Surface-Conforming mesh before Fabric-Aware compositing. Keep the torso envelope,
owner footprint, one-CONTAIN result, `FRONT_LARGE`, Artwork checksum and SAM
clipping as unchanged upstream authorities.

**Decision:** Pin the complete mesh boundary and record that no secondary scale
or translation occurred. Gate the exact combined mesh with the existing
Jacobian typography safety policy and the frozen total displacement bound.
Missing evidence or a strong unsafe field fails closed; there is no silent flat
fallback.

**Reason:** Correct global placement can still look planar when the visible
shirt front leans or has coherent perspective/depth variation. A bounded local
relative-depth proxy improves physical attachment without introducing Artwork
repainting, provider cost, a second placement system, or historical
reinterpretation. It intentionally does not claim metric depth or full cloth UV
reconstruction.

## 2026-08-23 — Print usability is a Stage-A authority; real depth remains local-only geometry evidence

**Decision:** Freeze `nexhq-print-ready-stage-a-v1` for eligible T-shirt `FRONT_LARGE` model jobs and use `fal-ai/image-preprocessors/depth-anything/v2` behind `DepthEstimationProvider` when strict production policy requires real depth.

**Boundary:** Identity → Product → print readiness outrank scene novelty. SAM and torso registration retain global geometry authority; MarketPrint/owner footprint retains global scale and translation. Depth may move interior mesh nodes only, never re-contain, globally scale, translate, crop, or receive Artwork. Local proxy depth remains named fallback/cross-check evidence. Fail closed on weak/corrupt depth or unsafe deformation.

## 2026-08-24 — Owner Y is frozen global placement authority

**Decision:** Add `nexhq-owner-vertical-placement-v1` for supported front
placements. The normal editor writes the existing owner `offsetY`; Prepare
freezes it with the canonical one-CONTAIN rectangle and expected torso-relative
Y. Registration and compositing must prove preview → registered → final Y
continuity. Previous Runs restores the same scale/X/Y.

**Safety boundary:** Only a bounded, evidenced collar/hem correction is
permitted and reported. An unsafe correction fails closed with a height-specific
message. Depth and surface integration may adapt local interior sampling only;
no second global translation, recenter, contain, or scale is allowed.

**Reason:** The existing direct-drag placement state already contained vertical
intent, but it was not an explicit versioned production/recovery contract and
normal controls did not make height adjustment discoverable. Freezing and
verifying that existing authority closes the preview/production gap without a
new geometry system or historical reinterpretation.

## 2026-08-25 — Surface realism may strengthen local direction, never global placement

**Decision:** Add `nexhq-surface-realism-refinement-v1` only to new eligible
T-shirt Product Family `FRONT_LARGE` snapshots. Use validated real depth when
available, mask/torso evidence, and a bounded local luminance cross-check to
derive plane, perspective, detrended surface-direction, and curvature guidance.
Pin the full boundary and revalidate the exact combined mesh with the existing
Jacobian typography gate.

**Rendering boundary:** Improve shirt light/shadow and texture transfer through
bounded scalar modulation, which cannot shift hue or rewrite Artwork. Do not
add a contain, global scale, translation, recenter, crop, or semantic edit.

**Failure/recovery:** Weak or unsafe refined evidence produces
`SURFACE_REALISM_REFINEMENT_UNSAFE` and no review asset. Authorized retry is
deterministic Stage B only and reuses persisted paid-stage evidence. Historical
snapshots without the optional contract keep their exact prior policy.

**Reason:** The prior depth-aware pass corrected global placement and added mild
local geometry, but real Parkhaus QA still read too planar. A small versioned
interior refinement plus stronger hue-safe surface transfer improves physical
attachment without weakening owner authority or introducing a new provider.

## 2026-08-26 — Depth warp safety follows the sampled garment transform

**Decision:** Version new depth-aware snapshots as
`nexhq-depth-aware-surface-integration-v1.1-garment-plane`. Fit perspective from
robust low-frequency depth inside the SAM-confirmed torso/print neighbourhood,
not from full garment-mask width change. Evaluate refusal from actual mesh-node
displacement, clamping, Jacobian typography risk, and mask containment.

**Diagnostics:** Persist requested warp, safely bounded warp, applied warp,
rejected excess, clamped-node count, raw/normalized plane slopes, robust depth
range, fit method, and analysis scope. A refusal may report zero applied warp
only when its non-zero requested/safe candidate is also visible.

**Historical boundary:** V1 remains parseable and frozen. Because changing its
plane interpretation would rewrite a historical job contract, a V1
`DEPTH_AWARE_SURFACE_UNSAFE` job requires a fresh Prepare; it is not silently
upgraded through Stage-B retry.

## 2026-08-26 — Low depth amplitude is not automatically unsafe

**Decision:** New T-shirt jobs use
`nexhq-depth-aware-surface-integration-v1.2-hybrid-low-depth`. Depth quality is
classified relative to the validated provider-policy floor. A low-range map may
proceed only as `DEPTH_LOW_STABLE / NEAR_PLANAR_HYBRID` when discontinuity,
SAM coverage, torso stability, garment-only sample coverage, plane/perspective,
and local fabric evidence agree.

**Safety boundary:** This is not a threshold reduction. Below-floor, corrupt,
discontinuous, contradictory, unstable, clipped, typography-unsafe, or
excessive-warp evidence remains refused. The outer footprint and owner X/Y stay
pinned. Historical V1/V1.1 contracts retain their exact interpretation and
require a fresh prepared job for the new policy.

## 2026-08-26 — Global front print registration follows the garment plane

**Decision:** Fresh eligible T-shirt front jobs freeze
`nexhq-oriented-front-print-plane-v2`. Garment Registration V3 derives a
bounded oriented quad from stable SAM torso rows, centerline drift, torso-edge
continuity, and upper-torso agreement. Sleeve-expanded rows and background
lines are explicitly excluded. Real depth remains downstream supporting/local
surface evidence rather than scene orientation authority.

**Authority boundary:** MarketPrint and owner scale/X/Y define the footprint;
the oriented plane changes only its receiving shape around the same centre.
There is no second contain, scale, translation, recenter, or silent upright
fallback. Depth-Aware V1.2 and Surface Realism consume the oriented plane and
may only add bounded local interior deformation.

**Safety/history:** All corners must remain within the torso safe zone and SAM
mask with collar/hem clearance. Orientation confidence, perspective, mask
containment, and the final combined typography transform are fail-closed.
Historical snapshots remain axis-aligned and are never upgraded during retry;
oriented V2 requires a fresh Prepare.

## 2026-08-26 — Owner footprint lives in an oriented torso coordinate frame

**Decision:** Fresh eligible T-shirt fronts freeze
`nexhq-oriented-front-print-plane-v2.1-torso-frame`. Garment-only centerline
and boundary evidence now creates a torso-local U/V frame and safe polygon.
Owner scale/X/Y are interpreted in that frame before projection to the image;
the runtime no longer rotates an image-space rectangle and compares it with an
upright AABB.

**Containment truth:** The projected quad is evaluated against the convex torso
polygon and SAM mask, with local collar, hem, left, and right clearances. Gates
that did not execute are `NOT_EVALUATED`, not false 0%/NO measurements.

**History:** V2 remains parseable and retains its frozen post-hoc rectangle
behavior. V2.1 is available through fresh Prepare only and is consumed by the
existing Depth-Aware V1.2 and Surface Realism stages without changing their
local deformation authority.
## 2026-08-27 — MiDaS normal assists, but does not replace, torso authority

- Added provider-neutral normal estimation with the official hosted fal model
  `fal-ai/image-preprocessors/midas`.
- MiDaS receives the private frozen Stage-A Base only. Its normal output is
  private, checksum-bound, versioned, validated, and idempotent.
- `nexhq-oriented-front-print-plane-v2.2-normal-assisted` blends silhouette
  and garment-only normal confidence instead of allowing either signal to
  blindly dominate.
- Strong contradictions fail closed; missing/invalid/unknown provider outcomes
  remain distinct.
- Historical V2/V2.1 snapshots retain frozen geometry. Fresh Prepare only.
- Depth Anything V2 remains canonical downstream depth evidence. MiDaS depth
  is neither persisted nor substituted.
- Owner scale/X/Y and exact Artwork pixels remain authority; no second contain,
  global scale, or global translation is introduced.
