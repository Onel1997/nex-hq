# Persona Studio

Status: Canonical Studio Specification  
Studio: Persona Studio  
Current workspace: Milaene  
Last verified against code and controlled read-only live data: 2026-08-18  
Implementation status: **PARTIAL — substantial lifecycle implemented in code; Persona Video readiness migration APPLIED; manual Video approval pending**

This specification uses the following labels:

- **IMPLEMENTED** — a meaningful code path exists. If it depends on Supabase or a provider, runtime operation is not implied.
- **PARTIAL** — useful implementation exists, but the full product contract or production path is incomplete.
- **PLACEHOLDER** — a contract, type, route, or UI shell exists without a working integration.
- **PLANNED** — target product behavior not implemented in the inspected repository.
- **DEPRECATED** — retained compatibility behavior that should not define the future product.

Unless stated otherwise, every current-state capability below is **implemented in code; runtime state is not implied**. The latest baseline full local suite passed 1,112 tests across 186 suites; TypeScript and the production build passed. The owner reports completing legacy reconciliation and the protected Reference Rights confirmation, with Image Studio now listing `North African Street Premium · Lock v3`. A prior controlled query verified lock version 3, its linked review, and preserved version 2. No rights decision was simulated or submitted by code.

## 1. Status Header

Persona Studio has the most developed governed lifecycle among the NexHQ production studios. Candidate discovery, human selection, Draft Persona conversion, a Master Identity Reference, controlled reference packages, identity checks, immutable lock snapshots, separate use approvals, one versioned downstream contract, real Image/Video handoff boundaries, an actor/workspace authorization boundary, and a focused human legacy-reconciliation path all exist in code. The Supabase-backed Persona lifecycle is the canonical identity authority: generic CRUD rejects governed fields, eligibility derives from explicit durable approvals plus a validated lock snapshot, and process-local Brand Face state cannot grant production use. Both Persona Foundation migrations and the Persona Video readiness migration (`20260818160000`) are applied and live schema/RLS/grants/RPCs verified. Persona Studio remains **PARTIAL** because the production allowlist is not durable workspace membership/RBAC, no general Identity Revision exists, real Image/Video provider validation is absent, and the owner has not yet completed the manual Video identity review and Video Use approval for the live Brand Model.

Primary implementation roots:

- Route: `app/(dashboard)/agents/persona/page.tsx`
- UI: `components/persona/`
- APIs: `app/api/persona/`
- Domain and services: `lib/persona/`
- Official Brand Face layer: `lib/brand-face-selection/`
- Persistence schema: `supabase/migrations/*persona*`

## 2. Purpose

**TARGET STATE:** Persona Studio is NexHQ's identity and Brand Cast system. It exists to create, validate, lock, approve, persist, and reuse stable Brand Models—not to generate unrelated AI people for each campaign.

For Milaene, the target is approximately three permanent premium Brand Models. They should become recognizable recurring brand faces usable across Image Studio, Video Studio, campaigns, product and lifestyle imagery, social content, and Shopify assets.

**CURRENT STATE:** The code uses overlapping terms—`Persona`, `Brand Model`, `Official Brand Face`, and `Brand Cast member`. The Supabase-backed Persona lifecycle is the canonical application/domain identity authority. The process-local Official Brand Face registry remains only as deprecated temporary UI/session compatibility state; it no longer establishes canonical membership or downstream eligibility (`lib/persona/domain/brand-model-contract.ts`, `lib/persona/creation/use-approvals/eligibility.ts`, `lib/brand-face-selection/store.ts`).

## 3. Persona Studio's Role in NexHQ

Persona Studio owns identity selection and identity governance. It must answer two different questions:

1. **Discovery:** Which person should become a Brand Model?
2. **Identity Lock:** How is that exact selected person preserved?

Downstream studios may consume approved identity truth, but must not create competing permanent identities or reinterpret eligibility. Persona Studio is also responsible for the human approvals that authorize image use, video use, and Brand Cast membership.

The studio currently also hosts supporting libraries for locations, camera presets, poses, Brand Looks, outfits, and reference assets (`lib/persona/domain/types.ts`, `lib/persona/services/persona-service.ts`). Those libraries support production consistency, but they are not substitutes for the identity lifecycle.

## 4. Core Domain Concepts

| Concept | Meaning | Current implementation |
|---|---|---|
| **Brand/casting direction** | The human and brand constraints for a casting run. | **IMPLEMENTED:** creation-project fields and Milaene Brand Archetype/Identity DNA mapping (`lib/persona/domain/creation-types.ts`, `lib/brand-face-selection/creation-project-mapper.ts`). |
| **Official Brand Face selection project** | A Milaene archetype-specific selection state machine. | **PARTIAL:** rich types and pure workflow functions remain process-local for temporary session state, but they are explicitly non-authoritative (`lib/brand-face-selection/`). |
| **Persona creation project** | Durable casting run with provider, stage, budget, candidate count, and direction. | **IMPLEMENTED:** Supabase-backed repository path (`lib/persona/creation/creation-service.ts`, `lib/persona/creation/supabase-creation-repository.ts`). |
| **Discovery attempt** | One A/B/C/D slot attempt with provider, run, novelty evidence, result, and cost metadata. | **IMPLEMENTED:** domain/repository logic and migration (`lib/persona/creation/discovery/`, `supabase/migrations/20260807154948_persona_discovery_attempts_phase_2_2a.sql`). |
| **Candidate** | An identity option under review; not yet a Brand Model. | **IMPLEMENTED:** status, review fields, assets, lineage, costs, and selection metadata (`PersonaCandidate` in `lib/persona/domain/creation-types.ts`). |
| **Draft Persona** | Persistent Persona created only after a selected candidate is converted. | **IMPLEMENTED:** idempotent conversion sets approvals false and retains source lineage (`convertCandidateToPersona` in `lib/persona/creation/creation-service.ts`). |
| **Master Identity Reference** | Original selected candidate portrait that anchors identity. | **IMPLEMENTED:** marked, primary, linked without duplicating the source file, and protected from replacement/deletion (`lib/persona/creation/master-identity-reference.ts`). |
| **Reference Package** | Controlled five-angle facial identity evidence around the Master. | **IMPLEMENTED:** front, both three-quarter angles, and both profiles, with sessions, attempts, review, provenance, and reconciliation (`lib/persona/creation/reference-package/`). |
| **Identity validation** | Machine evidence plus deliberate human review of identity, angle, and quality. | **PARTIAL:** local embedding/orientation checks and manual checklists exist; no automated video validation pipeline exists. |
| **Identity Lock** | Immutable versioned snapshot of Master, canonical references, checksums, provenance, fingerprint, and the qualifying human review. | **IMPLEMENTED / LEGACY RECONCILIATION EXECUTED:** fail-closed service, snapshot repository, diagnostic, and explicit current owner reconciliation preserved historical version 2 and created current version 3 from an exact-package review (`lib/persona/creation/identity-lock/`). |
| **Use approvals** | Separate permission for Image Studio and Video Studio. | **IMPLEMENTED:** separate controlled operations, confirmation, timestamps, actor metadata, audit events, and centralized eligibility; generic CRUD rejects these governed fields (`lib/persona/creation/use-approvals/`, `lib/persona/domain/governed-fields.ts`). |
| **Brand Cast approval** | Explicit official reusable-roster membership. | **IMPLEMENTED in application/domain code:** only the explicit durable field establishes membership; legacy `Approved` status and process-local state do not grant it. The schema/RLS posture is verified; manual application runtime verification remains outstanding. |
| **Versioned Brand Model contract** | Persona-owned read model for downstream production. | **IMPLEMENTED IN CODE:** one Zod-validated `brand-model-v1` contract carries exact lock/ref-package identity, safe reference descriptors, provenance, approvals, independent eligibility, and audit trace; Image/Video handoffs enforce it (`lib/persona/domain/brand-model-contract.ts`, `lib/persona/integrations/`). |

## 5. Canonical Lifecycle

**TARGET STATE:**

> Brand/casting direction → Discovery → four clearly different candidates → human selection → Draft Persona → Master Identity Reference → controlled Reference Package → identity validation → Identity Lock → image-use approval → video-use approval → Brand Cast approval → reusable Brand Model

