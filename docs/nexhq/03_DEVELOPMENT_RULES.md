# NexHQ Development Rules

Status: Canonical Engineering Policy  
Applies to: Entire NexHQ repository  
Audience: Human developers + AI coding agents  
Last updated: 2026-08-16

## 1. Status Header

This document is the binding engineering policy for NexHQ. It governs product code, APIs, data models, migrations, provider integrations, tests, user interfaces, operational tooling, and engineering documentation.

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative. A deviation from a MUST or MUST NOT requires an explicit, documented decision by the responsible human owner. Convenience, legacy behavior, or an incomplete implementation is not an exception.

Implementation status labels have precise meanings:

- **IMPLEMENTED** — a meaningful code path exists. This does not by itself prove runtime operation.
- **PARTIAL** — useful implementation exists, but the complete product or production contract is not satisfied.
- **PLACEHOLDER** — a shell, type, route, fixture, or UI exists without the required working integration.
- **PLANNED** — target behavior is not implemented in the inspected repository.
- **DEPRECATED** — retained temporarily for compatibility and not a valid foundation for new work.

## 2. Purpose

NexHQ is intended to become a durable AI-powered business operating system. Engineering decisions MUST prioritize, in order appropriate to the task:

- correctness and real business truth;
- durable, well-owned data;
- maintainability and explicit module boundaries;
- testability and observable failure;
- provider replaceability;
- explicit human control over important actions;
- security, authorization, and workspace isolation;
- end-to-end reliability rather than surface-level completeness.

A feature is not complete because its UI looks finished. NexHQ MUST operate as a coherent system of governed studios and shared truth, not as disconnected demos.

## 3. Source-of-Truth Hierarchy

Different questions have different authorities. Do not collapse them into one hierarchy.

### Target product and engineering behavior

Use this order:

1. Explicit approved product decisions and this engineering policy.
2. `docs/nexhq/00_MASTER_CONTEXT.md`.
3. The relevant canonical studio, integration, brand, architecture, or decision document.
4. Task-specific acceptance criteria that do not contradict a higher-level product decision.
5. Existing implementation conventions.

Accidental implementation drift MUST NOT silently redefine the target.

### Current repository implementation

Source code, migrations, tests, configuration, and package scripts are the authority for what the repository currently implements. When documentation disagrees about **CURRENT STATE**, inspect the full path and correct the documentation. A type, route, migration, test, or component proves only its own existence—not an end-to-end capability.

### Deployed and operational state

Only authorized runtime evidence can establish deployed schema, configured providers, live connectivity, data contents, or successful operations. Environment-variable names, adapter classes, migration files, health UIs, and static inspection MUST NOT be presented as proof that a live service is configured or working.

### Business data authority

Use this order unless a domain specification defines a stricter authority:

1. Live authoritative systems for the facts they own, such as Shopify for connected active catalog truth and connected outcome platforms for measured performance.
2. Persisted, explicitly approved NexHQ records, such as Identity Locks, use approvals, Brand Cast membership, Master Artwork, and campaign decisions.
3. Synchronized provider data with source, timestamp, health, and error provenance.
4. Human-confirmed manual data and clearly labeled seed data.
5. Mocks, fixtures, placeholders, browser-local state, process-local state, caches, and inferred values.

Lower levels MUST NOT masquerade as higher levels. If two authorities compete, stop creating additional state, identify the intended owner, and plan migration or deprecation.

## 4. Foundation-First Development

Development SHOULD proceed vertically and foundation-first in this production order:

> Persona Studio → Design Studio → Image Studio → Video Studio → Shopify Studio

Research, provider infrastructure, and intelligence systems support this path, but MUST NOT displace the work required to establish a reliable production flow.

Before moving deeply into the next studio, the previous studio's required domain model, persistence, approvals, service boundaries, handoff contracts, tests, and failure behavior SHOULD be reliable enough to support it. Prefer a complete vertical slice across UI, API, service, repository, schema, and downstream handoff over broad shallow implementation.

