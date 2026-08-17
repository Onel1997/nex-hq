# NexHQ Master Context

Status: Canonical  
Audience: Human developers + AI coding agents  
Last verified against code: 2026-08-17

This is the canonical entry point for understanding NexHQ. It records both the product direction and the verified implementation baseline. Statements labeled **CURRENT STATE** describe code inspected on the verification date; statements labeled **TARGET STATE** are product decisions and must not be inferred to exist in production.

> **2026-08-17 Image production update:** The later sections contain historical current-state details from the 2026-08-16 Persona milestone. For Image-production authority, the following newer inspected state supersedes any conflicting sentence: Design-owned immutable artwork, typed Shopify/local product context, durable Image projects/jobs/assets/review, deterministic no-paid planning, private output access, reload recovery, and high-fidelity provider preparation are implemented in application code. Migrations `20260817013000` and `20260817030000` were applied on 2026-08-17 to linked project `lggogmvpktedkimbpzix`; live schema/RLS/grants/buckets verified. No paid generation was executed and paid runtime remains default-closed.

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

| Studio | CURRENT STATE | TARGET STATE |
|---|---|---|
| **Persona Studio** | Substantial implementation: Official Brand Face Casting, candidate generation/review, persistent Persona projects, review-bound Identity Lock, controlled explicit image/video/Brand Cast approvals, centralized eligibility, one canonical `brand-model-v1` contract, real Image/Video handoff boundaries, one authorization/workspace guard, and an explicit human legacy-reconciliation path. Durable Persona state remains the only application/domain identity authority. Both Persona Foundation migrations are applied and their live schema/RLS posture is verified. The affected legacy model was reconciled into immutable lock version 3 while preserving version 2, and the owner subsequently completed the audited Reference Rights confirmation. The owner reports the canonical Image selector now showing `North African Street Premium · Lock v3`. Provider-conditioned execution and a durable exact-input Image paid-job boundary are wired and tested with fakes; the new Image migration is unapplied, and live-provider verification, durable workspace membership, general Identity Revision, and full downstream production remain incomplete (`components/persona/`, `lib/persona/`, `app/api/persona/`). | Create a small, persistent, governed Brand Cast reusable by downstream production studios. |
| **Design Studio** | The workspace still has browser editing/handoff transport and autonomous-generation code, but explicit Send-to-Image now creates immutable Design-owned approved artwork identity/version/checksum and a private asset through a protected server boundary. Its additive authority migration is unapplied (`lib/design/master-artwork-authority/`, `components/design/`). | Primarily accept, validate, approve, and manage the final Master Artwork created by the user; it is not the authority that autonomously invents the final fashion design. |
| **Image Studio** | Deterministic no-paid shot planning, canonical Persona re-resolution, durable Design artwork resolution, typed live-Shopify/non-authoritative product context, versioned production projects, exact-input paid jobs, 30-minute confirmation, atomic claim, private assets, review-required state, and reload recovery exist in code. Migrations `20260817013000` and `20260817030000` are applied and live schema verified; paid generation remains default-closed and live provider/E2E execution is unverified (`lib/image/`, `app/api/image/`, `components/image/`). | Become a Campaign Director that creates coherent campaign systems using approved Brand Models, Master Artwork, and real active product/variant context. |
| **Video Studio** | The route remains a coming-later placeholder and generation is intentionally not implemented. A real Persona-owned Video handoff boundary and typed consumer seam now enforce independent canonical Video eligibility and exact lock-version traceability (`app/(dashboard)/agents/video/page.tsx`, `lib/persona/future/video-studio-hooks.ts`, `lib/video/`). | Reuse approved models, products, designs, campaign context, and identity constraints, and require explicit video-use approval. |
| **Shopify Studio** | Shopify operations, catalog, commerce, knowledge, and performance modules exist, but Shopify is not yet the universal product source of truth (`components/shopify/`, `lib/shopify/`, `lib/product-intelligence/`). | Make the real Shopify catalog authoritative for active products, variants, colors, sizes, collections, and availability. |
| **Research Studio** | A substantial Research Studio and Data Sources Center exist with source status/sync concepts and multiple adapters; connector modes vary between live, simulated, cached, unavailable, and coming soon (`components/research/v3/`, `app/api/research/`, `lib/data-source-platform/`). | Support creative, product, market, and later performance intelligence. It is important infrastructure, but not the immediate production bottleneck. |

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
- Image Studio has a minimal Brand Model selector/consumer seam. Its run route and generation route re-authorize and re-resolve the selected snapshot/version/fingerprints; generation validates the immutable six-asset package, downloads only the locked Master bytes server-side, and provides them to the OpenAI edit adapter. Brain assets preserve safe provider/identity lineage. Existing approval and Design handoff state still include client/browser storage. Paid preparation now freezes exact artwork bytes/checksum and product provenance into a dedicated exact-input job, but its migration is unapplied and paid generation remains default-closed pending controlled rollout (`components/image/`, `app/api/image/run/route.ts`, `lib/image/`).
- Product Intelligence's synchronous load path is seed-only. A Shopify-first provider boundary is modeled, but its Shopify catalog provider currently reports unavailable; separate live Shopify and Data Source adapters exist elsewhere (`lib/product-intelligence/load.ts`, `lib/product-intelligence/providers/resolve.ts`, `lib/product-intelligence/providers/shopify-provider.ts`, `lib/shopify/fetch-catalog.ts`, `lib/data-source-platform/adapters/shopify.ts`).
- Milaene's seed catalog correctly treats Zip Hoodies as valid active products. Color and size details are explicitly not a substitute for live Shopify verification (`lib/product-intelligence/milaene.ts`).
- Shopify-derived performance modules exist, but a complete learning loop across sales, conversion, ROAS, CTR, returns, engagement, watch time, saves, and shares is not established by the inspected code (`lib/shopify/performance.ts`).
- The full local test command passes 1,112 tests across 186 suites, including private-owner auth, Persona, durable Design artwork, typed product authority, Image project/job/review, exact lock traceability, workspace isolation, reload/idempotency, and provider-preparation behavior. TypeScript and the production build pass; the build reports existing repository lint warnings. Persona Foundation is applied; the two Design/Image migrations are not. No paid provider, generation, deployment, or full E2E production workflow was invoked (`package.json`).