| Stage | Required product meaning | Current status |
|---|---|---|
| Casting direction | Establish the brief without declaring an identity. | **IMPLEMENTED**, including Milaene archetype-derived projects. |
| Discovery | Explore identities with controlled paid generation or manual upload. | **IMPLEMENTED** in code. |
| Four-candidate board | Present four current-run A/B/C/D identities for comparison. | **IMPLEMENTED/PARTIAL:** the active pool is four-of-four and a complete board requires four; partial boards can still be returned when attempts/budget are exhausted. |
| Human selection | Choose one official candidate per creation project. | **IMPLEMENTED:** one-selected-candidate constraints exist in service and migration. |
| Draft Persona | Persist the selection without approving it. | **IMPLEMENTED.** |
| Master Identity Reference | Preserve the original selected face as the anchor. | **IMPLEMENTED.** |
| Reference Package | Build controlled supporting angles from the Master. | **IMPLEMENTED** through an OpenAI image-edit path; manual references also exist in older/parallel flow. |
| Identity validation | Confirm same person, correct angles, quality, anatomy, and intended suitability. | **PARTIAL:** strong facial/angle logic and manual review exist; broader commercial-quality and video validation remain human/manual. |
| Identity Lock | Freeze a versioned canonical identity package. | **IMPLEMENTED.** |
| Image approval | Explicitly authorize image use. | **IMPLEMENTED** through a dedicated operation; generic Persona CRUD cannot set it. |
| Video approval | Explicitly authorize video use after `video_identity_ready`. | **IMPLEMENTED** as a gate; the readiness flag comes from manual checklist review, not an automated video workflow. |
| Brand Cast approval | Explicitly add to reusable roster. | **IMPLEMENTED in application/domain code:** explicit durable approval is required and legacy status is not equivalent. |
| Downstream reuse | Supply durable identity package to Image/Video Studio. | **PARTIAL:** real gated/versioned contract boundaries exist; Image has a planning/audit consumer seam, while provider reference use, Video production, and runtime E2E verification remain incomplete. |

Discovery and Identity Lock are intentionally separate. Selection alone neither starts Identity Lock nor approves downstream use (`updateCandidateReview` and `convertCandidateToPersona` in `lib/persona/creation/creation-service.ts`).

## 6. Discovery

### Target behavior

Discovery answers: **“Which person should become a Brand Model?”** It should explore different identities, show four meaningful alternatives together, and leave the final choice to the user. It must remain conceptually provider-agnostic and cost-controlled.

### Current implementation

**IMPLEMENTED:**

- The current casting funnel uses A1 Discovery: four candidates × one front portrait. A2 validation can expand selected candidates with missing angles (`lib/persona/creation/casting-funnel.ts`).
- `DEFAULT_CANDIDATE_COUNT` is four; the active casting pool generates and displays all four rather than hiding candidates behind ranking (`lib/persona/domain/creation-types.ts`, `lib/persona/creation/candidate-intelligence/casting-pool.ts`).
- Current-run board construction is restricted to A/B/C/D attempts belonging to the same project and generation run (`lib/persona/creation/discovery/board-final-slots.ts`).
- Creation projects persist direction, intended use, provider mode, quality mode, estimates, actual costs, confirmation metadata, and lifecycle status (`PersonaCreationProject` in `lib/persona/domain/creation-types.ts`).
- Manual candidate slots and manual candidate asset upload are supported (`ensureManualCandidateSlots`, `uploadManualCandidateAsset` in `lib/persona/creation/creation-service.ts`).
- Novelty-blocked/failed candidates are prevented from selection and their signed previews are withheld (`app/api/persona/candidates/[id]/route.ts`).
- The Official Brand Face UI maps an archetype and Identity DNA into a persistent Persona creation project, then uses the Persona API for generation (`components/persona/official-brand-face-casting-view.tsx`, `lib/brand-face-selection/creation-project-mapper.ts`).

**PARTIAL:** A complete board reports ready only at four cards, but the API/data model also supports partial completion. Product UX must distinguish “four candidates ready for selection” from “partial run requiring action”; it must not silently treat fewer than four as the intended discovery outcome.

## 7. Candidate Diversity

### Target standard

Four candidates must represent visibly different people. Clothing, background, pose, or a minor hairstyle change is not sufficient identity diversity.

### Current implementation

**IMPLEMENTED:** The repository applies several layers:

1. **Pre-provider identity blueprints:** A/B/C/D slots sample different face geometry and high-leverage traits; cross-slot validation rejects duplicate anatomy fingerprints and overlapping feature clusters before paid generation (`lib/persona/identity-blueprints/`, `lib/persona/creation/discovery/preflight-diversity.ts`).
2. **Prompt/recipe diversity:** slot-specific casting recipes, variation fingerprints, and identity-diversity audits attempt to separate facial identity rather than only styling (`lib/persona/creation/candidate-intelligence/identity-diversity.ts`, `visual-difference.ts`).
3. **Generated-face novelty:** checksums, storage keys, perceptual duplicate checks, identity fingerprints, and local 128-dimensional face embeddings protect against same-run and historical reuse (`lib/persona/face-novelty-memory/`).
4. **Replacement attempts:** blocked slots can receive separately confirmed novelty-replacement generation, with durable job/checkpoint handling (`lib/persona/creation/novelty-replacement*.ts`).
5. **Board visibility:** only allowed current-run attempts become selectable final cards (`lib/persona/creation/discovery/board-final-slots.ts`, `lib/persona/face-novelty-memory/board-visibility.ts`).

**PARTIAL / important limitation:**

- Face similarity reduces duplicates but does not prove that four faces are commercially or perceptually “clearly different.” Thresholds can create false positives and false negatives (`lib/persona/face-novelty-memory/local-face-embedding-evaluator.ts`). Human review remains authoritative.
- Candidate quality scores are explicitly rule-based brief-fit and technical-completeness heuristics. Visual casting evaluation defaults to `not_performed`; enabling it currently resolves to a fake evaluator rather than a live vision adapter (`lib/persona/creation/candidate-intelligence/quality-score.ts`, `visual-evaluator.ts`). These scores must not be described as measured attractiveness, realism, or commercial image quality.
- Many current casting profiles encode Milaene/archetype-specific age, appearance, grooming, and styling directions. They are current casting configuration, not universal Persona Studio truth (`lib/persona/creation/discovery/diversity-profiles.ts`, `lib/persona/identity-blueprints/`, `lib/brand-archetypes/`). Subjective choices must remain versioned and scoped to an explicit casting brief.

## 8. Candidate Review and Selection

**IMPLEMENTED:**

- Candidate states include ready, shortlisted, selected, rejected, failed, manual-reference, and novelty failure states (`CANDIDATE_STATUSES` in `lib/persona/domain/creation-types.ts`).
- Review captures user rating, versioned notes, rejection reason, brand-fit fields, identity/realism/video suitability metadata, and technical review text (`updateCandidateReview` in `lib/persona/creation/creation-service.ts`).
- A user can shortlist, reject, restore, or select. Selection is blocked for rejected, novelty-blocked, novelty-failed, or unattested paid debug candidates.
- Only one candidate may be selected per creation project. The service checks it and the database has a partial unique index (`supabase/migrations/20260719220000_persona_studio_phase_1_2_candidate_workflow.sql`).
- Selection records `selected_at`, marks the project selected, logs an audit event, and promotes historical face protection when persisted.
- Ranking may recommend a candidate based on brief-fit heuristics, but the actual `selected` transition requires user action (`components/persona/candidate-board.tsx`, `lib/persona/creation/candidate-intelligence/casting-pool.ts`).

**Invariant:** Human selection determines the official candidate. A recommendation, high score, shortlist, or generated asset must never perform that transition automatically.

## 9. Draft Persona Creation

**IMPLEMENTED:** `convertCandidateToPersona` accepts only a selected candidate and is idempotent (`lib/persona/creation/creation-service.ts`). It:

- creates a Persona with status `Draft`;
- persists creation-project and candidate lineage;
- copies identity direction into canonical, immutable, flexible, styling, and prohibited-change fields;
- initializes Identity Lock as `collecting_references`;
- sets image identity, video identity, image use, video use, and Brand Cast approval to false;
- links/copies candidate assets into the reference library;
- establishes the primary reference and Master Identity Reference when a suitable portrait exists;
- records audit events and historical novelty protection.

**PARTIAL:** Persona/library CRUD can also create a Persona directly (`POST /api/persona`) without the casting/selection lineage. That remains useful for manual workflows but is not equivalent to a selected and validated Brand Model. Generic create/update schemas are strict, omit governed fields, and the service also rejects runtime attempts to set approval, readiness, or lock fields (`lib/persona/validation/schemas.ts`, `lib/persona/domain/governed-fields.ts`, `lib/persona/services/persona-service.ts`).

## 10. Master Identity Reference

**IMPLEMENTED:** The Master Identity Reference is the original selected candidate portrait, identified through versioned metadata in the reference asset's notes (`lib/persona/creation/master-identity-reference.ts`).

Current guarantees in application code:

- the selected candidate's existing private storage object is reused rather than regenerated or duplicated;
- the Master is marked primary and associated with candidate, candidate asset, creation project, and original provider;
- linking is idempotent and attempts to heal missing metadata on re-entry;
- generated Reference Package angles cannot become the Master;
- the Master storage path, marker metadata, and primary status cannot be silently replaced;
- the Master cannot be deleted;
- conversion does not auto-approve it, confirm rights, lock identity, or approve use.

