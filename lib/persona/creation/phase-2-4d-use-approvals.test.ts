/**
 * Phase 2.4D — Image / Video Use Approval + Brand Cast Approval.
 * No OpenAI / FLUX / provider calls. Approvals are authorization metadata only.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  MemoryCreationRepository,
  MemoryPersonaRepository,
  MemoryReferencePackageRepository,
  MemoryIdentityLockRepository,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
  setReferencePackageRepositoryForTests,
  setIdentityLockRepositoryForTests,
  lockBrandIdentity,
  resolveLockedBrandIdentity,
  getIdentityLockSnapshot,
  REFERENCE_PACKAGE_SLOTS,
  approveImageUse,
  approveVideoUse,
  approveBrandCast,
  getBrandModelApprovalsView,
  listImageStudioEligibleBrandModels,
  listVideoStudioEligibleBrandModels,
  listOfficialBrandCastMembers,
  getBrandCastMilestoneProgress,
  resolvePersonaReadinessFromFacts,
  UseApprovalError,
  VIDEO_IDENTITY_READINESS_POLICY,
  BRAND_CAST_REQUIRES_VIDEO_USE_APPROVED,
  IDENTITY_REVIEW_CHECK_KEYS,
  resolveBrandModelContract,
} from "@/lib/persona";
import { reconcileReferencePackageState } from "@/lib/persona/creation/reference-package/reconcile-reference-package-state";
import { buildMasterIdentityNotes } from "@/lib/persona/creation/master-identity-reference";
import { buildReferencePackageAssetNotes } from "@/lib/persona/creation/reference-package/types";
import type { Persona, WorkspaceScope } from "@/lib/persona/domain/types";
import { getReferencePackageRepository } from "@/lib/persona/creation/reference-package/repository";
import {
  resetBrandFaceSelectionStoreForTests,
  saveOfficialBrandFace,
} from "@/lib/brand-face-selection/store";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import {
  buildImageStudioPersonaHandoff,
  listImageStudioBrandModels,
} from "@/lib/persona/future/image-studio-hooks";
import {
  buildVideoStudioPersonaHandoff,
  listVideoStudioBrandModels,
} from "@/lib/persona/future/video-studio-hooks";
import {
  bindImageAssetsToBrandModel,
  createImageBrandModelProductionContext,
} from "@/lib/image/brand-model-production-context";
import { createVideoBrandModelProductionContext } from "@/lib/video/brand-model-production-context";
import { personaIntegrationQuerySchema } from "@/lib/persona/integrations/api-schema";

const ROOT = process.cwd();
const WS = "ws-phase-24d";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-24d" };

function minimalPersonaInput(name: string, role: string) {
  return {
    name,
    role,
    gender: "",
    age_range: "",
    height: "",
    body_type: "",
    skin_tone: "",
    hair: "",
    beard: "",
    eye_color: "",
    expression: "",
    personality: "",
    style: "",
    notes: "",
    brand_fit_score: 0,
  };
}

describe("Phase 2.4D — Use Approvals + Brand Cast", () => {
  let creationRepo: MemoryCreationRepository;
  let personaRepo: MemoryPersonaRepository;
  let pkgRepo: MemoryReferencePackageRepository;
  let lockRepo: MemoryIdentityLockRepository;

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    personaRepo = new MemoryPersonaRepository();
    pkgRepo = new MemoryReferencePackageRepository();
    lockRepo = new MemoryIdentityLockRepository();
    setCreationRepositoryForTests(creationRepo);
    setPersonaRepositoryForTests(personaRepo);
    setReferencePackageRepositoryForTests(pkgRepo);
    setIdentityLockRepositoryForTests(lockRepo);
  });

  afterEach(() => {
    setCreationRepositoryForTests(null);
    setPersonaRepositoryForTests(null);
    setReferencePackageRepositoryForTests(null);
    setIdentityLockRepositoryForTests(null);
    resetBrandFaceSelectionStoreForTests();
  });

  async function seedLockedPersona(opts?: {
    videoIdentityReady?: boolean;
  }): Promise<{ persona: Persona; fingerprint: string }> {
    const persona = await personaRepo.createPersona(scope, {
      name: "North African Street Premium",
      role: "primary_male",
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
      style: "street",
      notes: "",
      brand_fit_score: 90,
      visual_identity_notes: "notes",
      distinguishing_features: "",
      prohibited_changes: "none",
      default_hair_style: "short",
      default_facial_hair: "",
      default_expression: "neutral",
      default_body_proportions: "lean",
      default_styling_notes: "street",
    });

    const master = await personaRepo.createReferenceAsset(scope, {
      persona_id: persona.id,
      asset_type: "portrait",
      storage_path: `workspace/${WS}/master.png`,
      mime_type: "image/png",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: "chk-master",
      is_primary: true,
      view_angle: "front",
      framing: "face",
      expression: "neutral",
      body_visibility: "partial",
      source_type: "generated_external",
      rights_confirmed: true,
      status: "uploaded",
      notes: buildMasterIdentityNotes({
        version: 1,
        source: "selected_candidate",
        reference_type: "identity_master",
        primary_identity_reference: true,
        immutable_source_reference: true,
        original_provider: "openai",
        source_candidate_id: "cand-1",
        source_candidate_asset_id: "cand-asset-1",
        source_creation_project_id: null,
        label: "MASTER IDENTITY REFERENCE",
        subtitle: "Original selected Brand Face",
      }),
    });
    await personaRepo.updatePersona(scope, persona.id, {
      primary_reference_asset_id: master.id,
    });

    const session = await pkgRepo.createSession(scope, {
      persona_id: persona.id,
      master_reference_id: master.id,
      confirmation_token: "tok-24d",
      estimate_hash: createHash("sha256").update("pkg-24d").digest("hex"),
      estimated_cost_min: 0,
      estimated_cost_max: 0,
      max_authorized_spend: 0,
      image_count: 5,
    });

    for (const slot of REFERENCE_PACKAGE_SLOTS) {
      const created = await personaRepo.createReferenceAsset(scope, {
        persona_id: persona.id,
        asset_type: "portrait",
        storage_path: `workspace/${WS}/${slot}.png`,
        mime_type: "image/png",
        width: 1,
        height: 1,
        file_size_bytes: 10,
        checksum: `chk-${slot}`,
        is_primary: false,
        view_angle: "front",
        framing: "head_shoulders",
        expression: "neutral",
        body_visibility: "partial",
        source_type: "generated_external",
        rights_confirmed: true,
        status: "approved",
        notes: buildReferencePackageAssetNotes({
          slot,
          attemptId: `att-${slot}`,
          masterReferenceId: master.id,
          identityDecision: "identity_match",
          angleDirection: "correct",
        }),
      });
      const row = await pkgRepo.createAttempt(scope, {
        persona_id: persona.id,
        session_id: session.id,
        master_reference_id: master.id,
        reference_slot: slot,
        status: "accepted",
      });
      await pkgRepo.updateAttempt(scope, row.id, {
        generated_asset_id: created.id,
        identity_decision: "identity_match",
        angle_direction: "correct",
      });
    }

    await creationRepo.createIdentityReview(scope, {
      persona_id: persona.id,
      checklist: Object.fromEntries(
        IDENTITY_REVIEW_CHECK_KEYS.map((key) => [
          key,
          key === "suitable_for_video_generation"
            ? Boolean(opts?.videoIdentityReady)
            : true,
        ]),
      ) as Record<(typeof IDENTITY_REVIEW_CHECK_KEYS)[number], boolean>,
      all_passed: Boolean(opts?.videoIdentityReady),
      reviewer_notes: "Manual identity quality gate passed",
    });

    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(locked.providerCalled, false);

    if (opts?.videoIdentityReady) {
      await personaRepo.updatePersona(scope, persona.id, {
        video_identity_ready: true,
      });
    }

    const refreshed = await personaRepo.getPersona(scope, persona.id);
    assert.ok(refreshed);
    return {
      persona: refreshed,
      fingerprint: locked.snapshot.reference_package_fingerprint,
    };
  }

  it("1. unlocked persona cannot image approve", async () => {
    const persona = await personaRepo.createPersona(scope, {
      name: "Unlocked",
      role: "primary_male",
      gender: "male",
      age_range: "22-25",
      height: "180",
      body_type: "lean",
      skin_tone: "medium",
      hair: "short",
      beard: "",
      eye_color: "brown",
      expression: "neutral",
      personality: "",
      style: "",
      notes: "",
      brand_fit_score: 0,
    });
    await assert.rejects(
      () =>
        approveImageUse(scope, persona.id, { confirmImageUseApproval: true }),
      (err: unknown) =>
        err instanceof UseApprovalError &&
        /identity is not locked/i.test(err.message),
    );
  });

  it("2. locked + image_identity_ready can image approve", async () => {
    const { persona } = await seedLockedPersona();
    assert.equal(persona.image_identity_ready, true);
    const result = await approveImageUse(scope, persona.id, {
      confirmImageUseApproval: true,
    });
    assert.equal(result.persona.image_use_approved, true);
    assert.ok(result.persona.image_use_approved_at);
    assert.equal(result.providerCalled, false);
  });

  it("3. image approval explicit confirmation required", async () => {
    const { persona } = await seedLockedPersona();
    await assert.rejects(
      () =>
        approveImageUse(scope, persona.id, { confirmImageUseApproval: false }),
      (err: unknown) =>
        err instanceof UseApprovalError && /explicit confirmation/i.test(err.message),
    );
  });

  it("4. image approval idempotent", async () => {
    const { persona } = await seedLockedPersona();
    const first = await approveImageUse(scope, persona.id, {
      confirmImageUseApproval: true,
    });
    const second = await approveImageUse(scope, persona.id, {
      confirmImageUseApproval: true,
    });
    assert.equal(second.alreadyApproved, true);
    assert.equal(second.auditEmitted, false);
    assert.equal(
      second.persona.image_use_approved_at,
      first.persona.image_use_approved_at,
    );
  });

  it("5. image approval does not auto video approve", async () => {
    const { persona } = await seedLockedPersona();
    const result = await approveImageUse(scope, persona.id, {
      confirmImageUseApproval: true,
    });
    assert.equal(result.persona.video_use_approved, false);
  });

  it("6. image approval does not auto Brand Cast approve", async () => {
    const { persona } = await seedLockedPersona();
    const result = await approveImageUse(scope, persona.id, {
      confirmImageUseApproval: true,
    });
    assert.equal(result.persona.brand_cast_approved, false);
    assert.equal(result.persona.approved, false);
    assert.notEqual(result.persona.status, "Approved");
  });

  it("7. video approval eligibility follows actual readiness policy", async () => {
    assert.equal(
      VIDEO_IDENTITY_READINESS_POLICY,
      "requires_video_identity_ready_flag",
    );
    const { persona } = await seedLockedPersona();
    const view = await getBrandModelApprovalsView(scope, persona.id);
    assert.equal(view.videoUse.eligible, false);
    assert.ok(
      view.videoUse.blockingReasons.some((r) =>
        /video identity validation not completed/i.test(r),
      ),
    );
  });

  it("8. video approval explicit", async () => {
    const { persona } = await seedLockedPersona({ videoIdentityReady: true });
    await assert.rejects(
      () =>
        approveVideoUse(scope, persona.id, { confirmVideoUseApproval: false }),
      (err: unknown) =>
        err instanceof UseApprovalError && /explicit confirmation/i.test(err.message),
    );
    const result = await approveVideoUse(scope, persona.id, {
      confirmVideoUseApproval: true,
    });
    assert.equal(result.persona.video_use_approved, true);
    assert.equal(result.persona.brand_cast_approved, false);
  });

  it("9. video approval idempotent", async () => {
    const { persona } = await seedLockedPersona({ videoIdentityReady: true });
    const first = await approveVideoUse(scope, persona.id, {
      confirmVideoUseApproval: true,
    });
    const second = await approveVideoUse(scope, persona.id, {
      confirmVideoUseApproval: true,
    });
    assert.equal(second.alreadyApproved, true);
    assert.equal(second.auditEmitted, false);
    assert.equal(
      second.persona.video_use_approved_at,
      first.persona.video_use_approved_at,
    );
  });

  it("10. Brand Cast approval blocked before prerequisites", async () => {
    assert.equal(BRAND_CAST_REQUIRES_VIDEO_USE_APPROVED, false);
    const { persona } = await seedLockedPersona();
    await assert.rejects(
      () =>
        approveBrandCast(scope, persona.id, { confirmBrandCastApproval: true }),
      (err: unknown) =>
        err instanceof UseApprovalError &&
        /image studio use is not approved/i.test(err.message),
    );
  });

  it("11. Brand Cast approval succeeds after prerequisites", async () => {
    const { persona } = await seedLockedPersona();
    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    const result = await approveBrandCast(scope, persona.id, {
      confirmBrandCastApproval: true,
    });
    assert.equal(result.persona.brand_cast_approved, true);
    assert.equal(result.persona.status, "Approved");
    assert.equal(result.persona.approved, true);
  });

  it("12. Brand Cast approval sets official status", async () => {
    const { persona } = await seedLockedPersona();
    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    const result = await approveBrandCast(scope, persona.id, {
      confirmBrandCastApproval: true,
    });
    assert.equal(result.persona.status, "Approved");
    assert.ok(result.persona.brand_cast_approved_at);
  });

  it("13. legacy approved syncs only with Brand Cast approval", async () => {
    const { persona } = await seedLockedPersona();
    const image = await approveImageUse(scope, persona.id, {
      confirmImageUseApproval: true,
    });
    assert.equal(image.persona.approved, false);
    const cast = await approveBrandCast(scope, persona.id, {
      confirmBrandCastApproval: true,
    });
    assert.equal(cast.persona.approved, true);
    assert.equal(cast.persona.brand_cast_approved, true);
  });

  it("14-16. locked identity snapshot / refs / fingerprint unchanged", async () => {
    const { persona, fingerprint } = await seedLockedPersona();
    const beforeSnap = await getIdentityLockSnapshot(scope, persona.id);
    const beforeAssets = await personaRepo.listReferenceAssets(scope, persona.id);
    const beforeIds = beforeAssets.map((a) => a.id).sort();

    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    await approveBrandCast(scope, persona.id, { confirmBrandCastApproval: true });

    const afterSnap = await getIdentityLockSnapshot(scope, persona.id);
    const afterAssets = await personaRepo.listReferenceAssets(scope, persona.id);
    const afterIds = afterAssets.map((a) => a.id).sort();
    const dto = await resolveLockedBrandIdentity(scope, persona.id);

    assert.deepEqual(afterSnap, beforeSnap);
    assert.deepEqual(afterIds, beforeIds);
    assert.equal(dto?.identityFingerprint, fingerprint);
    assert.equal(afterSnap?.reference_package_fingerprint, fingerprint);
  });

  it("17. Brand Cast view receives approved model", async () => {
    const { persona } = await seedLockedPersona();
    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    await approveBrandCast(scope, persona.id, { confirmBrandCastApproval: true });
    const members = await listOfficialBrandCastMembers(scope);
    assert.ok(members.some((m) => m.personaId === persona.id));
    const progress = await getBrandCastMilestoneProgress(scope);
    assert.ok(progress.members.some((m) => m.personaId === persona.id));
  });

  it("18. consumer query excludes non-approved personas", async () => {
    const { persona } = await seedLockedPersona();
    let imageList = await listImageStudioEligibleBrandModels(scope);
    assert.equal(imageList.some((p) => p.personaId === persona.id), false);

    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    imageList = await listImageStudioEligibleBrandModels(scope);
    assert.equal(imageList.some((p) => p.personaId === persona.id), false);

    await approveBrandCast(scope, persona.id, { confirmBrandCastApproval: true });
    imageList = await listImageStudioEligibleBrandModels(scope);
    assert.ok(imageList.some((p) => p.personaId === persona.id));

    const videoList = await listVideoStudioEligibleBrandModels(scope);
    assert.equal(videoList.some((p) => p.personaId === persona.id), false);
  });

  it("19. readiness resolver updates correctly", async () => {
    const { persona } = await seedLockedPersona();
    const assets = await personaRepo.listReferenceAssets(scope, persona.id);
    const attempts = await getReferencePackageRepository().listAttemptsForPersona(
      scope,
      persona.id,
    );
    const reconciled = reconcileReferencePackageState({ attempts, assets });

    let readiness = resolvePersonaReadinessFromFacts({
      persona,
      assets,
      reconciled,
    });
    assert.equal(readiness.identityLocked, true);
    assert.equal(readiness.imageIdentityReady, true);
    assert.equal(readiness.imageUseApproved, false);
    assert.equal(readiness.videoUseApproved, false);
    assert.equal(readiness.brandCastApproved, false);
    assert.equal(readiness.visualStatus, "identity_locked");

    const afterImage = await approveImageUse(scope, persona.id, {
      confirmImageUseApproval: true,
    });
    readiness = resolvePersonaReadinessFromFacts({
      persona: afterImage.persona,
      assets,
      reconciled,
    });
    assert.equal(readiness.referencePackageReady, true);
    assert.equal(readiness.identityLocked, true);
    assert.equal(readiness.imageIdentityReady, true);
    assert.equal(readiness.imageUseApproved, true);
    assert.equal(readiness.videoUseApproved, false);
    assert.equal(readiness.brandCastApproved, false);
    assert.equal(readiness.visualStatus, "image_ready");

    const afterCast = await approveBrandCast(scope, persona.id, {
      confirmBrandCastApproval: true,
    });
    readiness = resolvePersonaReadinessFromFacts({
      persona: afterCast.persona,
      assets,
      reconciled,
    });
    assert.equal(readiness.visualStatus, "brand_cast_approved");
    assert.equal(readiness.brandCastApproved, true);
  });

  it("20. repeated final approval creates no duplicate membership", async () => {
    const { persona } = await seedLockedPersona();
    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    await approveBrandCast(scope, persona.id, { confirmBrandCastApproval: true });
    await approveBrandCast(scope, persona.id, { confirmBrandCastApproval: true });
    const members = await listOfficialBrandCastMembers(scope);
    assert.equal(members.filter((m) => m.personaId === persona.id).length, 1);
  });

  it("21-24. no provider / discovery / identity mutation side effects", async () => {
    const { persona, fingerprint } = await seedLockedPersona();
    const before = await personaRepo.getPersona(scope, persona.id);
    const image = await approveImageUse(scope, persona.id, {
      confirmImageUseApproval: true,
    });
    const cast = await approveBrandCast(scope, persona.id, {
      confirmBrandCastApproval: true,
    });
    assert.equal(image.providerCalled, false);
    assert.equal(cast.providerCalled, false);
    assert.equal(cast.persona.identity_lock_status, before!.identity_lock_status);
    assert.equal(cast.persona.identity_lock_version, before!.identity_lock_version);
    assert.equal(cast.persona.identity_locked_at, before!.identity_locked_at);
    const snap = await getIdentityLockSnapshot(scope, persona.id);
    assert.equal(snap?.reference_package_fingerprint, fingerprint);

    const serviceSrc = readFileSync(
      join(ROOT, "lib/persona/creation/use-approvals/use-approval-service.ts"),
      "utf8",
    );
    assert.doesNotMatch(serviceSrc, /from ["']openai["']|@openai|fal\.ai|flux-pro|generateCandidates\(|runDiscovery/i);
    assert.match(serviceSrc, /persona\.image_use_approved/);
    assert.match(serviceSrc, /persona\.video_use_approved/);
    assert.match(serviceSrc, /persona\.brand_cast_approved/);
  });

  it("25. versioned Brand Model contract carries durable identity and eligibility", async () => {
    const { persona, fingerprint } = await seedLockedPersona();
    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    await approveBrandCast(scope, persona.id, { confirmBrandCastApproval: true });

    const contract = await resolveBrandModelContract(scope, persona.id);
    assert.equal(contract.workspaceId, WS);
    assert.equal(contract.personaId, persona.id);
    assert.equal(contract.brandModelId, persona.id);
    assert.equal(contract.identity.fingerprint, fingerprint);
    assert.ok(contract.identity.lockVersion);
    assert.ok(contract.identity.identityLockSnapshotId);
    assert.ok(contract.identity.identityReview?.id);
    assert.equal(contract.identity.approvedReferencePackage.length, 5);
    assert.equal(contract.approvals.brandCastApproved, true);
    assert.equal(contract.eligibility.imageEligible, true);
    assert.equal(contract.eligibility.videoEligible, false);
  });

  it("26. legacy Approved status alone is not Brand Cast membership", async () => {
    const legacy = await personaRepo.createPersona(scope, {
      ...minimalPersonaInput("Legacy Approved", "legacy"),
      status: "Approved",
    });
    assert.equal(legacy.approved, true);
    assert.equal(legacy.brand_cast_approved, false);

    const contract = await resolveBrandModelContract(scope, legacy.id);
    assert.equal(contract.approvals.brandCastApproved, false);
    assert.equal(contract.eligibility.imageEligible, false);
    assert.ok(
      contract.eligibility.imageBlockingReasons.some((reason) =>
        /brand cast/i.test(reason),
      ),
    );
  });

  it("27. process-local Brand Face state cannot grant canonical eligibility", async () => {
    const persona = await personaRepo.createPersona(scope, {
      ...minimalPersonaInput("Session Face", "primary_male"),
    });
    saveOfficialBrandFace({
      id: "legacy-session-face",
      workspaceId: WS,
      archetypeId: "legacy-archetype",
      version: 1,
      personaId: persona.id,
      candidateId: "legacy-candidate",
      selectionProjectId: "legacy-project",
      identityDnaFingerprint: "legacy-process-local",
      imageReady: true,
      videoReady: true,
      status: "active",
      approvedAt: new Date().toISOString(),
      retiredAt: null,
    });

    const contract = await resolveBrandModelContract(scope, persona.id);
    assert.equal(contract.approvals.brandCastApproved, false);
    assert.equal(contract.eligibility.imageEligible, false);
    assert.equal(contract.eligibility.videoEligible, false);
  });

  it("28. Brand Model contract enforces workspace scope", async () => {
    const persona = await personaRepo.createPersona(scope, {
      ...minimalPersonaInput("Scoped Persona", "primary_male"),
    });
    await assert.rejects(
      () =>
        resolveBrandModelContract(
          { workspaceId: "other-workspace", actorId: "other-actor" },
          persona.id,
        ),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "UNAUTHORIZED_WORKSPACE",
    );
  });

  it("29. Image, Video, and Brand Cast approvals reject cross-workspace authority", async () => {
    const { persona } = await seedLockedPersona({ videoIdentityReady: true });
    const foreignScope: WorkspaceScope = {
      workspaceId: "different-workspace",
      actorId: "different-user",
    };

    for (const operation of [
      () =>
        approveImageUse(foreignScope, persona.id, {
          confirmImageUseApproval: true,
        }),
      () =>
        approveVideoUse(foreignScope, persona.id, {
          confirmVideoUseApproval: true,
        }),
      () =>
        approveBrandCast(foreignScope, persona.id, {
          confirmBrandCastApproval: true,
        }),
    ]) {
      await assert.rejects(
        operation,
        (error: unknown) =>
          error instanceof PersonaDomainError &&
          error.code === "UNAUTHORIZED_WORKSPACE",
      );
    }
  });

  it("30. Image handoff succeeds without Video approval and carries exact lock trace", async () => {
    const { persona } = await seedLockedPersona({ videoIdentityReady: false });
    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    await approveBrandCast(scope, persona.id, {
      confirmBrandCastApproval: true,
    });
    const snapshot = await getIdentityLockSnapshot(scope, persona.id);
    const handoff = await buildImageStudioPersonaHandoff(scope, persona.id, {
      resolveAssetAccess: false,
    });
    assert.equal(handoff.consumer, "image");
    assert.equal(handoff.contract.eligibility.imageEligible, true);
    assert.equal(handoff.contract.eligibility.videoEligible, false);
    assert.equal(
      handoff.contract.identity.identityLockSnapshotId,
      snapshot?.id,
    );
    assert.equal(
      handoff.contract.identity.lockVersion,
      snapshot?.identity_lock_version,
    );
    const context = createImageBrandModelProductionContext(handoff);
    assert.equal(context.trace.identityLockSnapshotId, snapshot?.id);
    assert.equal(context.trace.identityLockVersion, snapshot?.identity_lock_version);
    const [boundAsset] = bindImageAssetsToBrandModel(
      [{ id: "planned-image-asset" }],
      context,
    );
    assert.equal(boundAsset.brandModelTrace.personaId, persona.id);
    assert.equal(
      boundAsset.brandModelTrace.identityLockSnapshotId,
      snapshot?.id,
    );
  });

  it("31. Video handoff enforces independent canonical Video eligibility", async () => {
    const { persona } = await seedLockedPersona({ videoIdentityReady: true });
    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    await approveBrandCast(scope, persona.id, {
      confirmBrandCastApproval: true,
    });
    await assert.rejects(
      () =>
        buildVideoStudioPersonaHandoff(scope, persona.id, {
          resolveAssetAccess: false,
        }),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "BRAND_MODEL_INELIGIBLE" &&
        Array.isArray(error.details?.blockingReasons) &&
        error.details.blockingReasons.some((reason) =>
          /Video Studio use is not approved/i.test(String(reason)),
        ),
    );
    await approveVideoUse(scope, persona.id, {
      confirmVideoUseApproval: true,
    });
    const handoff = await buildVideoStudioPersonaHandoff(scope, persona.id, {
      resolveAssetAccess: false,
    });
    assert.equal(handoff.contract.eligibility.videoEligible, true);
    assert.equal(
      createVideoBrandModelProductionContext(handoff).trace.personaId,
      persona.id,
    );
  });

  it("32. private storage paths never enter the canonical contract", async () => {
    const { persona } = await seedLockedPersona();
    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    await approveBrandCast(scope, persona.id, {
      confirmBrandCastApproval: true,
    });
    const handoff = await buildImageStudioPersonaHandoff(scope, persona.id, {
      resolveAssetAccess: true,
      assetAccessResolver: async ({ workspaceId, asset }) => {
        assert.equal(workspaceId, WS);
        assert.match(asset.storage_path, new RegExp(`^workspace/${WS}/`));
        return {
          assetId: asset.id,
          delivery: "short_lived_signed_url" as const,
          url: `https://private-assets.test/signed/${asset.id}?token=ephemeral`,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        };
      },
    });
    const contractJson = JSON.stringify(handoff.contract);
    assert.doesNotMatch(contractJson, /storagePath|storage_path|\/workspace\//);
    assert.equal(handoff.assetAccess.length, 6);
    assert.ok(
      handoff.assetAccess.every(
        (access) => access.delivery === "short_lived_signed_url",
      ),
    );
  });

  it("33. stale Identity Lock selection fails closed", async () => {
    const { persona } = await seedLockedPersona();
    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    await approveBrandCast(scope, persona.id, {
      confirmBrandCastApproval: true,
    });
    const contract = await resolveBrandModelContract(scope, persona.id);
    const lockVersion = contract.identity.lockVersion;
    const identityFingerprint = contract.identity.fingerprint;
    assert.ok(lockVersion);
    assert.ok(identityFingerprint);
    await assert.rejects(
      () =>
        buildImageStudioPersonaHandoff(scope, persona.id, {
          expectedIdentity: {
            identityLockSnapshotId: "stale-snapshot",
            identityLockVersion: lockVersion,
            identityFingerprint,
          },
          resolveAssetAccess: false,
        }),
      (error: unknown) =>
        error instanceof PersonaDomainError &&
        error.code === "BRAND_MODEL_VERSION_MISMATCH",
    );
  });

  it("34. eligible discovery lists filter Draft, unlocked, non-Cast, and use-unapproved models", async () => {
    const eligible = await seedLockedPersona({ videoIdentityReady: true });
    await approveImageUse(scope, eligible.persona.id, {
      confirmImageUseApproval: true,
    });
    await approveBrandCast(scope, eligible.persona.id, {
      confirmBrandCastApproval: true,
    });
    const lockedButUnapproved = await seedLockedPersona({
      videoIdentityReady: true,
    });
    const imageApprovedButNotCast = await seedLockedPersona({
      videoIdentityReady: true,
    });
    await approveImageUse(scope, imageApprovedButNotCast.persona.id, {
      confirmImageUseApproval: true,
    });
    const archived = await seedLockedPersona({ videoIdentityReady: true });
    await approveImageUse(scope, archived.persona.id, {
      confirmImageUseApproval: true,
    });
    await approveBrandCast(scope, archived.persona.id, {
      confirmBrandCastApproval: true,
    });
    await personaRepo.updatePersona(scope, archived.persona.id, {
      status: "Archived",
    });
    const draft = await personaRepo.createPersona(scope, {
      ...minimalPersonaInput("Draft Model", "draft"),
    });

    const imageList = await listImageStudioBrandModels(scope);
    assert.deepEqual(imageList.map((model) => model.personaId), [
      eligible.persona.id,
    ]);
    assert.equal(
      imageList.some((model) => model.personaId === lockedButUnapproved.persona.id),
      false,
    );
    assert.equal(
      imageList.some(
        (model) => model.personaId === imageApprovedButNotCast.persona.id,
      ),
      false,
    );
    assert.equal(
      imageList.some((model) => model.personaId === archived.persona.id),
      false,
    );
    assert.equal(imageList.some((model) => model.personaId === draft.id), false);
    assert.deepEqual(await listVideoStudioBrandModels(scope), []);

    await approveVideoUse(scope, eligible.persona.id, {
      confirmVideoUseApproval: true,
    });
    const videoList = await listVideoStudioBrandModels(scope);
    assert.deepEqual(videoList.map((model) => model.personaId), [
      eligible.persona.id,
    ]);
  });

  it("35. an Image contract cannot be consumed as a Video contract", async () => {
    const { persona } = await seedLockedPersona();
    await approveImageUse(scope, persona.id, { confirmImageUseApproval: true });
    await approveBrandCast(scope, persona.id, {
      confirmBrandCastApproval: true,
    });
    const handoff = await buildImageStudioPersonaHandoff(scope, persona.id, {
      resolveAssetAccess: false,
    });
    assert.throws(
      () => createVideoBrandModelProductionContext(handoff),
      /cannot be used for video production/i,
    );
  });

  it("36. integration query validates intent and atomic stale-version checks", () => {
    assert.equal(
      personaIntegrationQuerySchema.safeParse({ consumer: "image" }).success,
      true,
    );
    assert.equal(
      personaIntegrationQuerySchema.safeParse({ consumer: "campaign" }).success,
      false,
    );
    assert.equal(
      personaIntegrationQuerySchema.safeParse({
        consumer: "image",
        personaId: "persona-1",
        expectedIdentityLockVersion: "1",
      }).success,
      false,
    );
    assert.equal(
      personaIntegrationQuerySchema.safeParse({
        consumer: "video",
        personaId: "persona-1",
        expectedIdentityLockSnapshotId: "snapshot-1",
        expectedIdentityLockVersion: "1",
        expectedIdentityFingerprint: "fingerprint-1",
      }).success,
      true,
    );
  });
});