Foundation-first does not mean endless polishing. Refine work only when it reduces material risk, resolves a primary-path defect, or unblocks the production workflow.

## 5. Definition of Done

Unless a task is explicitly and honestly scoped to a smaller artifact, a production feature is **DONE** only when every applicable item below is implemented and verified:

- usable UI and interaction flow;
- backend and domain behavior;
- a clear domain model and source of truth;
- durable persistence and reload/reopen behavior;
- boundary validation;
- authentication, authorization, workspace scope, and RLS where applicable;
- actionable loading, empty, disabled, and error states;
- understandable error handling and observability;
- TypeScript correctness;
- meaningful automated tests;
- successful production build;
- database and schema compatibility;
- safe provider behavior and cost controls;
- end-to-end and cross-studio contracts;
- retry, concurrency, and partial-failure handling where applicable;
- no critical placeholder in the primary path;
- no major known defect preventing intended use.

For business-critical state, verification MUST include refresh, browser restart or reopening where relevant, application/server restart, and redeployment-safe persistence—not merely in-session behavior.

The following are never sufficient evidence of DONE on their own:

- a polished UI;
- an API route;
- a migration file;
- types or schemas;
- mock or seed data;
- a passing unit test;
- a successful build;
- static code inspection.

Documentation and completion reports MUST name what was actually verified and what remains unverified.

## 6. Current vs Target State

Every architectural assessment, plan, and substantial documentation update MUST distinguish:

- **CURRENT STATE** — what the repository or authorized runtime evidence actually establishes now.
- **TARGET STATE** — what NexHQ is intentionally supposed to become.

When code and documentation disagree about current implementation, inspect the code and update the current-state documentation. When implementation conflicts with an explicit target product decision, surface the conflict before changing the target. Never rewrite the target merely to legitimize an incomplete or accidental implementation.

Verified current implementation conflicts that new work MUST account for include:

- Official Brand Face selection has process-global state alongside Supabase-backed Persona state.
- Generic Persona CRUD and legacy `Approved` equivalence can bypass or weaken explicit approval paths.
- Persona-to-Image and Persona-to-Video handoff hooks are placeholders; Video Studio is a placeholder route.
- Design Studio includes autonomous AI artwork-generation paths, while the target gives the user ownership of final Master Artwork.
- Design-to-Image handoff and parts of Image state use browser storage rather than durable workflow records.
- Product Intelligence's synchronous path is seed-only and its Shopify provider boundary currently reports unavailable.
- Service-role access, permissive RLS policies, and fallback authorization patterns require production hardening.
- Production-path test coverage is materially stronger in Persona than in later studios.

These are current-state constraints, not permission to preserve them as target architecture.

## 7. Data Durability

Business-critical state MUST survive:

- page refresh;
- browser restart;
- multiple tabs and concurrent clients;
- application and server restart;
- redeployment;
- retry after a recoverable failure.

Module globals, process-local maps, `localStorage`, `sessionStorage`, `window.name`, component state, and in-memory repositories MUST NOT be canonical authority for durable business state. They MAY be used for temporary UI state, caches, tests, or explicitly labeled drafts when loss and staleness are acceptable.

Every persisted domain concept MUST have a clear owner, stable identity, workspace scope where applicable, timestamps, and provenance appropriate to its risk. Important state transitions SHOULD record the actor, source, reason, prior state, resulting state, and relevant operation/job identity.

Do not create competing authorities. When legacy state exists:

1. identify the current readers and writers;
2. name the intended authority;
3. define migration and reconciliation;
4. update callers;
5. verify cutover;
6. deprecate or remove the old path deliberately.

Caches and synchronized projections MUST be invalidatable and MUST expose freshness/source. UI success MUST NOT be shown until the authoritative write succeeds.

## 8. Human Control

High-value, costly, destructive, publishing, or identity-defining actions require explicit human intent. This includes:

- paid AI generation and paid retries;
- official candidate selection;
- Identity Lock and identity revision;
- image-use, video-use, and Brand Cast approval;
- final Master Artwork approval;
- destructive database or storage operations;
- publishing, deployment, or channel activation where applicable.

AI MAY analyze, recommend, rank, score, validate, draft, and prepare changes. AI MUST NOT silently make irreversible product or business decisions.

Important transitions MUST be explicit, scoped to the exact object and action, attributable to an actor, and auditable. A nearby click, page load, previous confirmation, heuristic score, or AI recommendation is not consent. Approval for one capability MUST NOT imply approval for another.

## 9. Paid Provider Safety

Never invoke a paid AI or external provider merely to inspect code, render UI, analyze architecture, populate documentation, open a page, or run unrelated validation.

Every paid attempt—including retry, replacement, expansion, or chained operation—MUST have explicit, current, scoped human intent. Paid flows SHOULD provide, where practical:

- provider/model and operation description;
- estimated cost or maximum exposure;
- an explicit confirmation boundary;
- confirmation expiry and single-use semantics;
- a durable job/operation identity;
- atomic or otherwise race-safe confirmation consumption;
- idempotency and duplicate-charge protection;
- visible status, provenance, request identity, and failure reason;
- safe reconciliation after timeouts or partial failure.

Do not silently fall back to a paid provider, change provider/model, expand asset count, or chain another generation. Configuration MUST default closed when provider safety or authorization cannot be established. Existing cost or confirmation guards MUST NOT be weakened without explicit approval and documented risk review.

Tests MUST use fakes, recordings, or deterministic adapters by default. Live provider tests must be separately gated and explicitly authorized.

## 10. Provider Architecture

NexHQ domain architecture MUST describe capabilities rather than unnecessarily bind product logic to one provider. Persona Discovery and image generation are capabilities; OpenAI, FAL, or another vendor may implement them.

Provider-specific code SHOULD be isolated behind explicit interfaces/adapters. Boundaries SHOULD normalize:

- validated inputs and provider-neutral requests;
- provider results and status models;
- errors, timeouts, cancellation, and rate limits;
- usage and cost metadata;
- model/provider/request provenance;
- capability differences and unsupported states.

Provider SDK types, response shapes, model names, and retry semantics SHOULD NOT leak through domain logic or UI unless the user is intentionally managing that provider. A provider change MUST NOT silently alter domain invariants, approval policy, identity rules, or data ownership.

Fallback behavior must be explicit, safe, observable, and tested. “Configured,” “adapter exists,” and “live” are distinct states.

## 11. Persona Identity Rules

The Persona Studio specification is binding for identity behavior. Preserve these invariants:

1. Discovery and Identity Lock are separate concerns.
2. Discovery should produce genuinely different identities, not styling variants of one face.
3. Human selection determines the official candidate.
4. A Candidate is not automatically a Persona or Brand Model.
5. A Persona is not automatically an approved Brand Model or Brand Cast member.
6. The selected candidate's Master Identity Reference remains the identity anchor.
7. Generated supporting references MUST NOT silently become the Master.
8. Identity evidence, human overrides, rights, and provenance MUST remain visible and auditable.
9. Identity Lock is an explicit, versioned, durable snapshot and MUST NOT be silently replaced or weakened downstream.
10. Identity revision must create deliberate new history rather than mutate locked history in place.
11. Image use, video use, and Brand Cast membership are separate approval decisions.
12. Downstream studios MUST NOT establish competing persistent identity truth.
13. Governed approvals and lock transitions MUST NOT be bypassed through generic CRUD.
14. Archived, unresolved-revision, missing-snapshot, stale-lock, or unapproved identities fail closed.
15. Scene, outfit, product, provider, or campaign changes MUST NOT cause identity substitution or drift.

Durable Persona, Identity Lock, approval, and Brand Cast records must converge on one persistent authority. Process-local Brand Face registries are not acceptable canonical state.