**PARTIAL:** “Immutable” is enforced primarily in service code and notes metadata, not as a database-level immutable object type. Its storage path may remain under the candidate-creation prefix because the original object is intentionally reused (`lib/persona/creation/candidate-storage.ts`).

## 11. Reference Package

**IMPLEMENTED:** The controlled Reference Package uses five facial identity slots:

1. front;
2. three-quarter left;
3. three-quarter right;
4. left profile;
5. right profile.

The Master remains separate from these supporting references (`lib/persona/creation/reference-package/slots.ts`).

The implemented code path:

- prepares a durable cost estimate/session without calling a provider;
- requires a confirmation token plus `costConfirmed` before generation;
- uses OpenAI image editing conditioned on Master image bytes and forbids text-only fallback;
- stores each attempt, provider request ID, cost estimate, generated asset, identity distance/similarity, angle evidence, and errors;
- extracts local face embeddings and orientation from actual generated bytes;
- requires both acceptable identity evidence and correct angle direction for normal acceptance;
- supports manual review, angle recomputation, angle reassignment, controlled inverted-direction fallback, deterministic mirrored derivation, and replacement of an accepted reference without immediately removing the incumbent;
- reconciles attempt history into one current coverage state per slot;
- protects accepted coverage and locked identity assets from casual deletion or mutation;
- never auto-locks identity or auto-approves a Persona (`lib/persona/creation/reference-package/`, `app/api/persona/[id]/reference-package/route.ts`).

**Human mismatch override:** A machine `identity_mismatch` can become usable only after the user compares it with the Master and explicitly confirms an override. The machine evidence remains unchanged, and provenance is recorded as `human_mismatch_override` (`lib/persona/creation/reference-package/approve-human-identity-override.ts`). This is a high-risk exception and must remain explicit, auditable, and visible in the lock snapshot.

**Current inconsistency:** The older candidate-level `requestStageBReferencePackage` path still reports automatic Stage B expansion as unsupported and directs users to manual references, while the newer post-conversion Persona Reference Package supports OpenAI Master-conditioned image edits (`lib/persona/creation/creation-service.ts`, `lib/persona/creation/quality-modes.ts`, `lib/persona/creation/reference-package/service.ts`). The product should expose one canonical lifecycle and terminology.

**Paid-safety limitation:** Reference Package confirmation is less strict than Discovery confirmation: it checks a session token and boolean cost confirmation, but does not use the full discovery attestation/timestamp/TTL/estimate-mutation guard. Some local review actions also interpret an omitted confirmation as true (`app/api/persona/[id]/reference-package/route.ts`). This must be hardened before production completion.

## 12. Identity Validation

Identity validation is not one score. Current code contains three separate mechanisms:

### A. Per-reference identity and angle evidence — IMPLEMENTED

- local face embeddings compare each generated angle to the Master;
- decisions are `identity_match`, `identity_warning`, `identity_mismatch`, or `evaluation_failed`;
- actual-image landmark orientation validates the requested camera angle;
- warning/mismatch paths require human handling rather than silent acceptance (`lib/persona/creation/reference-package/identity-consistency.ts`, `angle-direction.ts`).

### B. Reference Package human review — IMPLEMENTED

Users approve/reject assets, compare with the Master, reassign angles, and resolve replacement candidates in the Persona detail UI (`components/persona/persona-studio.tsx`). Reconciled state, not the mere existence of attempts, determines package readiness.

### C. Persona identity checklist — PARTIAL

The persisted checklist includes same-person consistency, face structure, skin tone, body proportions, anatomy, age, eye color, hairline, artifacts, hands, image suitability, and video suitability (`IDENTITY_REVIEW_CHECK_KEYS` in `lib/persona/domain/creation-types.ts`). `submitIdentityReview` now derives the lock/image quality gate independently from video suitability: all identity and image checks must pass for Identity Lock/image readiness, while `video_identity_ready` additionally requires the video check (`lib/persona/creation/identity-review-quality-gate.ts`, `lib/persona/creation/creation-service.ts`).

Limitations:

- The API describes this checklist as manual, with no AI verification in V1 (`app/api/persona/[id]/identity-review/route.ts`).
- There is no automated Video identity validation pipeline. `video_identity_ready` is only a current projection of the separate human Video review bound to the exact Identity Lock; the old pre-lock suitability checkbox is advisory/historical and cannot grant Video authority.
- Image and video readiness are now separate derivations. A Persona can pass the Identity Lock/image gate while video suitability remains unapproved; this does not grant video use.
- General “visual casting evaluation” is disabled by default and is not evidence of realism or commercial quality.

## 13. Identity Lock

**IMPLEMENTED:** Identity Lock is a fail-closed, explicit, provider-free operation (`lib/persona/creation/identity-lock/identity-lock-service.ts`).

Preconditions include:

- explicit `confirmIdentityLock: true`;
- a valid immutable Master Identity Reference;
- reconciled 5/5 Reference Package coverage;
- the latest persisted manual identity review passing every required identity/image check;
- no unresolved review, wrong camera direction, missing slot, unapproved warning, mismatch, rejection, or pending replacement;
- a complete canonical asset snapshot.

The lock persists:

- Master asset ID and checksum;
- all five canonical asset IDs and checksums;
- effective slots and reference provenance;
- machine/human identity-source confidence;
- source candidate and creation project;
- lock version, time, actor, and policy version;
- qualifying review ID, time, and actor;
- a deterministic Reference Package fingerprint;
- provenance counts (`lib/persona/creation/identity-lock/types.ts`, `fingerprint.ts`, `provenance.ts`).

The service is idempotent and can recover a partial write where the snapshot exists but the Persona update failed. It sets `identity_lock_status=approved`, records `identity_locked_at`, and preserves readiness established by the qualifying review. Locking cannot manufacture evidence that review occurred. Locked Master/canonical assets cannot be modified or deleted through the Persona service.

**PARTIAL:** The error message instructs users to create an Identity Revision, but no complete Identity Revision/unlock/re-lock workflow was found. The snapshot is intended to be immutable, yet the operational path for deliberate future identity revision is missing.

**CURRENT LEGACY RECOVERY STATE:** Identity Lock requires a persisted review to pass the identity/image quality gate and records that review's exact provenance in the immutable snapshot. The additive migration `20260816210000_persona_foundation_milestone_1.sql` is applied. Existing legacy snapshots without an exact linked review ID and timestamp still fail closed for locked Brand Model resolution. The live read-only diagnostic found one affected Milaene record: `North African Street Premium`, lock version 2, with no qualifying persisted review candidate.

The focused recovery flow is now implemented (`legacy-reconciliation-service.ts`, `/api/persona/:id/identity-reconciliation`, `IdentityLockPanel`):

1. the authorized owner is shown the immutable Master and historical five-slot package plus the missing-provenance warning;
2. canonical Reference Package validation must still pass and the current asset IDs, checksums, roles, effective slots, provenance, Master, and package version must exactly match version 2;
3. rejection persists a present-tense, explicitly labeled `legacy_identity_reconciliation` review and creates no lock;
4. acceptance requires every current identity/image confirmation, persists the authenticated actor and actual current review timestamp, and creates version 3 with that exact review ID/time/actor;
5. version 2 is not edited, approvals are not fabricated, and existing Image/Brand Cast values are preserved only because exact package equivalence is required; Video readiness is separately reviewed and Video approval is never granted by reconciliation.

The owner subsequently completed this flow. Controlled read-only verification found current lock version 3 linked to the explicit reconciliation review while historical version 2 remains unchanged. Identity review provenance is therefore no longer the current blocker.

### Locked reference rights — IMPLEMENTED / OWNER CONFIRMED

A 2026-08-17 read-only live diagnostic compared the exact current snapshot against all locked asset rows. It found the five canonical supporting references rights-confirmed and the Master missing explicit rights evidence. The owner subsequently completed the protected audited rights confirmation manually. The owner reports Persona now shows Reference Rights confirmed and Image Studio lists `North African Street Premium · Lock v3`. No code or migration fabricated historical rights evidence.

The protected `/api/persona/:id/reference-rights` flow now presents the exact current lock version, snapshot, Master, five canonical reference roles, and current per-asset rights state. Confirmation requires the authorized owner to explicitly attest necessary authorization, the Master, all canonical references, Milaene brand use, and AI-assisted Image Studio use. It writes an immutable `brain_events` evidence row containing the actual actor/time, exact snapshot/version/fingerprint and six asset IDs before it updates only the missing asset-level `rights_confirmed` flag. The operation ID makes retry idempotent; a changed lock, wrong workspace, wrong actor, incomplete 5/5 package, cancel, or rejection cannot grant rights. Rejection is audited and leaves eligibility false. No provider is called.

