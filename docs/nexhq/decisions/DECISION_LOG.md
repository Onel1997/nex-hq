# Decision Log
Status: Canonical append-only architectural decisions.

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