## 12. Downstream Eligibility

An official Brand Model has independent conceptual capabilities:

- Identity Locked;
- Brand Cast Approved;
- Image Use Approved;
- Video Use Approved.

Image Studio MUST require current image eligibility. Video Studio MUST require current video eligibility. Image approval MUST NOT imply video approval, and video approval MUST NOT be required merely for an otherwise valid Brand Model to participate in image workflows. Brand Cast approval does not inherently require video-use approval.

Eligibility SHOULD be resolved by one shared, fail-closed domain service rather than duplicated UI conditions. Downstream handoffs MUST include a versioned identity/approval contract and reject missing, stale, revoked, archived, mismatched, or unauthorized records.

## 13. Design Ownership

For the intended Milaene workflow, the user creates or approves the final fashion artwork. Design Studio SHOULD primarily manage:

- ingestion of user-created artwork;
- validation and production readiness;
- explicit approval of Master Artwork;
- versioning, provenance, and rights;
- durable handoff to production studios.

AI MAY support research, concepts, ideation, critique, validation, and production preparation. It MUST NOT silently replace approved final artwork with an autonomous design or promote generated output to Master Artwork without explicit human approval.

Existing autonomous AI designer and Master Artwork generation paths are **CURRENT/PARTIAL** behavior, not the canonical target. New work must not deepen that conflict without an explicit product decision.

## 14. Image Studio Rules

Image Studio SHOULD evolve into a persistent production and Campaign Director system. Its core unit should be a coherent campaign/project and asset set, not only an isolated one-off prompt.

Image production should combine approved:

- image-eligible Brand Models and locked identity packages;
- Master Artwork;
- real products and variants;
- campaign direction and brand context.

Campaign/project state, selections, generation jobs, asset lineage, approvals, and handoffs MUST become durable and reopenable. Generated assets MUST retain provider/model/request provenance, source inputs, identity lock version, product/variant identity, artwork version, prompt/direction, cost metadata, and review status as applicable.

Image Studio MUST NOT create its own permanent Persona identity, silently use ineligible models, treat browser storage as canonical production state, or present local/mock approval as persisted approval. It SHOULD produce coherent channel-ready sets while preserving individual asset traceability.

## 15. Video Studio Rules

Video Studio MUST reuse established NexHQ truth rather than recreate it. It should consume:

- approved Brand Models with video-use eligibility;
- the canonical locked identity package and version;
- approved product and design context;
- campaign direction and brand context;
- explicit identity constraints and provenance.

Video Studio MUST NOT create a separate Persona identity system, infer video approval from image approval, or substitute a model during generation. Multi-step video jobs require durable state, explicit cost confirmation, retry safety, and visible partial failure.

The current route is a **PLACEHOLDER**. Its existence is not evidence of Video Studio implementation or integration.

## 16. Shopify/Product Truth

When Shopify is connected and designated authoritative, it MUST own active commerce catalog truth, including:

- products and variants;
- colors and sizes;
- collections;
- availability;
- active/inactive and sellable status.

Static catalogs and seed files MAY support development or an explicitly labeled fallback, but MUST NOT permanently compete with reliable Shopify authority. Shopify connectivity in one subsystem does not imply that all product consumers use live Shopify data.

Image and Video production should ultimately operate only against products and variants that exist in the authoritative catalog, with a captured version or timestamp sufficient to explain later changes. Stale or unavailable product data MUST be visible and handled deliberately. Zip Hoodies are a valid Milaene product category and MUST NOT be excluded by stale assumptions.

The current Product Intelligence synchronous loader is seed-only and the local Shopify provider boundary reports unavailable. UI and services using it MUST label that truth accurately.

## 17. Performance Intelligence

Uploaded, generated, or approved content proves that an asset exists; it does not prove performance. Performance learning MUST be based on measured outcomes such as:

- sales and conversion;
- ROAS and CTR;
- returns;
- engagement;
- watch time;
- saves and shares.

Every performance signal MUST preserve provenance: source platform, source record, workspace, asset/product/campaign association, metric definition, measurement window, timestamp, sync status, and relevant attribution limitations.

Do not combine incomparable metrics, infer causation from correlation, or present modeled/estimated performance as measured truth. Corrections and late-arriving events SHOULD be reconcilable. Recommendations SHOULD expose the evidence and confidence behind them.

## 18. Database and Supabase Safety

Do not casually delete tables, drop columns, reset databases, rewrite migration history, destroy production data, or replace real records with fixtures.

Prefer additive and reversible migrations where practical. Before a destructive or narrowing schema change:

1. inspect all readers, writers, jobs, policies, and downstream consumers;
2. identify data volume and impact;
3. define backfill, compatibility, cutover, and rollback;
4. surface irreversible risk;
5. obtain explicit approval;
6. verify deployment state separately from repository state.

Never assume a migration is applied because its SQL file exists. Migrations SHOULD be forward-safe across rolling deployment where applicable, preserve existing data, and make constraints explicit. Multi-stage migrations SHOULD separate expand, backfill, cutover, and contract phases.

Supabase rules:

- Never expose or document service-role keys, API secrets, access tokens, or private credentials.
- Service-role access is privileged infrastructure, not user authorization.
- Browser code MUST NOT receive service-role credentials.
- RLS MUST provide meaningful workspace/user protection where applicable; permissive policies are not production isolation.
- Storage buckets, signed URLs, retention, and object paths MUST follow the same authorization and workspace boundaries as database records.
- Personal and biometric identity material MUST remain private, access-controlled, minimized, and excluded from ordinary logs.
- Memory repositories are acceptable for tests, not production durability.

## 19. Security and Authorization

Do not weaken authentication, authorization, workspace isolation, RLS, approval gates, provider confirmation gates, or secret handling for convenience.

Every protected operation MUST establish both identity and authority. A workspace ID supplied by the client is not authorization. Server code MUST derive or verify workspace membership and enforce object ownership. Authorization MUST be enforced at the server/domain boundary even when UI controls are hidden or disabled.

Use least privilege for database, storage, provider, and operational access. Sensitive fields and URLs SHOULD be returned only when needed and should expire where appropriate. Logs, errors, analytics, fixtures, and screenshots MUST redact credentials, tokens, private prompts/data, signed URLs, and sensitive identity material.

Security-relevant actions SHOULD produce durable audit evidence. Audit records SHOULD be tamper-resistant enough for their risk and MUST NOT be silently treated as complete when best-effort logging fails.

If an existing weakness blocks work, surface it explicitly. Do not normalize the weakness or build new dependencies on it.

## 20. API Engineering

API routes MUST:

- validate and normalize all untrusted inputs at the boundary;
- return consistent structured success and error shapes;
- use appropriate HTTP status codes;
- enforce authentication, workspace scope, object ownership, and authorization where applicable;
- enforce domain invariants independently of UI validation;
- avoid hidden side effects and unconfirmed paid work;
- preserve idempotency where duplicate delivery is realistic;
- expose actionable but non-sensitive failures;
- use explicit timeouts/cancellation for external calls where practical.

Validation SHOULD use Zod or an equivalent runtime schema. Reject unknown or unsafe values when silent coercion could alter business behavior. Generic CRUD MUST NOT mutate governed fields such as Identity Lock or approval state.

API contracts shared across studios SHOULD be versioned or backward-compatible, typed, and tested at producer and consumer boundaries. Pagination, filtering, and ordering MUST be deterministic when records can grow.

## 21. Type Safety

Avoid unnecessary `any`, unsafe casts, non-null assertions, duplicated domain types, stringly typed states, and loosely typed provider responses.

Prefer:

- shared domain types owned by the relevant domain;
- runtime validation at network, database, provider, file, and environment boundaries;
- discriminated unions and explicit state machines;
- exhaustive status handling;
- branded or constrained identifiers where confusion is high risk;
- generated database types where reliable;
- explicit conversion between persistence, provider, and domain models.

TypeScript passing is part of Definition of Done for production work. Type assertions MUST NOT be used to conceal an unvalidated boundary or incompatible contract.

## 22. Testing

Critical workflows require meaningful automated behavioral coverage. Prioritize:

- identity state transitions and locked-history invariants;
- human approval gates and bypass attempts;
- paid generation guards and concurrency;
- provider normalization, errors, and fallback policy;
- persistence and reopen/reload durability;
- authentication, workspace isolation, and RLS assumptions;
- image/video/product eligibility;
- studio handoff contracts;
- retry, idempotency, timeout, and duplicate delivery;
- transaction boundaries, compensation, and failure recovery;
- schema compatibility and migrations where feasible.

Tests SHOULD verify externally meaningful behavior rather than private implementation details. Include negative, unauthorized, stale-state, concurrent, and partial-failure cases—not only the happy path.

Do not delete, skip, loosen, or rewrite tests merely to make a build pass. If a product decision intentionally changes behavior, update tests with the decision and preserve regression coverage for the new invariant.

Default automated tests MUST NOT call paid providers or mutate live production systems. Static test presence does not prove that tests pass, and unit coverage does not prove end-to-end operation.

## 23. Error Handling

Important errors MUST NOT be silently swallowed. Failures involving persistence, paid generation, identity, approvals, product truth, provider calls, authorization, or handoffs must be observable and understandable.

Rules:

- Do not show success when the authoritative write or required audit failed.
- Preserve the original technical cause internally while returning a safe user-facing message.
- Distinguish validation, authorization, conflict, unavailable dependency, timeout, rate limit, and internal failure.
- Include correlation, operation, or job identity for multi-step work where practical.
- Make retryability explicit; do not encourage unsafe blind retries.
- Record provider request IDs and sanitized diagnostics when available.
- Never expose secrets or sensitive identity data in errors.

Expected failures SHOULD have deliberate UI states and recovery actions. Unexpected failures SHOULD be logged with enough structured context to diagnose the workflow without dumping protected data.

## 24. Idempotency and Transactions

Expensive, concurrent, or multi-step operations MUST be designed so accidental retries do not double-charge, duplicate candidates or Personas, corrupt approvals, overwrite locked identity, publish twice, or create inconsistent records.

Use a durable idempotency/operation key scoped to actor, workspace, object, and action where appropriate. Persist state transitions and provider request identity before ambiguity can arise. Retries MUST distinguish “not started,” “in progress,” “succeeded,” “failed retryably,” “failed permanently,” and “outcome unknown” where those states matter.

When a business action spans multiple dependent writes:

- identify partial-failure and concurrency risks;
- use database transactions or RPCs when they provide the correct atomic boundary;
- otherwise use explicit checkpoints, reconciliation, compensation, or resumable jobs;
- enforce uniqueness and state preconditions at the database level where possible;
- make repeated execution safe and test it.

Optimistic UI MUST NOT outrun irreversible or governed state. Best-effort secondary writes must be identified as such and must not create false completion.

## 25. Legacy Code

Legacy behavior is not correct merely because it exists, but it MUST NOT be deleted blindly.

For every replacement:

1. identify current callers, readers, writers, stored data, and external contracts;
2. identify the replacement and its owner;
3. define migration, compatibility, and rollback;
4. migrate required state;
5. update callers and handoffs;
6. verify behavior and data reconciliation;
7. mark the old path **DEPRECATED**;
8. remove it deliberately when no longer needed.

Do not silently create a third source of truth as a bridge. Compatibility adapters must have a named lifetime and must not weaken approval, security, or data-authority rules.

## 26. Refactoring / Module Boundaries