Canonical Image eligibility examines the exact locked Master plus canonical five. Missing rights appears as `Locked Brand Model reference rights are not confirmed.` Video eligibility remains independent and is not granted by this action (`lib/persona/creation/reference-rights/`, `lib/persona/creation/use-approvals/eligibility.ts`).

## 14. Approval Model

The current data model has distinct fields and metadata:

- `image_use_approved`, `image_use_approved_at`, `image_use_approved_by`;
- `video_use_approved`, `video_use_approved_at`, `video_use_approved_by`;
- `brand_cast_approved`, `brand_cast_approved_at`, `brand_cast_approved_by` (`lib/persona/domain/types.ts`, `supabase/migrations/20260813180000_persona_use_approvals_2_4d.sql`).

### Image-use approval — IMPLEMENTED

Requires explicit confirmation, a locked identity, a resolvable lock snapshot, image identity readiness, no pending revision, and a non-archived Persona. It does not auto-approve video or Brand Cast.

### Video-use approval — IMPLEMENTED/PARTIAL

Requires explicit confirmation, a locked identity, a resolvable lock snapshot, persisted `video_identity_ready`, no pending revision, and a non-archived Persona. There is no automated video-validation pipeline behind the readiness flag.

### Brand Cast approval — IMPLEMENTED/PARTIAL

Requires explicit confirmation, a locked identity, a resolvable snapshot, image-use approval, no pending revision, and a non-archived Persona. Current code explicitly sets `BRAND_CAST_REQUIRES_VIDEO_USE_APPROVED=false`, so Brand Cast approval does **not** require video-use approval (`lib/persona/creation/use-approvals/types.ts`).

Approvals do not call providers or mutate the identity snapshot. They emit audit events and do not auto-chain (`lib/persona/creation/use-approvals/use-approval-service.ts`).

### Governed write boundary

**IMPLEMENTED in application/domain code:** generic Persona create/update cannot set approval, readiness, or Identity Lock fields. Dedicated services remain the only application paths for those transitions and evaluate the same centralized durable eligibility rules (`lib/persona/domain/governed-fields.ts`, `lib/persona/creation/use-approvals/eligibility.ts`).

Legacy `status=Approved` remains a presentation/backward-compatibility field but has no forward implication: it does not grant Brand Cast membership, image eligibility, or video eligibility. Existing explicit fields created by historical migration/backfill are preserved; records are not destroyed or silently reclassified.

## 15. Brand Cast

**TARGET STATE:** Milaene should have approximately three permanent premium Brand Models. Membership is explicit; a Candidate or Persona record alone is not membership.

**CURRENT STATE:** The Supabase-backed Persona approval model is the single application/domain authority for Brand Cast membership, use eligibility, official-member queries, signed Master portrait cards, and milestone progress. The Official Brand Face archetype registry remains available as process-local temporary selection/session compatibility state, but is explicitly non-authoritative and production UI no longer reads it to decide official status or milestone completion (`lib/persona/creation/use-approvals/`, `lib/brand-face-selection/store.ts`, `components/persona/official-brand-face-milestone-panel.tsx`).

**Current downstream eligibility:**

- Image eligibility requires a valid lock snapshot with qualifying review evidence, confirmed rights on the exact locked Master plus canonical five, image identity readiness, explicit image-use approval, explicit Brand Cast approval, and no archived/revision state.
- Video eligibility uses the same durable identity authority and additionally requires `video_identity_ready` plus explicit video-use approval. Brand Cast/image approval can exist without video approval (`lib/persona/creation/use-approvals/eligibility.ts`).

## 16. Image Studio Handoff

**CURRENT STATE — IMPLEMENTED CONTRACT / PARTIAL PRODUCTION INTEGRATION:**

1. Image loads `/api/persona/integrations?consumer=image`, which returns only summaries satisfying the centralized Persona Image eligibility result, including rights on the exact locked Master plus canonical five. An ineligible Persona is filtered without making the whole list request fail.
2. Selecting a Persona requests the full handoff. The protected route resolves actor/workspace server-side, loads the workspace-scoped durable Persona, resolves its immutable lock snapshot, and derives the canonical `brand-model-v1` contract.
3. The handoff fails closed with typed safe reasons when Image-ineligible. An optional expected snapshot ID/version/fingerprint must match, preventing stale local selection from silently advancing.
4. Canonical reference descriptors expose durable asset IDs, roles, provenance, checksums, and metadata—not private storage paths. Short-lived signed accesses are resolved separately and remain transient.
5. Image Studio validates the canonical schema instead of redefining eligibility. `/api/image/run` receives only the Brand Model trace, re-authorizes and re-resolves the same exact identity version, and carries the contract into planning. Brain Image project JSON preserves the safe contract snapshot and every planned asset preserves the exact trace.

The provider-generation route now applies the same stronger Persona authorization, requires matching request/asset/project traces, reloads current canonical eligibility and rights, verifies the exact immutable snapshot/package IDs and checksums, downloads only the locked Master bytes server-side, and rechecks the lock before provider invocation. The provider-neutral identity input reaches OpenAI `images.edit` with the Master as the single authoritative image and high input fidelity; Flux rejects Brand Model work because its current adapter is text-only. Brain asset lineage records the exact lock/package, Master/supporting IDs and checksums, provider/model/strategy/request ID, and timestamps without private paths, bytes, or signed URLs. Live execution remains default-closed because Image lacks a durable paid confirmation/job/idempotency boundary (`lib/image/resolve-brand-model-generation-identity.ts`, `agents/image/generate.ts`, `agents/image/providers/openai-images-provider.ts`).

## 17. Video Studio Handoff

**CURRENT STATE — IMPLEMENTED CONTRACT BOUNDARY / PLACEHOLDER STUDIO:**

- The same protected list/full API supports `consumer=video` and returns only Personas satisfying the canonical Video eligibility result.
- `buildVideoStudioPersonaHandoff` enforces Video eligibility independently, binds the exact lock snapshot/version/fingerprint, supports stale-version rejection, and keeps signed asset access transient.
- `createVideoBrandModelProductionContext` validates the canonical handoff and derives the audit trace without duplicating eligibility rules.
- Brand Cast plus Image approval is valid without Video approval: Image handoff succeeds while Video handoff returns typed ineligibility reasons.
- Video Studio itself remains a coming-later route. No Video UI, project/job, provider execution, generated asset, review flow, or paid generation was added (`lib/persona/future/video-studio-hooks.ts`, `lib/video/brand-model-production-context.ts`, `app/(dashboard)/agents/video/page.tsx`).

## 18. Providers

### Discovery provider abstraction — IMPLEMENTED

`BrandFaceDiscoveryProvider` defines provider identity/model, configuration, seed capabilities, abort behavior, generation, and cost estimation (`lib/persona/creation/provider/brand-face-discovery-provider.ts`). Implementations include:

- **OpenAI Images:** current default, model identifier `gpt-image-1`; does not promise deterministic seeds (`openai-brand-face-discovery-provider.ts`).
- **FAL/FLUX:** available only when explicitly selected and configured; supports a supplied seed (`fal-flux-discovery-provider.ts`).
- **Fake provider:** tests only.
- **Manual upload/disabled modes:** non-provider paths in the general candidate-generator registry.

The resolver defaults new Official Brand Face discovery to OpenAI and does not silently switch to FLUX when OpenAI is unavailable (`discovery-provider-config.ts`, `discovery-provider-registry.ts`). Some older comments still describe FAL as the default and should be corrected; executable configuration is authoritative.

### Reference Package provider — IMPLEMENTED BUT PROVIDER-SPECIFIC

The current controlled Reference Package is explicitly OpenAI `images.edit` with Master input and high-fidelity/no-text-only behavior (`lib/persona/creation/reference-package/service.ts`, `agents/image/providers/openai-images-edit-provider.ts`). It is not currently provider-agnostic.

### Local validation provider — IMPLEMENTED

Face similarity and landmarks run server-side with bundled `@vladmandic/face-api`, TensorFlow, canvas, and repository-owned model files under `server-assets/face-api-models/`. The evaluator does not send biometric data to an external provider (`lib/persona/face-novelty-memory/local-face-embedding-evaluator.ts`).

**Target rule:** Persona Studio is not an OpenAI product. Provider implementations must remain replaceable, and provider-specific limitations must not redefine the domain lifecycle.

## 19. Paid Generation Safety

### Discovery — IMPLEMENTED

The Discovery path includes:

- a master environment switch that defaults closed;
- durable generation jobs and confirmations;
- estimate hash, provider, quality, candidate count, and asset-count matching;
- single-use confirmation records;
- a 30-minute confirmation window;
- explicit UI attestation and user-confirmation timestamp;
- rejection of debug/test headers for normal paid UI authorization;
- no silent paid-provider fallback;
- separate confirmation for retry/novelty replacement;
- test environments using a fake provider by default (`lib/persona/creation/paid-generation-guard.ts`, `paid-confirmation.ts`, `creation-service.ts`).

