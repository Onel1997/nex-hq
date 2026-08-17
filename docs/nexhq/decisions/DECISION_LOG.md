# Decision Log
Status: Canonical append-only architectural decisions.

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