Avoid growing giant multi-responsibility files and cyclic domain dependencies. Domain rules should live in domain/application services, not be duplicated across components and routes. Provider SDKs, persistence details, and UI state should remain behind clear boundaries.

When modifying a very large module, consider extracting cohesive responsibilities if doing so reduces change risk or enables the required behavior. Do not perform broad refactors solely for aesthetics during a focused fix.

Refactors MUST preserve verified behavior unless change is intentional, remain reviewable, and include tests around moved invariants. Prefer small modules with explicit inputs/outputs over hidden globals. New dependencies require a concrete need, compatibility/security review, and clear ownership; do not add a package for trivial functionality.

For Next.js work, inspect the relevant installed documentation under `node_modules/next/dist/docs/` before relying on remembered APIs or conventions. The repository's installed version is authoritative.

## 27. UI/UX Integrity

NexHQ should feel like one operating system. UI MUST clearly communicate:

- live, synchronized, manual, seed, mock, inferred, and unavailable data;
- loading, empty, stale, disabled, partial, and error states;
- approval and eligibility status;
- generation/provider/job status and cost boundary;
- persisted versus unsaved/local state;
- the reason an action is disabled;
- whether an operation is reversible or destructive.

Do not ship controls that appear functional but only manipulate fake or local state without disclosure. Do not use optimistic success for governed, costly, or durable operations until authoritative outcome is known.

Important actions SHOULD have clear confirmation copy that names the object and consequence. Interfaces SHOULD be keyboard accessible, use semantic controls, preserve focus, expose useful labels, and meet reasonable contrast expectations. Accessibility regressions are product defects, not cosmetic issues.

## 28. Documentation Rules

Before architectural or product-level work, read `docs/nexhq/00_MASTER_CONTEXT.md`, then the relevant studio or integration specification, repository instructions, and actual code.

After substantial implementation, update the relevant documentation when verified **CURRENT STATE** changes. Do not rewrite **TARGET STATE** to match incomplete implementation. Use **IMPLEMENTED**, **PARTIAL**, **PLACEHOLDER**, **PLANNED**, and **DEPRECATED** where useful.

Documentation MUST:

- distinguish code inspection from runtime verification;
- name authoritative paths without implying they ran;
- record significant product/architecture decisions in the appropriate canonical location;
- identify mocks, seeds, provider status, and known gaps honestly;
- avoid secrets, tokens, private credentials, or durable signed URLs;
- avoid declaring applied migrations, live integrations, or production readiness without evidence.

When documentation conflicts, do not copy the inconsistency. Resolve which document owns the statement and update only with appropriate scope and authority.

## 29. AI Coding Agent Workflow

### Before substantial implementation

1. Read `AGENTS.md` and all applicable repository instructions.
2. Read `docs/nexhq/00_MASTER_CONTEXT.md`.
3. Read the relevant studio/integration specification and decision records.
4. Inspect the actual UI, API, service, domain, repository, and provider path.
5. Inspect existing tests and package scripts.
6. Inspect relevant migrations, generated types, storage contracts, and authorization rules.
7. For Next.js changes, read the relevant installed guide under `node_modules/next/dist/docs/`.
8. Identify the current/target gap, risks, data authority, and paid/destructive boundaries.
9. Make the smallest coherent plan with goal, scope, non-goals, and acceptance criteria.

### During implementation

- stay within the requested scope;
- respect uncommitted user work;
- avoid unrelated rewrites and formatting noise;
- preserve working behavior unless intentionally replacing it;
- enforce domain rules server-side, not only in UI;
- do not invoke paid providers without explicit permission and confirmation;
- do not run destructive operations without explicit permission and a reviewed plan;
- do not expose secrets or private data;
- do not silently change product decisions, providers, prompts affecting identity, cost behavior, or source-of-truth ownership;
- make partial failure, retries, and durable state explicit.

### After implementation