### Reference Package — PARTIAL

It has prepare/confirm separation, a persisted token, estimated maximum spend, and single-use session consumption, but it does not share all Discovery guards. The confirm path does not invoke the Persona paid-generation master switch, does not require the discovery UI attestation/user timestamp, and performs read-then-update token consumption rather than an inspected atomic consume. Token uniqueness and expiration are not enforced by the Reference Package migration/service. Concurrent confirmation and environment-level cost-control behavior therefore need hardening; this is not equivalent safety coverage (`lib/persona/creation/reference-package/service.ts`, `supabase/migrations/20260808220000_persona_reference_package_2_3d.sql`).

### Required invariant

No paid generation may occur because a screen loaded, a status was checked, a candidate was selected, Identity Lock was confirmed, or an approval was granted. Every paid attempt and retry needs explicit, current, scoped intent.

## 20. Persistence / Supabase Model

**IMPLEMENTED IN CODE; RUNTIME STATE NOT VERIFIED.**

### Core Persona and library tables

- `persona_personas`
- `persona_reference_assets`
- `persona_locations`
- `persona_camera_presets`
- `persona_poses`
- `persona_brand_looks`
- `persona_outfits`
- Persona-to-library junction tables (`supabase/migrations/20250719120000_persona_studio.sql`, `20260719140000_persona_studio_phase_1_1.sql`)

### Creation and review tables

- `persona_creation_projects`
- `persona_candidates`
- `persona_candidate_assets`
- `persona_identity_reviews`
- `persona_brand_cast_requirements`
- `persona_generation_jobs`
- `persona_generation_confirmations` (`20260719220000_persona_studio_phase_1_2_candidate_workflow.sql`, `20260719220142_persona_studio_phase_1_5_generation_jobs.sql`)

### Novelty and discovery tables

- `persona_face_novelty_records` plus embedding/evidence/history fields
- face-embedding backfill job/result tables
- `persona_discovery_attempts` (`20260729*`, `20260731*`, `20260807*` Persona migrations)

### Reference Package and lock tables

- `persona_reference_package_sessions`
- `persona_reference_package_attempts` plus angle, orientation, human override, mirror, and replacement fields
- `persona_identity_lock_snapshots`
- use-approval fields on `persona_personas` (`20260808*`, `20260809*`, `20260813*` Persona migrations)

Production Persona and creation repositories fail closed when Supabase is not configured; memory repositories are intended for tests (`lib/persona/repositories/factory.ts`, `lib/persona/creation/creation-factory.ts`). Generation-job, Reference Package, and Identity Lock factories can still fall back to memory when called without Supabase, so fallback policy is not uniform (`generation-job-factory.ts`, `reference-package/repository.ts`, `identity-lock/repository.ts`). Persona API routes normally gate on Supabase configuration.

### Security state

- Every inspected API route that exposes or mutates durable Persona identity/approval state calls `requirePersonaScope()`. Public health and static checklist routes do not expose durable Persona truth.
- `lib/persona/security/authorization.ts` resolves one typed actor/workspace context. In production it requires a valid Supabase user in the server-only `NEXHQ_PERSONA_AUTHORIZED_USER_IDS` allowlist, then resolves the server-selected workspace. Missing authentication returns `401`; unauthorized workspace access returns `403`.
- Authorization occurs before the service-role-backed workspace seed/repository path. Service-role capability therefore no longer acts as implicit Persona user authorization.
- An optional `NEXHQ_PERSONA_DEV_AUTH_BYPASS=true` path is explicit, disabled by default, ignored in production, and labeled as local development. The former silent `workspace-user` fallback is removed.
- Persona services/repositories receive explicit workspace scope and reject records owned by another workspace. Tests cover CRUD, Identity Lock, image/video/Brand Cast approvals, and Brand Model contract isolation.
- Historical migrations contained permissive/ineffective policies, while Reference Package and Identity Lock tables were created without RLS. Applied Milestone 2 removed those policies, enabled RLS on all 26 governed Persona tables, and revoked direct `PUBLIC`/`anon`/`authenticated` table privileges while preserving service-role server operation. Read-only catalog verification confirmed this live posture.

This is a hardened single-active-workspace application boundary, not complete multi-tenant authorization. No durable user-to-workspace membership/RBAC relation exists. The security migration is applied and live-verified; application-level authorization and manual runtime behavior remain separate concerns. See `docs/nexhq/integrations/SUPABASE.md`.

## 21. Relevant Storage

**IMPLEMENTED IN CODE; BUCKET CONFIGURATION VERIFIED, MANUAL ASSET DELIVERY STILL PENDING.**

- Bucket: private `persona-references`.
- Access: short-lived signed URLs; default TTL one hour. Permanent public URLs are explicitly forbidden.
- Allowed MIME types: JPEG, PNG, WebP, MP4.
- Maximum upload: 20 MB.
- Persona reference path: `workspace/{workspaceId}/personas/{personaId}/references/...`.
- Candidate path: `workspace/{workspaceId}/persona-creation/{projectId}/candidates/{candidateId}/...`.
- Novelty replacement stash: job-scoped path under the creation project.
- Rejected/archived candidate assets receive a default 30-day retention marker.
- Uploads compute SHA-256 checksums and basic image dimensions (`lib/persona/storage/reference-storage.ts`, `lib/persona/creation/candidate-storage.ts`, `supabase/migrations/20260719140000_persona_studio_phase_1_1.sql`).

The code ensures/creates the bucket at runtime using the admin client if needed. Static inspection does not prove the bucket exists or has the expected live policy.

## 22. API Surface

All routes below are under `app/api/persona/`. Runtime operation was not invoked.

| Route | Methods / responsibility | Status |
|---|---|---|
| `/api/persona` | GET snapshot/counts/list; POST manual Persona create | **IMPLEMENTED** |
| `/api/persona/:id` | GET detail/relations/readiness/references; PATCH ordinary fields/relations/legacy status; DELETE | **IMPLEMENTED:** governed approval/readiness/lock fields are rejected by generic CRUD |
| `/api/persona/:id/references` | POST private reference upload | **IMPLEMENTED** |
| `/api/persona/:id/references/:assetId` | PATCH review/metadata; DELETE with lock/package guards | **IMPLEMENTED** |
| `/api/persona/:id/reference-package` | GET status; prepare/confirm generation; regenerate; reassign/recompute angle; identity override; mirror; accepted-reference replacement lifecycle | **IMPLEMENTED** |
| `/api/persona/:id/identity-review` | GET manual reviews/checklist; POST checklist or lock action | **IMPLEMENTED** |
| `/api/persona/:id/identity-lock` | GET eligibility/snapshot/locked identity; POST explicit lock | **IMPLEMENTED** |
| `/api/persona/:id/use-approvals` | GET three-gate view; POST image, video, or Brand Cast approval | **IMPLEMENTED** |
| `/api/persona/creation-projects` | GET projects/presets/setup; POST project or safe-test project | **IMPLEMENTED** |
| `/api/persona/creation-projects/:id` | GET project/board/jobs/setup/status; PATCH estimate, prepare, generate, manual slots, novelty replacement/reconcile, or project fields | **IMPLEMENTED** |
| `/api/persona/creation-projects/:id/candidates` | GET current project candidate board payload | **IMPLEMENTED** |
| `/api/persona/candidates/:id` | GET candidate/assets; PATCH review/select/convert/Stage B/retry; POST manual asset | **IMPLEMENTED** |
| `/api/persona/creation-projects/:id/novelty-debug` | Novelty diagnostics, retry, preflight, and historical backfill actions | **IMPLEMENTED**, operational/admin surface needing access review |
| `/api/persona/brand-cast` | GET milestone/members; PATCH milestone requirements | **IMPLEMENTED** for Supabase Persona model |
| `/api/persona/locations`, `/camera`, `/poses`, `/brand-looks`, `/outfits` and `/:id` | CRUD supporting libraries | **IMPLEMENTED** |
| `/api/persona/health` | Supabase/schema/storage/provider health probe | **PARTIAL:** code exists, but its schema version and required table list stop at Phase 1.5 and omit later Reference Package/Lock tables |
| `/api/persona/integrations` | GET eligible Image/Video summaries or one full exact-lock Brand Model handoff; supports stale-version checks and transient signed access | **IMPLEMENTED IN CODE:** protected, workspace-scoped, Zod-validated, and fail-closed |
| `/api/persona/verify-checklist` | Static verification/checklist surface | **PARTIAL/diagnostic**, not proof of runtime completion |

