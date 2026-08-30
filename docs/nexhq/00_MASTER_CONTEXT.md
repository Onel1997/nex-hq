# NexHQ Master Context

Status: Canonical  
Audience: Human developers + AI coding agents  
Last verified against code: 2026-08-19

This is the canonical entry point for understanding NexHQ. It records both the product direction and the verified implementation baseline. Statements labeled **CURRENT STATE** describe code inspected on the verification date; statements labeled **TARGET STATE** are product decisions and must not be inferred to exist in production.

> **2026-08-20 Image production update:** The later sections contain historical current-state details from earlier Persona/Image milestones. For Image-production authority, the following newer inspected state supersedes any conflicting sentence: Design-owned immutable Artwork, typed Shopify/local Product context, durable Image projects/jobs/assets/review, private output access, reload recovery, and the real owner-confirmed Stage A/local deterministic Stage B executor are implemented. The owner authorized the first controlled real run on 2026-08-20. That run exposed a design-bearing Product-reference contamination defect; new jobs now enforce blank-garment prompt purity and a fail-closed local Base-region guard before Stage B.

## 1. What NexHQ Is

**TARGET STATE:** NexHQ is an AI-powered business operating system. It should coordinate specialized studios, shared business context, governed AI providers, and performance intelligence as one operating loop—not behave as a collection of disconnected AI tools.

**CURRENT STATE:** The repository is a Next.js/React/TypeScript application with studio routes, shared intelligence modules, Supabase persistence, provider integrations, and business-specific configuration. Shared infrastructure exists, but several studio handoffs and sources of truth remain fragmented (`app/(dashboard)/agents/`, `lib/brain/`, `lib/persona/`, `lib/data-source-platform/`, `lib/supabase/`).

## 2. Current Business and Workspace

**TARGET STATE:** Milaene, a fashion brand, is the first real NexHQ business/workspace. The architecture should remain capable of supporting additional businesses without weakening Milaene's real production workflows.

**CURRENT STATE:** Milaene is the active and most deeply implemented workspace. A workspace registry also names `nex-trends` and `nex-agency`, while parts of the UI, prompts, migrations, and Brand Face selection still contain Milaene-specific defaults or identifiers (`README.md`, `workspaces/registry.ts`, `lib/brand-face-selection/store.ts`, `supabase/migrations/`). Clean tenant neutrality is therefore not yet verified.

## 3. Product Philosophy

**TARGET STATE:** Build vertically and foundation-first. A visible UI is not a completed studio. Each production studio must establish reliable data, persistence, validation, backend behavior, tests, type safety, production build health, end-to-end workflow, usable UX, and resolution of major bugs before development moves deeply into the next studio.

The system must preserve provenance and approval boundaries. Human-approved assets and real business outcomes have more authority than generated suggestions, fixtures, or inferred data. Discovery should create options; governance should decide what becomes reusable business truth.

**CURRENT STATE:** The repository contains substantial implementations across several studios, but maturity is uneven. Persona has the strongest explicit lifecycle and approval structure; later studios contain significant UI and service code without equivalent proof of durable end-to-end completion.

## 4. Studio Map

