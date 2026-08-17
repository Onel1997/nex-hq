import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  IDENTITY_REVIEW_CHECK_KEYS,
  type IdentityReviewChecklist,
} from "@/lib/persona/domain/creation-types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { MemoryPersonaRepository } from "@/lib/persona/repositories/memory-persona-repository";
import { setPersonaRepositoryForTests } from "@/lib/persona/repositories/factory";
import { MemoryCreationRepository } from "./memory-creation-repository";
import { setCreationRepositoryForTests } from "./creation-factory";
import { buildMasterIdentityNotes } from "./master-identity-reference";
import { buildReferencePackageAssetNotes } from "./reference-package/types";
import {
  MemoryReferencePackageRepository,
  setReferencePackageRepositoryForTests,
} from "./reference-package/repository";
import { REFERENCE_PACKAGE_SLOTS } from "./reference-package/slots";
import {
  MemoryIdentityLockRepository,
  lockBrandIdentity,
  resolveLockedBrandIdentity,
  setIdentityLockRepositoryForTests,
} from "./identity-lock";
import {
  MemoryReferenceRightsEvidenceRepository,
  getReferenceRightsView,
  setReferenceRightsEvidenceRepositoryForTests,
  submitReferenceRightsDecision,
} from "./reference-rights";
import { evaluateBrandModelEligibility } from "./use-approvals/eligibility";
import {
  buildBrandModelHandoff,
  listEligibleBrandModels,
  resolveBrandModelContract,
} from "../integrations/brand-model-handoff";

const WS = "workspace-rights";
const ACTOR = "owner-rights-actor";
const OTHER_ACTOR = "other-actor";
const scope: WorkspaceScope = { workspaceId: WS, actorId: ACTOR };

function passedChecklist(): IdentityReviewChecklist {
  return Object.fromEntries(
    IDENTITY_REVIEW_CHECK_KEYS.map((key) => [
      key,
      key === "suitable_for_video_generation" ? false : true,
    ]),
  ) as IdentityReviewChecklist;
}

const confirmations = {
  hasNecessaryRightsOrAuthorization: true,
  masterIdentityReferenceAuthorized: true,
  canonicalReferencesAuthorized: true,
  aiAssistedImageProductionAuthorized: true,
  workspaceBrandUseAuthorized: true,
} as const;