1. Inspect the complete diff for scope, accidental changes, secret leakage, and policy violations.
2. Run only appropriate, authorized, non-paid validation.
3. Verify the full affected path to the extent possible.
4. Report every file changed.
5. Report tests, lint, typecheck, build, or manual validation actually performed.
6. Report what was not run or could not be verified.
7. Report migrations/schema assumptions separately from applied runtime state.
8. Report remaining gaps, risks, and follow-up work honestly.

An agent MUST stop and surface a decision when the task requires changing a foundational product decision, weakening a safety gate, destroying data, invoking unapproved paid work, or choosing between unresolved authorities.

## 30. Change Management

Prefer complete vertical fixes over broad speculative rewrites. Every task SHOULD define:

- a clear goal;
- in-scope files/systems;
- explicit non-goals;
- acceptance criteria;
- data and migration impact;
- security/provider/cost impact;
- validation plan;
- rollback or recovery where risk warrants it.

Keep changes reviewable and minimize unrelated noise. Separate mechanical refactors from behavior changes when practical. Backward compatibility SHOULD be preserved unless an intentional breaking change includes updated callers, migration, and communication.

If a task reveals a foundational conflict, pause that part of the work and surface the choice rather than assuming. Urgency is not permission to bypass authorization, durability, or provider safety.

## 31. Prohibited Behaviors

The following are prohibited unless an explicit, authorized exception is documented where an exception is technically and ethically valid:

- presenting mocks, fixtures, seeds, caches, inferred values, or local state as live business truth;
- using browser or process-local state as canonical durable business authority;
- creating competing sources of truth without a migration/deprecation plan;
- bypassing human selection, Identity Lock, approval, publishing, destructive-action, or paid-provider gates;
- silently changing providers, models, paid fallback, asset count, or chained operations;
- allowing downstream studios to redefine locked Persona identity;
- requiring video approval for an image-only eligible Brand Model;
- treating uploaded content as evidence of performance;
- treating service-role access as user authorization;
- weakening authentication, workspace isolation, RLS, secret handling, or tests for convenience;
- exposing secrets, access tokens, service-role keys, private credentials, biometric data, or signed URLs;
- running destructive migrations, resets, production writes, external syncs, or live paid tests without explicit permission;
- rewriting migration history or replacing real records with fixtures;
- swallowing critical failures or showing success after failed persistence;
- unsafe retries that can duplicate charges, records, approvals, or publishing;
- mutating governed approval/lock fields through generic CRUD;
- deleting legacy systems before consumers and data are migrated;
- broad unrelated rewrites during focused work;
- claiming runtime state from static inspection;
- reporting “done,” “production-ready,” “fully integrated,” or “working end-to-end” without relevant evidence.

## 32. Completion Reporting Checklist

Every substantial completion report MUST answer:

- **Goal and scope:** What was requested, and what was intentionally not changed?
- **Files changed:** Which files were added, modified, renamed, or removed?
- **Behavior:** What current behavior changed, and which target requirement does it satisfy?
- **Data authority:** Which system owns the affected truth? Were local, seed, or legacy paths involved?
- **Durability:** What survives refresh, restart, redeployment, retry, and reopening?
- **Human control:** Which approvals or confirmations apply, and were any gates changed?
- **Provider/cost:** Were providers invoked? If not, say so. If yes, identify explicit authorization and safeguards.
- **Security:** What authentication, authorization, workspace, RLS, storage, and secret-handling boundaries were checked?
- **Schema:** Which migrations or data contracts changed? Was live application state verified separately?
- **Validation:** Which tests, lint, typecheck, build, and manual/E2E checks actually ran, with results?
- **Not verified:** What was not run, unavailable, or established only by static inspection?
- **Known gaps:** What remains partial, placeholder, risky, or blocked?
- **Completion claim:** Does the evidence support the exact claim being made?

Never substitute confidence for evidence. A successful build cannot prove business correctness; a migration file cannot prove deployed schema; a UI cannot prove persistence; and static inspection cannot verify runtime services.