| Studio              | CURRENT STATE                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | TARGET STATE                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Persona Studio**  | Substantial implementation: Official Brand Face Casting, candidate generation/review, persistent Persona projects, review-bound Identity Lock, controlled explicit image/video/Brand Cast approvals, centralized eligibility, one canonical `brand-model-v1` contract, real Image/Video handoff boundaries, one authorization/workspace guard, and an explicit human legacy-reconciliation path. Durable Persona state remains the only application/domain identity authority. Both Persona Foundation migrations are applied and their live schema/RLS posture is verified. The affected legacy model was reconciled into immutable lock version 3 while preserving version 2, and the owner subsequently completed the audited Reference Rights confirmation. The owner reports the canonical Image selector now showing `North African Street Premium · Lock v3`. Provider-conditioned execution and durable v1/v2 Image job boundaries are wired; all three Image/Design authority migrations are applied, while real v2 Stage A verification, durable workspace membership, general Identity Revision, and full downstream production remain incomplete (`components/persona/`, `lib/persona/`, `app/api/persona/`). | Create a small, persistent, governed Brand Cast reusable by downstream production studios.                                                                                |
| **Design Studio**   | The workspace still has browser editing/handoff transport and autonomous-generation code, but explicit Send-to-Image now creates immutable Design-owned approved artwork identity/version/checksum and a private asset through a protected server boundary. Owner-facing Artwork `display_name` is durable metadata separate from original filename and production identity; rename never changes ID/design/version/checksum/status/storage path. Authority and display-name migrations are applied and verified (`lib/design/master-artwork-authority/`, `components/design/`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Primarily accept, validate, approve, and manage the final Master Artwork created by the user; it is not the authority that autonomously invents the final fashion design. |
| **Image Studio**    | Deterministic no-paid shot planning, canonical Persona re-resolution, durable Design artwork resolution, typed live-Shopify/non-authoritative product context, versioned production projects, exact-input paid jobs, 30-minute confirmation, atomic claim, private assets, review-required state, and reload recovery exist in code. Migrations `20260817013000` and `20260817030000` are applied and live schema verified; paid generation remains default-closed and live provider/E2E execution is unverified (`lib/image/`, `app/api/image/`, `components/image/`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Become a Campaign Director that creates coherent campaign systems using approved Brand Models, Master Artwork, and real active product/variant context.                   |
| **Video Studio**    | Foundation V1 provides German owner UX, canonical independent Persona Video gating, exact Product/Artwork/approved-Image lineage, structured direction, safe Prepare/Estimate/Confirm, single-output fake orchestration, recovery and human review. Video migration `20260818003000` and Persona Video readiness migration `20260818160000` are **APPLIED** (2026-08-18) with live schema/RLS/grants/RPC verification. Zero Video-eligible Brand Models; manual Video identity review and Video Use approval pending for `North African Street Premium`; no real provider wired (`app/(dashboard)/agents/video/page.tsx`, `components/video/`, `lib/video/`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Reuse approved models, products, designs, campaign context, and identity constraints, and require explicit video-use approval.                                            |
| **Shopify Studio**  | Shopify operations, catalog, commerce, knowledge, and performance modules exist, but Shopify is not yet the universal product source of truth (`components/shopify/`, `lib/shopify/`, `lib/product-intelligence/`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Make the real Shopify catalog authoritative for active products, variants, colors, sizes, collections, and availability.                                                  |
| **Research Studio** | A substantial Research Studio and Data Sources Center exist with source status/sync concepts and multiple adapters; connector modes vary between live, simulated, cached, unavailable, and coming soon (`components/research/v3/`, `app/api/research/`, `lib/data-source-platform/`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Support creative, product, market, and later performance intelligence. It is important infrastructure, but not the immediate production bottleneck.                       |

## 5. Current Implementation Snapshot

**CURRENT STATE — verified from code, with controlled live database verification only where explicitly noted:**

- The main stack is Next.js 15, React 19, TypeScript, Tailwind CSS 4, Supabase, OpenAI, FAL, LangChain/LangGraph, Zod, and local face-analysis tooling (`package.json`).
- Supabase is used heavily through browser, server, middleware, and service-role clients. Migrations cover the Brain, image storage, Persona projects/candidates/jobs, novelty analysis, reference packages, Identity Lock, and use approvals (`lib/supabase/`, `supabase/migrations/`). On 2026-08-16, the linked `milaene-hq` project was reverified and the two Persona Foundation migrations were applied in order; remote migration history, the resulting columns/constraints/indexes, RLS, grants, and the private Persona bucket were then checked read-only.
- NexHQ has a private single-owner authentication foundation: `/login` uses Supabase email/password through a server action, SSR cookies are refreshed by middleware, dashboard routes are revalidated server-side, unauthenticated pages redirect to login, application APIs return JSON `401`, and logout clears the Supabase session. There is no public signup or durable membership/RBAC. The owner reports that login, session persistence, dashboard access, and Persona reachability have been manually verified (`app/login/`, `app/auth-actions.ts`, `lib/auth/`, `lib/supabase/middleware.ts`, `app/(dashboard)/layout.tsx`).
- Persona's default discovery-provider configuration is OpenAI Images. FAL and fake/test provider implementations also exist, with explicit provider selection and no intended silent fallback (`lib/persona/creation/provider/discovery-provider-config.ts`, `lib/persona/creation/provider/`).
- Persona creation and approval services separate candidate discovery, review, reference-package work, review-gated identity locking, and downstream use approvals. Generic CRUD rejects governed approval/readiness/lock fields, and canonical eligibility uses explicit durable approvals and lock evidence (`lib/persona/creation/`, `lib/persona/domain/governed-fields.ts`).
- Protected Persona APIs now share a typed actor/workspace authorization context. Production requires a Supabase-authenticated user in a server-only allowlist for the server-selected active workspace; the optional local bypass is explicit, disabled by default, and ignored in production. Authorization occurs before service-role-backed workspace/repository work (`lib/persona/security/authorization.ts`, `lib/persona/services/workspace-scope.ts`).
- The applied additive security migration removes known permissive Persona policies, enables RLS on all 26 governed Persona tables, and denies direct `PUBLIC`/`anon`/`authenticated` table access while preserving service-role repositories. A post-apply catalog inspection verified that posture. This remains a single-workspace server boundary, not durable membership/RBAC (`supabase/migrations/20260816220000_persona_foundation_milestone_2_security.sql`).
- The Official Brand Face process-global store remains for temporary session/compatibility state, but it is explicitly non-authoritative and no longer determines official membership, milestone completion, or canonical eligibility (`lib/brand-face-selection/store.ts`, `lib/persona/domain/brand-model-contract.ts`).
- Persona publishes one Zod-validated `brand-model-v1` contract and separate Image/Video handoffs. Canonical eligibility now includes rights across the exact locked Master plus five canonical references. The protected integration API filters ineligible models without failing the whole list, returns a full exact-lock handoff only when eligible, rejects stale versions, and resolves private assets only as transient signed access separate from canonical identity truth (`lib/persona/domain/brand-model-contract.ts`, `lib/persona/integrations/`, `app/api/persona/integrations/route.ts`).
- Image Studio has a minimal Brand Model selector/consumer seam. Its run route and generation route re-authorize and re-resolve the selected snapshot/version/fingerprints; generation validates the immutable six-asset package, downloads only the locked Master bytes server-side, and provides them to the OpenAI edit adapter. Brain assets preserve safe provider/identity lineage. Existing approval and Design handoff state still include client/browser storage. V1 and V2 preparation freeze exact authority into disjoint dedicated jobs; migrations are applied, V2 has a no-provider runtime, and real V2 Stage A remains unwired and separately unauthorized (`components/image/`, `app/api/image/run/route.ts`, `lib/image/`).
- Product Intelligence's synchronous load path is seed-only. A Shopify-first provider boundary is modeled, but its Shopify catalog provider currently reports unavailable; separate live Shopify and Data Source adapters exist elsewhere (`lib/product-intelligence/load.ts`, `lib/product-intelligence/providers/resolve.ts`, `lib/product-intelligence/providers/shopify-provider.ts`, `lib/shopify/fetch-catalog.ts`, `lib/data-source-platform/adapters/shopify.ts`).
- Milaene's seed catalog correctly treats Zip Hoodies as valid active products. Color and size details are explicitly not a substitute for live Shopify verification (`lib/product-intelligence/milaene.ts`).
- Shopify-derived performance modules exist, but a complete learning loop across sales, conversion, ROAS, CTR, returns, engagement, watch time, saves, and shares is not established by the inspected code (`lib/shopify/performance.ts`).
- The 2026-08-18 full local test command passed 1,244 tests across 198 suites. On 2026-08-19, targeted Artwork display-name, master-authority, Design→Image handoff, Image bootstrap, Video Artwork-label, and auth/workspace tests passed; TypeScript and targeted lint were clean. Authorized migrations are applied through `20260818220000` (Artwork display name) on linked project `lggogmvpktedkimbpzix`. No paid provider, generation, deployment, or full E2E production workflow was invoked (`package.json`).

## 6. Canonical Production Flow

**TARGET STATE:**

1. Establish real workspace, brand, product, provider, and data-source context.
2. Complete Persona Studio: discovery → clearly different candidates → human selection → reference package → identity validation → Identity Lock → explicit Image approval → explicit Video approval → Brand Cast approval.
3. Accept and approve user-created Master Artwork in Design Studio.
4. Combine approved Brand Models, approved Master Artwork, real active Shopify products/variants, and campaign direction in Image Studio.
5. Extend approved campaign context into Video Studio only for Brand Models approved for video use.
6. Publish and operate through Shopify and other approved channels.
7. Ingest real outcomes and feed them back into Research, creative, product, and marketing intelligence.

**CURRENT STATE:** Parts of steps 1–5 exist. Persona supplies versioned exact-lock consumer contracts; Design has immutable Master Artwork authority; Product Library has versioned Shopify/manual intelligence; Image projects/jobs/private assets/review are durable. Browser handoff remains temporary UX transport, not canonical paid truth. The Image no-provider V2 chain and Video fake orchestration are repository-tested and their durable schemas are applied; no real Video provider is wired, exact moving Artwork fidelity is unsolved, and the outcome-learning loop is partial.

## 7. Brand Model Philosophy

**TARGET STATE:** A Brand Model is a persistent official identity, not a disposable prompt result. Milaene should eventually maintain approximately three premium Brand Models.

- **Discovery** optimizes for genuinely different candidates.
- **Identity Lock** optimizes for repeatability and identity consistency.
- Human selection and explicit approval are mandatory governance steps.
- Reference packages and identity validation must support reliable reuse.
- Image approval, Video approval, and Brand Cast approval are distinct decisions.
- Downstream studios may use only models approved for that specific use.

**CURRENT STATE:** Durable Persona state is the canonical identity and eligibility authority; the process-local Official Brand Face state is non-authoritative. Persona publishes a controlled, exact-lock `brand-model-v1` contract to Image and Video consumers. Image carries that contract into planning and a controlled generation/provider boundary; Video has only the boundary and typed seam. Both Persona Foundation migrations are applied and their database security posture is verified. The allowlist remains an interim single-workspace authorization model, and manual downstream runtime verification is still required.

## 8. Data Truth Hierarchy

**TARGET STATE — highest authority first:**

1. **Live authoritative systems:** Shopify for active commerce catalog data; connected platforms for their own measured outcomes.
2. **Persisted and explicitly approved NexHQ records:** Brand Models, Identity Locks, use approvals, Brand Cast membership, Master Artwork, and campaign decisions.
3. **Synchronized provider data with provenance:** time-stamped source, connection health, sync state, and errors.
4. **Human-confirmed manual data or clearly labeled seeds:** temporary fallback only, never silently elevated to live truth.
5. **Mocks, fixtures, placeholders, and inferred values:** development or preview aids only; never business truth.

Uploaded designs prove that an asset exists; they do not prove performance. Performance claims require measured outcomes.

**CURRENT STATE:** The code uses a mixture of Supabase records, browser-local handoffs, seed catalogs, connector data, caches, simulated sources, and placeholders. Every consumer and UI must label these accurately. Shopify connectivity in one subsystem does not prove that another subsystem is using live Shopify data.

## 9. AI and Provider Philosophy

**TARGET STATE:** AI providers are governed infrastructure, not hidden implementation details.

- Provider choice, capability, credentials/configuration state, cost exposure, rate limits, health, last sync, and errors should be observable in a centralized Data Sources / Provider Center.
- Paid generation requires explicit user intent and an understandable confirmation boundary.
- Never silently change providers, fall back to a paid provider, or trigger chained generation.
- Persist provider/model provenance and generation settings needed for auditability and reproducibility.
- Prefer deterministic validation and business rules over asking a model to decide governance.
- A configured adapter or visible UI does not mean a provider is live.

**CURRENT STATE:** Persona has explicit discovery-provider configuration and a paid-generation confirmation lifecycle. Image and Research contain additional provider/adaptor work, but provider governance is not yet uniformly enforced across studios. The Data Sources Center is partially implemented rather than a complete universal control plane.

## 10. Development Definition of Done

**TARGET STATE:** A studio or vertical slice is done only when all applicable items are verified:

- complete and usable UI/UX;
- backend/service behavior;
- data model and durable persistence;
- validation, authorization, and workspace isolation;
- error handling, observability, and provider/cost safety;
- meaningful automated tests;
- TypeScript correctness;
- successful production build;
- verified end-to-end workflow and cross-studio contracts;
- no unresolved major bugs or misleading mock/live states.

A route, mock, component, migration file, or happy-path demo alone is not completion. Verification results must be recorded; they must not be assumed. The Milestone 3 verification results recorded here are local automated evidence, not proof of live Supabase, storage, provider, deployment, or end-to-end operation.

## 11. Current Priorities

**TARGET ORDER:**

1. Persona Studio
2. Design Studio
3. Image Studio
4. Video Studio
5. Shopify Studio

Research Studio supports the sequence with intelligence and data-source infrastructure but is not the immediate production bottleneck. Work should remain foundation-first: close the reliability and handoff requirements of the current priority before expanding deeply into the next.

## 12. Important Known Gaps

**CURRENT STATE gaps requiring explicit treatment:**

1. Persona contracts are wired to Image and Video through canonical consumer-specific eligibility. Image paid/deterministic persistence migrations are applied; no real Video provider is selected or verified. Video has a durable fake no-provider orchestration proof; no real Video provider is selected or verified (`lib/persona/integrations/`, `lib/video/`).
2. Persona's review-provenance and deny-direct-access security migrations are applied and their live schema/RLS/grants are verified. The owner completed the explicit legacy review, creating immutable lock version 3 while preserving version 2. That diagnostic identified missing Master rights; the owner then completed the protected audited rights review manually. The owner reports canonical Image eligibility and the `North African Street Premium · Lock v3` selector handoff working. Generation-time code now revalidates that same exact package and rights before resolving private Master bytes; no confirmation was submitted by automation. Durable workspace membership/RBAC remains unresolved (`supabase/migrations/20260816210000_persona_foundation_milestone_1.sql`, `supabase/migrations/20260816220000_persona_foundation_milestone_2_security.sql`, `lib/persona/security/`, `lib/persona/creation/identity-lock/`).
3. Design contains autonomous final-artwork generation paths that conflict with the target user-authored Master Artwork responsibility (`app/api/design/ai-designer/route.ts`, `app/api/design/generate-master-artwork/route.ts`).
4. Durable Design/Image production authority and deterministic V2 persistence are applied. Browser/local state still carries temporary presentation state but cannot redefine production truth. The independent Video persistence migration is applied; the remaining Video boundary is provider capability and exact moving-Artwork fidelity (`lib/design/master-artwork-authority/`, `lib/image/production-project/`, `lib/video/`).
5. Image Studio is substantial but not a verified coherent Campaign Director; several visible actions are incomplete or disabled (`components/image/`).
6. Video Studio Foundation V1 is implemented locally with German UX and a fake-only runtime, but live APIs remain migration-blocked and no external provider capability is verified (`app/(dashboard)/agents/video/page.tsx`, `lib/video/`).
7. Product Intelligence still relies on seed-only loading while its Shopify provider is unavailable, despite separate live Shopify adapters elsewhere (`lib/product-intelligence/`, `lib/shopify/`, `lib/data-source-platform/adapters/shopify.ts`).
8. The Data Sources Center and performance intelligence are partial and must not be represented as complete live outcome learning (`components/research/v3/`, `lib/data-source-platform/`, `lib/shopify/performance.ts`).
9. General application authentication is consistent at the middleware/dashboard boundary, but it is only a private single-owner session gate. Non-Persona domains do not yet have workspace membership or role authorization; Persona remains stronger through its UID allowlist and server-selected workspace. The owner reports the login/session/dashboard path verified, and the Persona RLS changes are applied; full application runtime verification remains pending (`lib/auth/`, `lib/supabase/middleware.ts`, `lib/persona/security/authorization.ts`, `supabase/migrations/`).
10. Persona, Design, Product, Image, Auth and Video now have focused automated coverage, but browser-based owner QA and real-provider validation remain uneven. The live Video schema is intentionally absent until separate migration authorization (`package.json`).

## 13. Rules for AI Coding Agents

1. Read this file first, then the relevant studio/integration document, then the actual code and repository instructions before proposing changes.
2. Treat code as the source of truth for **CURRENT STATE** and explicit product decisions as the source of truth for **TARGET STATE**. Surface conflicts; do not erase either side.
3. Label implementation honestly as implemented, partially implemented, mocked, planned, or deprecated. Never infer “live” from UI, adapters, environment variables, or migrations alone.
4. Preserve approval gates, identity consistency, provenance, and workspace isolation. Never weaken them for convenience.
5. Do not trigger paid AI calls, destructive migrations, database writes, external syncs, or provider changes without explicit intent and the required safety checks.
6. Do not replace real business data with fixtures or seed data. Keep fallbacks visibly labeled and subordinate to authoritative sources.
7. Do not silently change provider selection, fallback behavior, prompts that affect identity, or cost behavior.
8. Inspect the full data path—UI, API, service, repository, schema, authorization, tests, and downstream consumer—before claiming a workflow is complete.
9. Respect existing uncommitted work, repository scope, and `AGENTS.md`. For Next.js code, inspect the repository's installed Next.js documentation before relying on remembered conventions.
10. Update documentation when verified implementation changes, without rewriting target decisions to match accidental implementation drift.

## 14. Documentation Map

- [Product Vision](./01_PRODUCT_VISION.md) — product purpose, users, principles, and target outcomes.
- [Architecture](./02_ARCHITECTURE.md) — system boundaries, modules, data flows, persistence, and runtime architecture.
- [Development Rules](./03_DEVELOPMENT_RULES.md) — engineering, safety, verification, and contribution rules.
- [Roadmap](./04_ROADMAP.md) — ordered foundation work and delivery milestones.
- Studios:
  - [Persona Studio](./studios/PERSONA_STUDIO.md)
  - [Design Studio](./studios/DESIGN_STUDIO.md)
  - [Image Studio](./studios/IMAGE_STUDIO.md)
  - [Video Studio](./studios/VIDEO_STUDIO.md)
  - [Shopify Studio](./studios/SHOPIFY_STUDIO.md)
  - [Research Studio](./studios/RESEARCH_STUDIO.md)
- Integrations:
  - [Supabase](./integrations/SUPABASE.md)
  - [Shopify](./integrations/SHOPIFY.md)
  - [AI Providers](./integrations/AI_PROVIDERS.md)
- Brand:
  - [Milaene](./brand/MILAENE.md)
- Decisions:
  - [Decision Log](./decisions/DECISION_LOG.md)

> "When documentation and implementation disagree about CURRENT STATE, inspect the code and update the documentation. When implementation conflicts with an explicit TARGET PRODUCT DECISION, do not silently redefine the target — surface the conflict."

## 2026-08-17 Deterministic Mockup Milestone

The first live paid Image job executed its frozen v1 input correctly, but the dual-reference generative edit altered approved Artwork. Exact mockup production therefore no longer treats prompt fidelity as an Artwork authority mechanism.

The new architecture permanently separates **Artwork**, **Product**, **Persona**, and **Image Production**. `image-generation-input-v2` makes Stage A generate a Persona/Product base without Master Artwork pixels and Stage B deterministically composites the original checksummed pixels onto a calibrated `PrintSurface`. The compositor, Product Library contracts, Shopify visual-reference seam, v2 fingerprint, two-stage retry boundary, and review contract exist in code.

**2026-08-17 V2 runtime update:** migration `20260817170000_deterministic_mockup_foundation_v1.sql` was preflighted, applied only to linked project `lggogmvpktedkimbpzix`, and verified with synchronized history, private service-only persistence, unchanged historical v1 rows/counts, and a private `product-profile-references` bucket. Authenticated v2 Prepare/Estimate/Confirm, owner-defined `front_center` calibration, Shopify-reference freezing, local synthetic Stage A, deterministic Stage B, retry-from-stored-base, reload recovery, and checklist review are wired. The no-provider end-to-end harness passes. The old v1 path is explicitly draft-generative and must not be used for artwork-exact output. Real Stage A remains unverified and unauthorized. See [pipeline](./studios/DETERMINISTIC_MOCKUP_PIPELINE.md), [Product Library](./studios/PRODUCT_LIBRARY.md), and [first-job forensics](./studios/FIRST_LIVE_IMAGE_JOB_FORENSICS_2026-08-17.md).

## UX transformation checkpoint — 2026-08-17

- Persona, Design, Product and Image now share the blue-first NexHQ owner design tokens and German owner terminology layer.
- Design Studio opens as an Artwork Library even without a Research/Design mission; Artwork remains independent of Product.
- A read-only Product Library owner route separates verified Shopify products from an honestly unavailable manual-profile persistence shell.
- Image deterministic V2 is the production-primary workflow with a German stepper, visual human-defined four-corner placement, persistent progress, collapsed technical details, durable review and separated previous runs.
- Historical V1 remains available only as a clearly warned generative preview. Business authority, paid confirmation, one-job/one-asset, RLS and provider guards were not changed.
- Remaining historical secondary UI localization is tracked in [[docs/nexhq/UX_DESIGN_SYSTEM.md]].

## Final Studio UX cleanup — 2026-08-17

- Geist Sans is the single operational UI family. The Cormorant display font was removed from the root layout, the legacy display alias now resolves to Geist, and Studio-specific serif declarations were eliminated.
- Image Studio no longer adopts a Design Research report as page identity. Project hints, historical V1 jobs, queue, gallery and inspector are collapsed secondary context; deterministic V2 remains primary.
- Design Studio no longer shows Research mission titles in its dominant breadcrumb or as fallback Artwork names.
- German owner terminology now covers raw statuses, shot names, deep Persona rights/reference dialogs, legacy Image cards and advanced Design labels. Technical identifiers remain available only in technical sections.
- Legacy green/gold interaction emphasis on these Studios was normalized to the NexHQ blue/light-blue/cyan system. No Persona, Artwork, Product, paid-job, compositor, auth or RLS authority changed.

## Product Intelligence milestone — 2026-08-17

Product Library is now a durable production knowledge source rather than a read-only shell. It supports Shopify-authoritative profiles with persistent NexHQ enrichment and independent Manual Product Profiles with private images, construction knowledge and versioned PrintSurfaces. Image V2 can select either authority, freezes `product-visual-input-v2`, and fails closed for incomplete Manual Product truth. Artwork remains independent. No migration, provider call or Shopify mutation occurred.

## Video Studio Foundation V1 — 2026-08-18

Video Studio is no longer placeholder-only. It has independent Persona Video gating, exact Product/Artwork/approved-Image-source lineage, structured direction, versioned fingerprinted input, standalone project/job/asset/review contracts, safe fake orchestration and German owner UX. Migration `20260818003000` is **APPLIED and verified**. No real provider/video/image call occurred. Exact frame-by-frame Artwork fidelity remains unsolved and explicitly requires later tracking/compositing research.

## Persona Video readiness checkpoint — 2026-08-18

Code now provides a dedicated German owner review for Video identity and a separate explicit Video Use approval. Both are bound to the exact current lock/reference fingerprints; Image approval and Brand Cast cannot substitute. Read-only live verification found North African Street Premium at lock v3 with Master + five canonical references, confirmed rights, Image approval true, Brand Cast true, Video readiness false and Video Use approval false. No live Persona row was changed. Additive migration `20260818160000_persona_video_readiness_v1.sql` is **APPLIED** (2026-08-18); manual Video identity review and Video Use approval remain owner actions.

## Artwork display name persistence — 2026-08-19

Owner-facing Artwork naming is durable metadata only. Additive migration `20260818220000_artwork_display_name_v1.sql` is **APPLIED** to linked project `lggogmvpktedkimbpzix` after linked-ref/history/dry-run preflight. Live `design_master_artworks` now has nullable `display_name` (trim, 1–120) and `original_file_name` (trim, 1–255). The existing historical Artwork row is unchanged: ID, design ID, version, checksum, status, and storage path match the pre-apply snapshot; name fields remain `NULL` until the owner renames through the authenticated PATCH path. Rename does not rewrite production identity. No provider call, Shopify/Persona mutation, or automatic name assignment occurred.

## Current state update — Content planning and product source context (2026-08-19)

Image Studio now exposes additive **Basis-Pack**, **Winning Design Expansion**, and **Eigene Auswahl** planning modes. A pack never executes a batch: one selected shot still creates one fingerprinted Prepare/Estimate, one confirmation, one job, one base, one deterministic composite, and one review decision. Pack progress is factual only when exact Artwork version/checksum, Product profile/version/variant, required Brand Model, and shot lineage match.

Product Intelligence now carries a typed Product source context. A read-only Shopify audit found 78 Products and 18 collections; explicit Shopify vendor/tag evidence identified MarketPrint on 70 Products and unresolved source context on 8. Brandsky and Brandcanyon were representable but not present in the inspected evidence. Titles are never used for supplier inference. No Shopify row was changed.

Video fake recovery now separates terminal reviewed runs from the current run and cancels unexecuted awaiting/confirmed jobs when owner input changes. This prevents an old confirmation from visually surviving changed direction while preserving history and the one-job/one-video boundary.

## Current state update — Semantic print placement (2026-08-19)

Image Studio now presents **Druckseite** (`Vorne`, `Hinten`, `Beidseitig`) and Product-aware apparel placement presets before any geometric controls. This is an owner abstraction only: a single-side choice must resolve to an exact existing or explicitly owner-calibrated versioned `PrintSurface`; missing, ambiguous, incompatible, or uncalibrated surfaces fail closed. The normalized four-corner editor remains under **Erweiterte Platzierung · Feinjustierung**.

`Beidseitig` is truthful planning for a front view plus a back view. Current V2 still freezes one shot and one resolved PrintSurface into one fingerprinted job and produces one asset. No batch or two-surface still contract was introduced. New V2 snapshots may add `semanticPlacement`; historical V2 snapshots without it remain parseable and are not reinterpreted.

## Current state update — reusable Product PrintSurfaces (2026-08-19)

A calibrated `PrintSurface` is now reusable **Product knowledge**, never Artwork state. Profile-local surfaces remain backward compatible. Cross-listing reuse requires persisted owner confirmation that named Shopify listings share the same physical blank; supplier, title, or normalized family grouping alone cannot authorize inheritance. Compatible standard variants use normalized geometry only after explicit attestation, while exact-variant surfaces remain isolated.

Image Studio resolves the exact canonical surface owner/profile/version before Prepare. A ready surface shows **Druckfläche bereit** and requires no repeated four-point interaction for a new Artwork. **Feinjustierung** creates a fingerprinted current-job override and does not mutate Product Library truth. `Beidseitig` is a two-entry front/back plan with exact-lineage progress; it creates no jobs automatically and each side remains one job/one asset.


## Current state update — strict Artwork scale lock and simplified Image flow (2026-08-19)

New deterministic prepares use `nexhq-deterministic-compositor-v2` with fingerprinted `CONTAIN_UNIFORM_ASPECT_LOCKED`: approved Artwork is translated and uniformly scaled only, keeps its exact aspect ratio/internal proportions, and leaves natural empty space when the Product PrintSurface has a different shape. Preview and Stage B share the resolver; effective scale/rectangle is persisted in output provenance. Historical v1/v2 snapshots retain their original compositor meaning.

Image Studio now groups the owner journey into **Auswahl, Platzierung, Erstellen, Ergebnis**, distinguishes primary **Social Content Assets** from secondary **Shopify Mockups**, reduces human review to one concise acknowledgement plus Freigeben/Ablehnen, and hides synthetic output and Product-family/variant attestations under technical/advanced disclosure. Authority, confirmation, one-job/one-asset, RLS, and recovery rules are unchanged.

## Current state update — Social Content Engine V1 (2026-08-20)

Image V2 now freezes a provider-neutral `social-creative-direction-v1` alongside the exact single shot. **Social Content** is the broad controlled-variation path; **Shopify Mockups** expose a deliberately small consistent preset set. Scene, location, lighting, camera/framing, composition, subject/product presentation, mood, channel and aspect intent are structured owner choices rather than Research authority or one unbounded prompt. Any change invalidates the active confirmation through the whole-snapshot fingerprint.

Creative presets and the local Social-variation list are planning only: they create zero jobs. Exactly one active direction can flow into one Prepare, one confirmation, one Stage A attempt and one asset. Stage A receives Persona + Product intelligence/references + creative direction and still receives no Master Artwork pixels; Stage B retains strict aspect-locked deterministic Artwork application. No provider runtime was enabled or called by this milestone.

## Current state update — automatic Product placement and stable creative direction (2026-08-20)

Normal Image Studio production no longer contains a separate numbered **Aufnahme** phase: Content Pack / Output-Ziel is the one visible shot selector, while the canonical shot ID remains frozen in the V2 snapshot, fingerprint, job, and history. Creative direction defaults are now resolved synchronously with shot selection, so a shot transition cannot briefly clear the direction or produce a jumping guidance card; asynchronous pack progress never owns selection state.

Routine production also no longer asks the owner to calibrate a `PrintSurface`. Resolution is deterministic and fail-closed: **exact owner/Product surface → persisted verified physical-family surface → versioned `NEXHQ_PRODUCT_TEMPLATE` for a supported standard garment → blocker**. T-Shirt, Hoodie, supported Zip-Hoodie regions, Jogger, and Pants use conservative Product-family templates; unknown/custom Products still require optional advanced Product Library setup. Stage B, strict uniform Artwork scale, one-job/one-asset, BOTH planning, and historical interpretation are unchanged.

## Current state update — final daily Image owner flow (2026-08-20)

**Complex internals, simple owner flow.** Image Studio now exposes only four top-level phases: **Auswahl → Stil & Platzierung → Erstellen → Ergebnis**. A Design Studio handoff immediately supplies its approved Artwork; the owner then chooses Product/color/size, Markenmodel, Social Content or Shopify Mockups, one shot, one style preset, side, and placement. Technical production mode, Product/PrintSurface versions, fingerprints, internal stages, lineage, and synthetic runtime tools remain intact but are collapsed under **Technische Details**.

Social Content keeps Basis-Pack, Winning Design Expansion, and Eigene Auswahl. Shopify Mockups use a deliberately limited Shopify Standard view. Creative details remain optional under **Stil anpassen**. Supported Product placement continues automatically through exact Product truth, verified family truth, or NexHQ templates. Human result review is now one explicit **Freigeben** or **Ablehnen** decision; the durable six review dimensions remain persisted internally. No authority, provider runtime, paid confirmation, deterministic compositor, aspect lock, recovery, or one-job/one-asset rule changed.

## Current state update — final Image QA and real Stage A seam (2026-08-20)

Image Studio can now browse and select any approved durable Artwork directly; an explicit Design handoff still preselects its exact Artwork. Brand Model defaulting runs once instead of restarting when the parent callback changes. Content Pack progress is optional, keyed by stable lineage, silent when unavailable, and cannot reset the selected shot.

Standard NexHQ Product templates now materialize an axis-aligned, non-warped rectangular region. Preview and compositor V2 contain the unchanged Artwork with uniform scale and translation only. The existing OpenAI provider is connected to the deterministic v2 executor: after durable confirmation, one atomically claimed Stage A receives the locked Persona Master + 5/5 reference bytes, frozen Product reference bytes, Product Intelligence, and creative direction — never Artwork input. Stage B persists the base, applies the approved Artwork locally, and creates one review-required private asset. Live execution remains closed while `NEXHQ_IMAGE_PAID_GENERATION_ENABLED=false`.
## Current deterministic V2 print-purity state — 2026-08-20

The first controlled real Image Studio run proved the full paid Stage A/local Stage B seam and revealed one critical defect: a design-bearing Shopify Product reference caused a legacy print to be generated into the Base garment. New Stage A requests now require a completely blank target garment and explicitly prohibit copying any reference graphic/text/logo. A local versioned Base-purity gate blocks suspected contaminated Bases before Stage B, so the approved Artwork remains the only final print authority. New standard T-shirt large-front jobs use a larger, higher, axis-aligned job override without mutating Product truth or historical snapshots.

## Current Image production quality pass — 2026-08-20

New deterministic prepares use `nexhq-deterministic-compositor-v3-fabric-aware-v1`. The approved Artwork remains checksummed and globally aspect-locked; Stage B adds only bounded Base-derived cloth displacement, local luminance/shadow response, fine texture response, and fixed print opacity. Historical v1/v2 snapshots keep their frozen behavior. Full garment UV/depth/occlusion simulation remains explicitly out of scope for this V1.

The real owner flow now exposes stable German states across confirmation, Persona/Product preparation, Base creation, deterministic Artwork application, private persistence, and review while keeping the existing one execution request and atomic claim. Read-only polling cannot execute a provider call. Continuation is offered only when safe, ambiguous outcomes remain fail-closed, and raw diagnostics stay under technical details. Stage A gives exact Persona identity priority over scene novelty, applies shot-specific premium commercial direction, and still receives no Artwork pixels.

## Current Stage-A purity diagnosis — 2026-08-20

Read-only inspection of the latest `BASE_PRINT_ZONE_CONTAMINATED` job proved that its checksummed Stage-A Base was visually blank. The persisted v1 metrics were triggered by beard, skin, and collar features because the broad frozen placement box extended above the usable chest print core. The failed paid job and its v1 evidence remain untouched and are not retryable.

New assessments use `base-print-purity-v2`: the exact frozen placement remains audit/overlay truth, while an inner analysis mask removes boundary anatomy and ordinary garment structure from contamination scoring. Beige, black, and white fold/shadow fixtures pass; obvious central logos/text still fail. Authenticated owners can inspect the exact private Base and frozen region under **Technische Details → Stage-A Basisbild** without receiving a storage path.

## Product Family + MarketPrint placement workflow — 2026-08-20

Product Library now projects one versioned Manual Product Profile as an owner-facing **Product Family** with colors, private blank front/back references, and one family-wide Front/Back placement template. A MarketPrint screenshot with a green printable region is a private calibration asset only: local detection proposes a normalized rectangle, the owner may correct it visually, and the asset is permanently excluded from Stage A.

Image Studio asks for Product Family + color and resolves the exact internal Product Profile/variant, Shopify mapping, blank reference priority, placement-template version, and owner uniform scale/translation behind the owner flow. The approved Artwork remains the only design authority. Basis-Pack, Winning Design Expansion, Eigene Auswahl, Social Content, Shopify Mockups, creative presets, Persona selection, one-job/one-asset, and fabric-aware Stage B are unchanged.