describe("post-reconciliation reference rights and Image handoff", () => {
  let personaRepo: MemoryPersonaRepository;
  let creationRepo: MemoryCreationRepository;
  let packageRepo: MemoryReferencePackageRepository;
  let lockRepo: MemoryIdentityLockRepository;
  let rightsRepo: MemoryReferenceRightsEvidenceRepository;

  beforeEach(() => {
    personaRepo = new MemoryPersonaRepository();
    creationRepo = new MemoryCreationRepository();
    packageRepo = new MemoryReferencePackageRepository();
    lockRepo = new MemoryIdentityLockRepository();
    rightsRepo = new MemoryReferenceRightsEvidenceRepository();
    setPersonaRepositoryForTests(personaRepo);
    setCreationRepositoryForTests(creationRepo);
    setReferencePackageRepositoryForTests(packageRepo);
    setIdentityLockRepositoryForTests(lockRepo);
    setReferenceRightsEvidenceRepositoryForTests(rightsRepo);
  });

  afterEach(() => {
    setPersonaRepositoryForTests(null);
    setCreationRepositoryForTests(null);
    setReferencePackageRepositoryForTests(null);
    setIdentityLockRepositoryForTests(null);
    setReferenceRightsEvidenceRepositoryForTests(null);
  });

  async function seedNorthAfricanStreetPremiumFixture() {
    const persona = await personaRepo.createPersona(scope, {
      name: "North African Street Premium",
      role: "primary_male",
      status: "Approved",
      gender: "male",
      age_range: "22-25",
      height: "180",
      body_type: "lean",
      skin_tone: "medium",
      hair: "short",
      beard: "",
      eye_color: "brown",
      expression: "neutral",
      personality: "calm",
      style: "street premium",
      notes: "post-reconciliation rights regression fixture",
      brand_fit_score: 95,
      identity_lock_status: "collecting_references",
      image_identity_ready: true,
      video_identity_ready: false,
      image_use_approved: true,
      image_use_approved_at: "2026-08-13T17:42:52.534Z",
      image_use_approved_by: ACTOR,
      video_use_approved: false,
      brand_cast_approved: true,
      brand_cast_approved_at: "2026-08-13T17:43:36.043Z",
      brand_cast_approved_by: ACTOR,
    });
    const master = await personaRepo.createReferenceAsset(scope, {
      persona_id: persona.id,
      asset_type: "portrait",
      storage_path: `workspace/${WS}/personas/${persona.id}/references/master.png`,
      mime_type: "image/png",
      width: 100,
      height: 100,
      file_size_bytes: 100,
      checksum: "master-rights-checksum",
      status: "uploaded",
      is_primary: true,
      view_angle: "front",
      framing: "face",
      expression: "neutral",
      body_visibility: "partial",
      source_type: "generated_external",
      rights_confirmed: false,
      notes: buildMasterIdentityNotes({
        version: 1,
        source: "selected_candidate",
        reference_type: "identity_master",
        primary_identity_reference: true,
        immutable_source_reference: true,
        original_provider: "openai",
        source_candidate_id: "candidate-rights",
        source_candidate_asset_id: "candidate-asset-rights",
        source_creation_project_id: "project-rights",
        label: "MASTER IDENTITY REFERENCE",
        subtitle: "Original selected Brand Face",
      }),
    });
    await personaRepo.updatePersona(scope, persona.id, {
      primary_reference_asset_id: master.id,
    });
    const session = await packageRepo.createSession(scope, {
      persona_id: persona.id,
      master_reference_id: master.id,
      confirmation_token: "rights-fixture-token",
      estimate_hash: "rights-fixture-hash",
      estimated_cost_min: 0,
      estimated_cost_max: 0,
      max_authorized_spend: 0,
      image_count: 5,
    });
    const canonicalAssetIds: string[] = [];
    for (const slot of REFERENCE_PACKAGE_SLOTS) {
      const attempt = await packageRepo.createAttempt(scope, {
        persona_id: persona.id,
        session_id: session.id,
        master_reference_id: master.id,
        reference_slot: slot,
        status: "accepted",
      });
      const asset = await personaRepo.createReferenceAsset(scope, {
        persona_id: persona.id,
        asset_type: slot.includes("profile")
          ? "profile"
          : slot.includes("three_quarter")
            ? "three_quarter"
            : "portrait",
        storage_path: `workspace/${WS}/personas/${persona.id}/references/${slot}.png`,
        mime_type: "image/png",
        width: 100,
        height: 100,
        file_size_bytes: 100,
        checksum: `rights-checksum-${slot}`,
        status: "approved",
        is_primary: false,
        view_angle: slot,
        framing: "head_shoulders",
        expression: "neutral",
        body_visibility: "partial",
        source_type: "generated_external",
        rights_confirmed: true,
        notes: buildReferencePackageAssetNotes({
          slot,
          attemptId: attempt.id,
          masterReferenceId: master.id,
          identityDecision: "identity_match",
          angleDirection: "correct",
        }),
      });
      canonicalAssetIds.push(asset.id);
      await packageRepo.updateAttempt(scope, attempt.id, {
        generated_asset_id: asset.id,
        identity_decision: "identity_match",
        angle_direction: "correct",
      });
    }
    await creationRepo.createIdentityReview(scope, {
      persona_id: persona.id,
      checklist: passedChecklist(),
      all_passed: false,
      reviewer_notes: "Image identity accepted; Video remains independent.",
    });
    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    const currentPersona = await personaRepo.getPersona(scope, persona.id);
    assert.ok(currentPersona);
    return {
      persona: currentPersona!,
      master,
      canonicalAssetIds,
      locked: locked.snapshot,
    };
  }

  function decisionInput(
    locked: Awaited<ReturnType<typeof seedNorthAfricanStreetPremiumFixture>>["locked"],
    decision: "confirmed" | "rejected" = "confirmed",
    operationId = randomUUID(),
  ) {
    return {
      operationId,
      expectedIdentityLockSnapshotId: locked.id,
      expectedIdentityLockVersion: locked.identity_lock_version,
      expectedIdentityFingerprint: locked.reference_package_fingerprint,
      decision,
      confirmations,
      rejectionReason:
        decision === "rejected" ? "Owner cannot confirm current rights." : undefined,
    };
  }

  it("fails closed for the exact live-state shape until rights are explicitly confirmed", async () => {
    const fixture = await seedNorthAfricanStreetPremiumFixture();
    const identity = await resolveLockedBrandIdentity(scope, fixture.persona.id);
    const eligibility = evaluateBrandModelEligibility({
      persona: fixture.persona,
      lockedIdentity: identity,
    });
    assert.equal(eligibility.referenceRightsConfirmed, false);
    assert.equal(eligibility.imageEligible, false);
    assert.ok(
      eligibility.imageBlockingReasons.includes(
        "Locked Brand Model reference rights are not confirmed.",
      ),
    );
    assert.deepEqual(await listEligibleBrandModels(scope, "image"), []);
    const diagnostic = await resolveBrandModelContract(scope, fixture.persona.id);
    assert.equal(diagnostic.identity.masterIdentityReference?.rightsConfirmed, false);
    await assert.rejects(
      () => buildBrandModelHandoff(scope, fixture.persona.id, "image"),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "BRAND_MODEL_INELIGIBLE",
    );
  });

  it("persists owner evidence, confirms exact locked assets, and restores Image only", async () => {
    const fixture = await seedNorthAfricanStreetPremiumFixture();
    const before = Date.now();
    const input = decisionInput(fixture.locked);
    const result = await submitReferenceRightsDecision(
      scope,
      fixture.persona.id,
      input,
    );
    assert.equal(result.evidence.decision, "confirmed");
    assert.equal(result.evidence.decidedBy, ACTOR);
    assert.ok(Date.parse(result.evidence.decidedAt) >= before);
    assert.equal(result.evidence.identityLockSnapshotId, fixture.locked.id);
    assert.equal(result.evidence.masterReferenceAssetId, fixture.master.id);
    assert.deepEqual(
      result.evidence.canonicalReferenceAssetIds,
      fixture.canonicalAssetIds,
    );
    assert.equal(result.rights.rightsConfirmed, true);
    assert.equal(result.rights.exactAuditedConfirmation?.id, input.operationId);
    assert.equal(result.imageEligible, true);
    assert.equal(result.videoEligible, false);
    const list = await listEligibleBrandModels(scope, "image");
    assert.equal(list.length, 1);
    assert.equal(list[0].displayName, "North African Street Premium");
    assert.deepEqual(await listEligibleBrandModels(scope, "video"), []);

    const retry = await submitReferenceRightsDecision(
      scope,
      fixture.persona.id,
      input,
    );
    assert.equal(retry.evidence.id, result.evidence.id);
    assert.equal((await rightsRepo.listForPersona(scope, fixture.persona.id)).length, 1);
  });

  it("records rejection without changing eligibility", async () => {
    const fixture = await seedNorthAfricanStreetPremiumFixture();
    const result = await submitReferenceRightsDecision(
      scope,
      fixture.persona.id,
      decisionInput(fixture.locked, "rejected"),
    );
    assert.equal(result.evidence.decision, "rejected");
    assert.equal(result.rights.rightsConfirmed, false);
    assert.equal(result.imageEligible, false);
    assert.deepEqual(await listEligibleBrandModels(scope, "image"), []);
  });

  it("rejects wrong workspace, stale lock, and operation reuse by another actor", async () => {
    const fixture = await seedNorthAfricanStreetPremiumFixture();
    await assert.rejects(
      () =>
        getReferenceRightsView(
          { workspaceId: "another-workspace", actorId: ACTOR },
          fixture.persona.id,
        ),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "UNAUTHORIZED_WORKSPACE",
    );
    await assert.rejects(
      () =>
        submitReferenceRightsDecision(scope, fixture.persona.id, {
          ...decisionInput(fixture.locked),
          expectedIdentityLockVersion: fixture.locked.identity_lock_version + 1,
        }),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "BRAND_MODEL_VERSION_MISMATCH",
    );
    const operationId = randomUUID();
    const input = decisionInput(fixture.locked, "rejected", operationId);
    await submitReferenceRightsDecision(scope, fixture.persona.id, input);
    await assert.rejects(
      () =>
        submitReferenceRightsDecision(
          { ...scope, actorId: OTHER_ACTOR },
          fixture.persona.id,
          input,
        ),
      (error: unknown) =>
        error instanceof PersonaDomainError && /another decision, actor/i.test(error.message),
    );
  });

  it("blocks rights confirmation when the locked 5/5 package cannot resolve", async () => {
    const fixture = await seedNorthAfricanStreetPremiumFixture();
    await personaRepo.deleteReferenceAsset(scope, fixture.canonicalAssetIds[4]);
    await assert.rejects(
      () =>
        submitReferenceRightsDecision(
          scope,
          fixture.persona.id,
          decisionInput(fixture.locked),
        ),
      (error: unknown) =>
        error instanceof PersonaDomainError && /valid current Identity Lock/i.test(error.message),
    );
  });

  it("does not add a random fallback and auto-selects only one canonical eligible model", () => {
    const source = readFileSync(
      join(process.cwd(), "components/image/brand-model-selector.tsx"),
      "utf8",
    );
    assert.match(source, /eligible\.length === 1/);
    assert.doesNotMatch(source, /random|Math\.random/);
    assert.match(source, /<option value="">No Persona selected<\/option>/);
  });
});