All durable routes listed above call the shared `requirePersonaScope()` boundary before domain/repository work. Production requires authenticated allowlisted actor context; workspace is server-selected and explicit in domain calls. Health and static checklist routes are public diagnostics and do not expose durable Persona truth (`app/api/persona/_utils.ts`, `lib/persona/security/authorization.ts`, `lib/persona/services/workspace-scope.ts`).

## 23. Important UI Components

- `components/persona/persona-studio.tsx` — main shell, dashboard, Persona library/detail, supporting libraries, Reference Package, reference review, Identity Lock, and use-approval panels.
- `components/persona/use-persona-studio.ts` — client controller and Persona API orchestration.
- `components/persona/official-brand-face-casting-view.tsx` — Milaene archetype casting start and paid A1 confirmation.
- `components/persona/persona-creator-views.tsx` — creation projects, discovery lifecycle, candidate board, manual upload, selection, conversion, and novelty replacement UX.
- `components/persona/candidate-board.tsx` — candidate cards, comparison, gallery, notes, ranking, and quality presentation.
- `components/persona/persona-generation-experience.tsx` — generation progress/experience.
- `components/persona/face-novelty-live-check-panel.tsx` — novelty diagnostics/visibility.
- `components/persona/brand-archetype-cast-panel.tsx` — archetype presentation; local selection data is non-authoritative.
- `components/persona/official-brand-face-milestone-panel.tsx` — milestone presentation derived from durable Persona Brand Cast state.
- `components/persona/reference-boards-panel.tsx` — **PARTIAL/SEED-ONLY** Reference Boards; actions are disabled and automatic analysis is not implemented.

The main header still says `Phase 1.8 · Brand Faces`, even though code includes later 2.3/2.4/2.5 work. Several source comments and health/security version labels are similarly stale.

## 24. Service / Repository Architecture

### Main layers

1. **UI/controller:** `components/persona/`.
2. **Route boundary:** `app/api/persona/` with JSON/error mapping and workspace scope.
3. **Application services:** `lib/persona/services/persona-service.ts` for CRUD/library/reference behavior; `lib/persona/creation/creation-service.ts` for casting.
4. **Domain logic:** `lib/persona/domain/`, `creation/discovery/`, `candidate-intelligence/`, `reference-package/`, `identity-lock/`, `use-approvals/`, and `face-novelty-memory/`.
5. **Repositories:** interfaces with Supabase implementations and test memory implementations.
6. **Storage:** private Supabase bucket utilities.
7. **Audit:** best-effort events in existing `brain_events` (`lib/persona/audit/persona-events.ts`).

### Current repository split

- `PersonaRepository` owns Personas, reference assets, and supporting libraries.
- `PersonaCreationRepository` owns projects, candidates, candidate assets, identity reviews, and milestone requirements.
- `PersonaGenerationJobRepository` owns jobs and confirmations.
- `ReferencePackageRepository` owns sessions and per-angle attempts.
- `IdentityLockRepository` owns immutable lock snapshots.
- novelty/embedding/discovery attempts use additional focused repositories.
- `lib/brand-face-selection/store.ts` retains process-local casting/session compatibility objects, but exports them as explicitly non-authoritative and cannot grant canonical membership or eligibility.

The separation is useful, but a transaction spanning lock snapshot insertion and Persona update is not database-atomic; the service implements idempotent recovery instead (`identity-lock-service.ts`). Audit writes are best-effort and can fail without failing the domain action.

## 25. Testing and Validation

**IMPLEMENTED TEST FOUNDATION; LOCAL RESULTS VERIFIED FOR THIS MILESTONE.**

Static inventory found 77 `lib/persona` test files and one `lib/brand-face-selection` test file. Coverage areas now include:

- creation workflow and project/candidate isolation;
- paid confirmation security and fake-provider defaults;
- four-slot discovery completion and diversity;
- face novelty, embeddings, historical protection, and replacement recovery;
- Master Identity Reference conversion;
- Reference Package generation, reconciliation, camera direction, reassignment, human override, mirror salvage, and accepted replacement;
- Identity Lock eligibility, snapshot, recovery, and immutable-asset guards;
- image/video/Brand Cast approvals and independent downstream eligibility;
- authentication environment gating, authorize-before-service-role ordering, API guard coverage, and cross-workspace protected operations/contracts;
- additive migration/RLS contract checks and nullable legacy lock provenance;
- exact lock snapshot/version traceability, stale-selection rejection, private-asset projection, filtered downstream lists, and the Image/Video consumer seams;
- provider default selection and prompt/casting configuration;
- Persona CRUD/readiness and an opt-in live Supabase test.

Milestone validation results:

- the full repository suite passed 1,112 tests across 186 suites;
- the focused Identity Lock, approvals, reconciliation, and Persona API-security set passed 70 tests across 4 suites;
- `npx tsc --noEmit --pretty false` passed;
- targeted lint for the legacy-reconciliation route, service, UI, shared validator, and tests passed with zero errors or warnings; full-repository lint remains red on 317 errors/6,079 warnings in unrelated generated/plugin, temporary-script, and pre-existing repository files;
- `npm run build` passed; it reported existing repository lint warnings; and
- provider tests used fakes/stubs; no paid provider was called.

Important limits:

- The live Supabase suite is opt-in through `PERSONA_LIVE_VERIFY`; static presence does not prove current migrations or data work.
- No Persona component test files were found under `components/persona/`.
- Provider tests inject fakes and explicitly avoid live paid calls.
- Contract/service/consumer integration is tested with memory repositories and fake signed access, but no live browser → API → Supabase/storage → provider end-to-end workflow was run.
- No migration, API route, database, storage, or deployed environment was exercised.

## 26. CURRENT STATE

### IMPLEMENTED

- Supabase-backed Persona/library CRUD and private reference uploads.
- Creation projects, four-candidate Discovery architecture, generation jobs, estimates, and candidate review.
- OpenAI default Discovery, explicit FAL/FLUX option, manual upload, and fake test provider.
- Strong paid-confirmation controls for Discovery.
- Candidate diversity blueprints, current-run isolation, novelty memory, local face embeddings, and historical protection.
- Human selection and selected-candidate-to-Draft-Persona conversion.
- Master Identity Reference.
- Five-angle controlled Reference Package with identity/angle evidence and human review tools.
- Reconciled Reference Package readiness.
- Versioned Identity Lock snapshot and immutable locked-asset guards.
- Separate image, video, and Brand Cast approval services/metadata.
- Eligibility queries and official-member view for Supabase-backed Personas.
- Typed Persona authorization/workspace context with production Supabase-user allowlist, explicit non-production development bypass, and authorize-before-service-role ordering.
- Cross-workspace rejection for protected CRUD, Identity Lock, approvals, and Brand Model contract generation.
- Read-only legacy Identity Lock reconciliation diagnostics and fail-closed handling for snapshots without exact review provenance.
- Protected owner-only legacy reconciliation review with exact-package comparison, persisted present-tense provenance, explicit reject/accept decisions, immutable `N+1` lock creation, and partial-write retry recovery.
- Additive deny-direct-access Persona RLS/security migration in the repository.
- One canonical Zod-validated `brand-model-v1` contract, eligible list/full handoff service, exact-version checks, safe private-reference projection, and typed Image/Video consumer seams.
- Image planning/Brain context and planned-asset audit traces revalidated from Persona authority.
- Extensive domain/service/contract tests.

### PARTIAL

- Official Brand Face Casting: real UI and mapping into the persistent creation path exist; its own registry/project store remains temporary/non-durable but no longer has authority.
- Identity validation: robust facial/angle checks plus manual checklist, but no automated video validation or complete commercial-quality validation.
- Reference Package paid safety and provider abstraction.
- Security deployment: protected Persona APIs are hardened in code and both Foundation migrations plus live RLS/grants are verified, but the environment allowlist is not durable workspace membership/RBAC and health/version reporting remains stale.
- Reference Boards are seed-only with disabled actions.
- Image downstream integration reaches a controlled exact-lock generation/provider seam and persists safe lineage; durable paid-job/idempotency controls, live-provider verification, and full operational durability remain incomplete.
- Video consumes the canonical contract through a fake-only Studio foundation; real provider execution remains absent and its migration is unapplied.

### VIDEO DOWNSTREAM STATUS

- German Video Studio UI, fake orchestration and durable repository contracts exist; no real provider or generated Video is implemented, and live persistence awaits its unapplied migration.

### PLANNED / NOT FOUND

- Durable workspace membership/RBAC and membership-aware multi-workspace routing.
- Complete Identity Revision and re-lock workflow.
- Production-grade video identity validation.
- Live paid-provider verification of controlled locked-identity byte consumption (only after durable Image paid-job migration/application and live verification).
- Full production E2E evidence across UI, API, Supabase, storage, provider, approvals, and downstream studios.

### DEPRECATED / LEGACY