## 6. Canonical Production Flow

**TARGET STATE:**

1. Establish real workspace, brand, product, provider, and data-source context.
2. Complete Persona Studio: discovery → clearly different candidates → human selection → reference package → identity validation → Identity Lock → explicit Image approval → explicit Video approval → Brand Cast approval.
3. Accept and approve user-created Master Artwork in Design Studio.
4. Combine approved Brand Models, approved Master Artwork, real active Shopify products/variants, and campaign direction in Image Studio.
5. Extend approved campaign context into Video Studio only for Brand Models approved for video use.
6. Publish and operate through Shopify and other approved channels.
7. Ingest real outcomes and feed them back into Research, creative, product, and marketing intelligence.

**CURRENT STATE:** Parts of steps 1–4 exist. Persona supplies a versioned exact-lock Image contract; Design has immutable Master Artwork authority in code; Image can server-resolve live Shopify product/variant context; production projects, exact-input jobs, private assets, and review are durable in code. Browser handoff remains temporary UX transport, not canonical paid truth. The chain is not yet a verified live E2E path because both new migrations are unapplied and provider execution is fake-tested only; Shopify is not authoritative throughout Product Intelligence, Video remains a placeholder, and the outcome-learning loop is partial.

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

1. Persona contracts are wired to Image planning plus a controlled server-side reference/provider seam and to a Video contract seam, but the Image paid-job migration/application and live-provider E2E verification remain incomplete, no real Video studio exists, and Video has not been runtime/E2E verified (`lib/persona/integrations/`, `lib/image/brand-model-production-context.ts`, `lib/video/brand-model-production-context.ts`).
2. Persona's review-provenance and deny-direct-access security migrations are applied and their live schema/RLS/grants are verified. The owner completed the explicit legacy review, creating immutable lock version 3 while preserving version 2. That diagnostic identified missing Master rights; the owner then completed the protected audited rights review manually. The owner reports canonical Image eligibility and the `North African Street Premium · Lock v3` selector handoff working. Generation-time code now revalidates that same exact package and rights before resolving private Master bytes; no confirmation was submitted by automation. Durable workspace membership/RBAC remains unresolved (`supabase/migrations/20260816210000_persona_foundation_milestone_1.sql`, `supabase/migrations/20260816220000_persona_foundation_milestone_2_security.sql`, `lib/persona/security/`, `lib/persona/creation/identity-lock/`).
3. Design contains autonomous final-artwork generation paths that conflict with the target user-authored Master Artwork responsibility (`app/api/design/ai-designer/route.ts`, `app/api/design/generate-master-artwork/route.ts`).
4. Durable Design/Image production authority is implemented but unavailable at runtime until its additive migration is applied; browser/local state still carries temporary presentation and handoff transport (`lib/design/master-artwork-authority/`, `lib/image/production-project/`).
5. Image Studio is substantial but not a verified coherent Campaign Director; several visible actions are incomplete or disabled (`components/image/`).
6. Video Studio is not implemented beyond a placeholder (`app/(dashboard)/agents/video/page.tsx`).
7. Product Intelligence still relies on seed-only loading while its Shopify provider is unavailable, despite separate live Shopify adapters elsewhere (`lib/product-intelligence/`, `lib/shopify/`, `lib/data-source-platform/adapters/shopify.ts`).
8. The Data Sources Center and performance intelligence are partial and must not be represented as complete live outcome learning (`components/research/v3/`, `lib/data-source-platform/`, `lib/shopify/performance.ts`).
9. General application authentication is consistent at the middleware/dashboard boundary, but it is only a private single-owner session gate. Non-Persona domains do not yet have workspace membership or role authorization; Persona remains stronger through its UID allowlist and server-selected workspace. The owner reports the login/session/dashboard path verified, and the Persona RLS changes are applied; full application runtime verification remains pending (`lib/auth/`, `lib/supabase/middleware.ts`, `lib/persona/security/authorization.ts`, `supabase/migrations/`).
10. Foundation parity is uneven: Persona has substantial passing tests and approval gates, while Design/Image lack equivalent verified coverage and completion evidence (`package.json`).

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