- Generic `status=Approved`/`approved=true` as a substitute for explicit Brand Cast membership.
- Legacy readiness helpers and candidate-level Stage B “manual only” messaging where they conflict with canonical reconciled readiness and the controlled Persona Reference Package.
- Stale phase labels and health schema version as indicators of current capability.

## 27. TARGET STATE

Persona Studio is complete when Milaene can reliably establish and operate approximately three recognizable Brand Models through one durable lifecycle:

- each run begins from an explicit, versioned casting direction;
- four visibly different identities are shown together for human choice;
- no candidate becomes official automatically;
- selection creates a Draft Persona and immutable Master anchor;
- a controlled, reviewed reference package proves useful identity coverage;
- validation distinguishes machine evidence from human decisions;
- Identity Lock freezes a versioned, reproducible package;
- image, video, and Brand Cast approvals are explicit and non-bypassable;
- the authoritative roster is persisted and auditable;
- Image and Video Studios consume the same locked package and enforce their own eligibility;
- all data and UI distinguish real, generated, manual, mocked, and unverified states;
- no downstream prompt, provider, scene, outfit, product, or campaign can silently substitute another identity.

Discovery should remain provider-agnostic. Identity Lock should remain provider-independent and deterministic over persisted evidence. Reference generation may use a provider, but the identity contract must not depend permanently on one vendor.

## 28. Known Gaps / Technical Debt

1. **Runtime rollout remains partial:** the Foundation migrations/security posture, reconciled lock version 3, and owner-completed audited rights confirmation are established; the owner reports the Image selector handoff working. The identity-conditioned generation path is fake-tested only, and manual live-provider/E2E verification remains pending.
2. **Downstream execution remains partial:** contract/list/full handoffs and a controlled Image exact-lock provider-reference seam exist, but paid Image execution has durable job/confirmation/idempotency code but an unapplied migration and no live-provider verification; Video production is absent.
3. **No Identity Revision workflow:** locked assets are protected, but deliberate revision/version advance is not operationally complete.
4. **Video readiness remains manual:** image and video readiness are now independent, but no automated video validation pipeline exists.
5. **Reference Package paid safety is weaker than Discovery:** it lacks the paid master-switch check, TTL, attestation, user timestamp, token uniqueness, and inspected atomic consumption.
6. **Provider abstraction is uneven:** Discovery is abstracted; Reference Package is OpenAI-specific.
7. **Conflicting Stage B paths:** candidate-level flow says manual-only while Persona Reference Package supports OpenAI image edit.
8. **Authorization remains an interim bridge:** protected Persona routes authorize before service-role work and reject cross-workspace access, and deny-direct-access RLS is applied and verified. Production authorization still uses a server user allowlist rather than durable membership/RBAC.
9. **Non-uniform memory fallback:** some secondary factories return memory repositories without Supabase, even though durable identity truth is required.
10. **Stale health/version indicators:** health probe stops at Phase 1.5 tables and UI shows Phase 1.8 despite later implementation.
11. **Reference Boards are seeds/placeholders:** they are not a live reference-management workflow.
12. **Subjective casting rules are heavily hard-coded:** current Milaene/archetype preferences must stay scoped/versioned and not become universal technical truth.
13. **Visual quality evidence remains incomplete:** brief-fit scores are not image analysis; manual review carries the quality burden.
14. **Runtime state is partially unknown:** 1,112 local tests across 186 suites, TypeScript, and build pass; migration history, Persona schema/RLS/grants, private bucket configuration, legacy lock state, and the owner-reported authenticated Persona → Image lock-v3 selector handoff are established. The identity-conditioned provider path is fake-tested only; paid-provider and full E2E operation remain unverified.
15. **Audit is best-effort:** a successful identity/approval write may outlive a failed audit event.

## 29. Invariants — Rules That Must Not Be Broken

1. Discovery and Identity Lock are separate stages.
2. Discovery should produce four genuinely different identities, not styling variants of one face.
3. Human selection determines the official candidate.
4. Paid generation requires explicit, current, scoped intent.
5. A Candidate is not automatically a Brand Model.
6. A Draft Persona is not automatically approved.
7. A Persona is not automatically Brand Cast approved.
8. Identity Lock must not be silently replaced, weakened, or bypassed downstream.
9. The Master Identity Reference must remain the selected identity anchor.
10. Generated supporting references must never silently become the Master.
11. Machine identity evidence must not be rewritten to hide a mismatch; any human override must remain explicit and auditable.
12. Image Studio must respect image-use eligibility and Brand Cast membership.
13. Video Studio must respect video-use eligibility; image approval is not video approval.
14. Downstream studios must not create competing permanent identity truth.
15. Durable Persona truth belongs in persistent storage; browser/process-local state cannot be canonical.
16. Provider implementations must remain replaceable, and no silent paid-provider fallback is allowed.
17. Mock, fake, fixture, seed, and heuristic data must never be described as live Persona truth.
18. Runtime state must not be claimed from static inspection alone.
19. Selection, lock, image approval, video approval, and Brand Cast approval require distinct human intent.
20. A downstream request for a different scene, outfit, product, or campaign must not cause identity drift.
21. Archived, missing-snapshot, unresolved-revision, or unapproved identities must fail closed for downstream consumption.
22. Approximately three Milaene Brand Models is a roster target, not permission to auto-approve three records.

## 30. Definition of Done for Persona Studio

Persona Studio is **not DONE** as of this verification. Done requires all of the following to be implemented and verified:

### Complete casting lifecycle

- [ ] An explicit Milaene casting brief creates one durable creation/selection record.
- [ ] Discovery reliably produces four current-run, visibly different identities or clearly fails with recovery actions.
- [ ] Candidate diversity is verified by automated safeguards and human review.
- [ ] Human shortlist/reject/select decisions persist and are auditable.
- [ ] Exactly one selected candidate converts idempotently into a Draft Persona.

### Identity evidence

- [ ] The original selected portrait becomes the immutable Master Identity Reference.
- [ ] A controlled Reference Package covers all required angles with correct orientation and useful quality.
- [ ] Every accepted reference has clear source, rights, machine evidence, human decision, and provenance.
- [ ] Identity validation addresses facial consistency, skin/detail, anatomy, artifacts, commercial/editorial usability, image use, and video use without fabricating model evaluation.
- [ ] Identity drift and mismatch paths fail closed or require an explicit audited override.

### Lock and approvals

- [ ] Identity Lock writes one durable, immutable, versioned snapshot and fingerprint.
- [ ] A deliberate Identity Revision path can create a new version without mutating prior history.
- [ ] Image, video, and Brand Cast approvals are separate, explicit, authenticated, durable, and non-bypassable.
- [x] Generic CRUD cannot set governed approval/lock/readiness fields at schema and service boundaries.
- [x] Durable Persona state is the application/domain Brand Cast and eligibility authority; local/legacy state cannot grant eligibility.

### Downstream production

- [x] Image Studio has a canonical locked-package selector/planning consumer, generation-time exact-lock resolver, and provider-neutral Master-reference seam; live paid-provider verification remains pending.
- [x] Video Studio has a canonical contract consumer boundary enforcing Persona-derived video eligibility; the studio remains unbuilt.
- [x] Downstream contract services reject stale lock versions and do not accept competing identity authority.
- [ ] Approximately three Milaene Brand Models can be maintained, versioned, retired, and reused.

### Platform quality

- [ ] Supabase schema, constraints, migrations, storage, signed access, authorization, workspace isolation, and RLS are production-ready.
- [x] Protected Persona routes use one typed actor/workspace guard before service-role-backed work and fail closed across workspace scope in automated tests.
- [x] Any unauthenticated local development mode is explicit, environment-gated, and unavailable in production.
- [ ] No critical identity truth depends on browser/process-local state.
- [ ] Provider abstraction is clear; provider provenance is durable; paid safety covers initial generation and every retry/replacement.
- [ ] Errors are contained, observable, actionable, and do not claim false success.
- [ ] TypeScript is correct.
- [ ] Meaningful unit, integration, component, repository, security, and regression tests pass.
- [ ] Production build passes.
- [ ] A real end-to-end workflow is verified from casting direction through both downstream handoffs.
- [ ] No major unresolved identity drift, approval bypass, data-authority, security, or provider-cost path remains.
- [ ] Documentation accurately labels implemented, partial, placeholder, planned, and deprecated behavior.

## 31. Next Recommended Engineering Milestones

### Milestone 1 — Establish one non-bypassable durable identity authority — IMPLEMENTED / MIGRATION APPLIED

- Supabase-backed Persona, review-bound lock snapshots, explicit approvals, and roster state are now the sole application/domain authority;
- the process-local Brand Face registry is retained only as explicitly non-authoritative temporary session compatibility state;
- generic governed writes and legacy `Approved` equivalence are removed from canonical derivation;
- the additive migration is applied; the owner completed audited reconciliation, current version 3 is valid, and historical version 2 remains preserved.

### Milestone 2 — Security, workspace isolation, and safe migration readiness — IMPLEMENTED / MIGRATION APPLIED

- protected Persona APIs share one production-authenticated actor/workspace boundary;
- authorization occurs before service-role-backed workspace/repository work;
- CRUD, governed approvals, Identity Lock, and Brand Model contract generation reject cross-workspace scope;
- the local development bypass is explicit, off by default, and impossible in production;
- legacy locks without exact review provenance fail closed and have a diagnostic plus a protected explicit human reconciliation command;
- the applied additive migration removes known permissive policies, enables Persona RLS consistently, and denies direct anon/authenticated table access;
- live catalog verification confirms the intended RLS/grants; durable membership/RBAC and manual application runtime verification remain future work.

### Next Milestone — Complete and harden the remaining locked Brand Model lifecycle

- unify the conflicting Stage B flows around the canonical Master-conditioned Reference Package;
- bring Reference Package paid confirmation to Discovery's safety standard;
- separate image validation from video validation;
- add a deliberate versioned Identity Revision/re-lock workflow;
- preserve provenance, rights, and immutable history across replacement/revision.

### Persona Foundation Milestone 3 — Durable downstream contracts — IMPLEMENTED IN CODE / RUNTIME PARTIAL

- one canonical `brand-model-v1` production package serves Image and Video consumers and exposes actual per-reference rights state without private paths;
- Image and Video boundaries enforce centralized independent eligibility, exact locked-package rights, and stale-version rejection;
- Image has a selector/planning/audit seam plus controlled exact-lock generation/provider input, while Video now adds a fake-only project/job/review foundation that still consumes this same Persona authority;
- controlled signed asset access is transient and never canonical identity truth;
- local tests, TypeScript, targeted lint, and build pass; the owner reports the live selector handoff, while paid-provider execution and full E2E remain future work.

## 32. Relevant Code Map

| Area | Relevant paths |
|---|---|
| Canonical global context | `docs/nexhq/00_MASTER_CONTEXT.md` |
| Page and main shell | `app/(dashboard)/agents/persona/page.tsx`, `components/persona/persona-studio.tsx` |
| Client orchestration | `components/persona/use-persona-studio.ts`, `components/persona/persona-creator-views.tsx` |
| Official casting UI | `components/persona/official-brand-face-casting-view.tsx`, `components/persona/official-brand-face-milestone-panel.tsx` |
| Candidate UI | `components/persona/candidate-board.tsx`, `candidate-status-badge.tsx`, `persona-generation-experience.tsx` |
| Reference Boards | `components/persona/reference-boards-panel.tsx`, `lib/reference-intelligence/` |
| Domain types/readiness | `lib/persona/domain/types.ts`, `creation-types.ts`, `persona-readiness-resolver.ts`, `readiness.ts`, `brand-model-contract.ts`, `governed-fields.ts` |
| Persona CRUD/service | `lib/persona/services/persona-service.ts`, `workspace-scope.ts`, `health.ts` |
| Authorization/workspace guard | `lib/persona/security/authorization.ts`, `lib/persona/services/workspace-scope.ts`, `app/api/persona/_utils.ts` |
| Validation/API utilities | `lib/persona/validation/schemas.ts`, `app/api/persona/_utils.ts` |
| Persona repositories | `lib/persona/repositories/` |
| Creation workflow | `lib/persona/creation/creation-service.ts`, `creation-workflow.ts`, `casting-funnel.ts` |
| Creation repositories/jobs | `lib/persona/creation/*creation-repository.ts`, `*generation-job-repository.ts`, factories |
| Discovery orchestration | `lib/persona/creation/discovery/` |
| Candidate intelligence/diversity | `lib/persona/creation/candidate-intelligence/`, `lib/persona/identity-blueprints/` |
| Providers | `lib/persona/creation/provider/` |
| Paid safety | `lib/persona/creation/paid-generation-guard.ts`, `paid-confirmation.ts`, `active-discovery-confirmation.ts` |
| Novelty/face history | `lib/persona/face-novelty-memory/` |
| Candidate/reference storage | `lib/persona/creation/candidate-storage.ts`, `lib/persona/storage/reference-storage.ts` |
| Master Identity Reference | `lib/persona/creation/master-identity-reference.ts` |
| Reference Package | `lib/persona/creation/reference-package/` |
| Identity Lock/reconciliation | `lib/persona/creation/identity-lock/`, `lib/persona/creation/identity-review-quality-gate.ts` |
| Use approvals/Brand Cast query | `lib/persona/creation/use-approvals/` |
| Audit | `lib/persona/audit/persona-events.ts` |
| Official Brand Face temporary compatibility layer | `lib/brand-face-selection/` |
| Downstream contracts/consumers | `lib/persona/integrations/`, `lib/persona/future/image-studio-hooks.ts`, `video-studio-hooks.ts`, `app/api/persona/integrations/route.ts`, `lib/image/brand-model-production-context.ts`, `lib/video/brand-model-production-context.ts` |
| Persona API | `app/api/persona/` |
| Supabase integration | `docs/nexhq/integrations/SUPABASE.md` |
| Supabase schema | `supabase/migrations/20250719120000_persona_studio.sql`, `supabase/migrations/20260719*persona*`, `supabase/migrations/20260729*persona*`, `supabase/migrations/20260731*persona*`, `supabase/migrations/20260807*persona*`, `supabase/migrations/20260808*persona*`, `supabase/migrations/20260809*persona*`, `supabase/migrations/20260813*persona*`, `supabase/migrations/20260816210000_persona_foundation_milestone_1.sql`, `supabase/migrations/20260816220000_persona_foundation_milestone_2_security.sql` |
| Local face model assets | `server-assets/face-api-models/` |
| Tests | `lib/persona/**/*.test.ts`, `lib/brand-face-selection/brand-face-selection.test.ts` |


## 2026-08-17 Image Paid-Input Boundary

Persona remains the sole WHO authority. Image and Video preparation freeze the exact `brand-model-v1` trace and re-resolve canonical consumer eligibility. Image/Design/deterministic migrations are applied; Video migration `20260818003000` is not. Video approval remains irrelevant to Image eligibility, Image approval never grants Video eligibility, and no provider was called by the Video foundation work.

## Owner UX — 2026-08-17

The primary German journey is now Markenmodel finden → auswählen → Referenzpaket → Identitätsprüfung → Referenzrechte → Image-Freigabe → Brand Cast. The landing screen separates all Models, discovery, approved Models and work in progress. Primary readiness is owner-readable; raw identity/provenance remains secondary. Persona authority and all approval prerequisites are unchanged.

The final cleanup translated the deep Identity Lock/reconciliation, reference-rights, reference-package, candidate-replacement, comparison, lightbox, error and loading microcopy. Attempt history and raw provider evaluation metadata are collapsed as technical history where applicable. Operational Persona typography is now the shared Geist Sans scale; historical enum values remain unchanged internally.

## Video Studio consumption — 2026-08-18

Video Studio now consumes the existing Persona `consumer=video` handoff directly. It persists exact lock/reference fingerprints and refuses Image-only or Video-ineligible models. No Persona readiness, rights or approval formula changed, and no Video approval is inferred or granted by the new Studio.

Read-only canonical inspection on 2026-08-18 returned zero Video-eligible Brand Models for the Milaene workspace. That is an expected fail-closed production blocker, not an invitation to infer or auto-grant approval.

## Persona Video Readiness + Video Use Approval V1 — 2026-08-18

The previous Video authority was **partial and unsafe for owner completion**: the pre-lock general identity checklist could set the raw `video_identity_ready` boolean, while explicit Video Use approval checked that boolean without binding it to the current lock/reference package. There was no dedicated owner Video identity review.

The new boundary separates two human decisions:

1. **Video Identity Ready** — an immutable human checklist review bound to the exact Identity Lock snapshot, lock version, identity fingerprint and reference-package fingerprint.
2. **Video Use Approved** — a later explicit owner confirmation bound to that exact current review and lock trace.

Image approval, Identity Lock and Brand Cast membership never substitute for either decision. A new lock, changed package, revoked rights or rejected review makes current Video eligibility fail closed; historical evidence remains in `brain_events` and historical Video jobs remain unchanged. Generic Persona CRUD rejects all new authority fields.

The additive migration `20260818160000_persona_video_readiness_v1.sql` adds only lock/review binding metadata to `persona_personas`; it is **created and intentionally UNAPPLIED**. Until it is separately preflighted/applied, the live Persona remains not Video-ready and not Video-approved, and the new manual workflow is migration-blocked.

For Video V1, the existing Master plus frontal, left/right three-quarter and left/right profile package is the required locked facial identity package. This is sufficient only for the current approved-Image-to-Video identity source strategy. It is not a claim that general text-to-video or full-body motion references are complete.
