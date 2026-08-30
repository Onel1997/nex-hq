import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  MemoryCreationRepository,
} from "../memory-creation-repository";
import { setCreationRepositoryForTests } from "../creation-factory";
import {
  MemoryPersonaRepository,
} from "@/lib/persona/repositories/memory-persona-repository";
import { setPersonaRepositoryForTests } from "@/lib/persona/repositories/factory";
import {
  MemoryIdentityLockRepository,
  setIdentityLockRepositoryForTests,
} from "../identity-lock/repository";
import { IDENTITY_LOCK_POLICY_VERSION } from "../identity-lock/types";
import { IDENTITY_REVIEW_CHECK_KEYS } from "@/lib/persona/domain/creation-types";
import {
  MemoryReferenceRightsEvidenceRepository,
  setReferenceRightsEvidenceRepositoryForTests,
} from "../reference-rights/repository";
import {
  REFERENCE_RIGHTS_CONFIRMATION_SCOPE,
  REFERENCE_RIGHTS_EVIDENCE_VERSION,
} from "../reference-rights/types";
import {
  MemoryVideoIdentityReviewRepository,
  setVideoIdentityReviewRepositoryForTests,
} from "./repository";
import {
  getVideoIdentityReadinessView,
  submitVideoIdentityReview,
} from "./service";
import { approveVideoUse } from "../use-approvals/use-approval-service";
import {
  isCurrentVideoIdentityReady,
  isCurrentVideoUseApproved,
} from "./authority";
import { resolveLockedBrandIdentity } from "../identity-lock";
import { assertNoGovernedPersonaFields } from "@/lib/persona/domain/governed-fields";

const WS = "video-readiness-workspace";
const ACTOR = "00000000-0000-4000-8000-000000000701";
const scope = { workspaceId: WS, actorId: ACTOR };

let personas: MemoryPersonaRepository;
let creation: MemoryCreationRepository;
let locks: MemoryIdentityLockRepository;
let rights: MemoryReferenceRightsEvidenceRepository;
let reviews: MemoryVideoIdentityReviewRepository;

beforeEach(() => {
  personas = new MemoryPersonaRepository();
  creation = new MemoryCreationRepository();
  locks = new MemoryIdentityLockRepository();
  rights = new MemoryReferenceRightsEvidenceRepository();
  reviews = new MemoryVideoIdentityReviewRepository();
  setPersonaRepositoryForTests(personas);
  setCreationRepositoryForTests(creation);
  setIdentityLockRepositoryForTests(locks);
  setReferenceRightsEvidenceRepositoryForTests(rights);
  setVideoIdentityReviewRepositoryForTests(reviews);
});

afterEach(() => {
  setPersonaRepositoryForTests(null);
  setCreationRepositoryForTests(null);
  setIdentityLockRepositoryForTests(null);
  setReferenceRightsEvidenceRepositoryForTests(null);
  setVideoIdentityReviewRepositoryForTests(null);
});

async function seedCurrentLock() {
  const persona = await personas.createPersona(scope, {
    name: "Video Review Fixture",
    role: "brand_model",
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
    brand_fit_score: 100,
  });
  const makeRef = async (id: string, view: string, primary = false) =>
    personas.createReferenceAsset(scope, {
      persona_id: persona.id,
      asset_type: "portrait",
      storage_path: `workspace/${WS}/${id}.png`,
      mime_type: "image/png",
      width: 100,
      height: 120,
      file_size_bytes: 100,
      checksum: `checksum-${id}`,
      status: "approved",
      is_primary: primary,
      view_angle: view as never,
      framing: "head_shoulders",
      expression: "neutral",
      body_visibility: "partial",
      source_type: "user_upload",
      rights_confirmed: true,
      notes: "",
    });
  const master = await makeRef("master", "front", true);
  const slots = [
    "front",
    "three_quarter_left",
    "three_quarter_right",
    "left_profile",
    "right_profile",
  ] as const;
  const refs = await Promise.all(slots.map((slot) => makeRef(slot, slot)));
  const identityReview = await creation.createIdentityReview(scope, {
    persona_id: persona.id,
    checklist: Object.fromEntries(
      IDENTITY_REVIEW_CHECK_KEYS.map((key) => [key, true]),
    ) as never,
    all_passed: true,
    reviewer_notes: "lock evidence",
  });
  const snapshot = await locks.createSnapshot(scope, {
    persona_id: persona.id,
    source_candidate_id: null,
    source_creation_project_id: null,
    master_reference_asset_id: master.id,
    master_checksum: master.checksum,
    front_asset_id: refs[0].id,
    three_quarter_left_asset_id: refs[1].id,
    three_quarter_right_asset_id: refs[2].id,
    left_profile_asset_id: refs[3].id,
    right_profile_asset_id: refs[4].id,
    canonical_references: refs.map((reference, index) => ({
      slot: slots[index],
      assetId: reference.id,
      checksum: reference.checksum,
      provenance: "machine_match",
      identitySourceConfidence: null,
      referenceProvenance: "generated" as never,
      effectiveSlot: slots[index],
    })),
    identity_lock_version: 3,
    identity_locked_at: new Date().toISOString(),
    identity_locked_by: ACTOR,
    identity_review_id: identityReview.id,
    identity_reviewed_at: identityReview.reviewed_at,
    identity_reviewed_by: identityReview.reviewed_by,
    reference_package_version: "reference-package-v1",
    reference_package_fingerprint: "fingerprint-lock-v3",
    provenance_counts: {
      machineMatchCount: 5,
      warningApprovedCount: 0,
      mismatchOverrideCount: 0,
      derivedReferenceCount: 0,
      reassignedCount: 0,
      replacementApprovedCount: 0,
    },
    policy_version: IDENTITY_LOCK_POLICY_VERSION,
  });
  await personas.updatePersona(scope, persona.id, {
    identity_lock_status: "approved",
    identity_lock_version: 3,
    identity_locked_at: snapshot.identity_locked_at,
    image_identity_ready: true,
    image_use_approved: true,
    brand_cast_approved: true,
    primary_reference_asset_id: master.id,
  });
  await rights.create(scope, {
    evidenceVersion: REFERENCE_RIGHTS_EVIDENCE_VERSION,
    scope: REFERENCE_RIGHTS_CONFIRMATION_SCOPE,
    decision: "confirmed",
    operationId: "00000000-0000-4000-8000-000000000702",
    workspaceId: WS,
    personaId: persona.id,
    identityLockSnapshotId: snapshot.id,
    identityLockVersion: 3,
    identityFingerprint: snapshot.reference_package_fingerprint,
    masterReferenceAssetId: master.id,
    canonicalReferenceAssetIds: refs.map((reference) => reference.id),
    confirmations: {
      hasNecessaryRightsOrAuthorization: true,
      masterIdentityReferenceAuthorized: true,
      canonicalReferencesAuthorized: true,
      aiAssistedImageProductionAuthorized: true,
      workspaceBrandUseAuthorized: true,
    },
    decidedBy: ACTOR,
    decidedAt: new Date().toISOString(),
    rejectionReason: null,
  });
  return { personaId: persona.id, snapshot, master, refs };
}

const allPassed = {
  faceIdentityStable: true,
  masterReferenceValid: true,
  anglesSufficient: true,
  hairstyleConsistent: true,
  facialHairConsistent: true,
  ageAppearanceConsistent: true,
  bodyFrameUsable: true,
  noIdentityConflict: true,
  referencesSuitableForMotion: true,
};

test("Image approval and Brand Cast never imply Video readiness or approval", async () => {
  const seeded = await seedCurrentLock();
  const locked = await resolveLockedBrandIdentity(scope, seeded.personaId);
  const persona = await personas.getPersona(scope, seeded.personaId);
  assert.ok(persona && locked);
  assert.equal(isCurrentVideoIdentityReady(persona, locked), false);
  assert.equal(isCurrentVideoUseApproved(persona, locked), false);
});

test("current-lock human review enables readiness but not Video Use Approval", async () => {
  const seeded = await seedCurrentLock();
  const before = await getVideoIdentityReadinessView(scope, seeded.personaId);
  assert.equal(before.canReview, true);
  assert.equal(before.videoIdentityReady, false);
  const result = await submitVideoIdentityReview(scope, seeded.personaId, {
    operationId: "00000000-0000-4000-8000-000000000703",
    expectedIdentityLockSnapshotId: before.identityLockSnapshotId,
    expectedIdentityLockVersion: before.identityLockVersion,
    expectedIdentityFingerprint: before.identityFingerprint,
    expectedReferencePackageFingerprint: before.referencePackageFingerprint,
    checklist: allPassed,
    decision: "APPROVE",
  });
  assert.equal(result.persona.video_identity_ready, true);
  assert.equal(result.persona.video_use_approved, false);
  const retry = await submitVideoIdentityReview(scope, seeded.personaId, {
    operationId: "00000000-0000-4000-8000-000000000703",
    expectedIdentityLockSnapshotId: before.identityLockSnapshotId,
    expectedIdentityLockVersion: before.identityLockVersion,
    expectedIdentityFingerprint: before.identityFingerprint,
    expectedReferencePackageFingerprint: before.referencePackageFingerprint,
    checklist: allPassed,
    decision: "APPROVE",
  });
  assert.equal(retry.review.reviewedAt, result.review.reviewedAt);
  assert.equal((await reviews.listForPersona(scope, seeded.personaId)).length, 1);
  const approved = await approveVideoUse(scope, seeded.personaId, {
    confirmVideoUseApproval: true,
  });
  const locked = await resolveLockedBrandIdentity(scope, seeded.personaId);
  assert.equal(isCurrentVideoUseApproved(approved.persona, locked), true);
  assert.equal(approved.persona.video_use_approval_review_id, result.review.operationId);
  assert.equal(approved.persona.video_use_approved_by, ACTOR);
  assert.ok(approved.persona.video_use_approved_at);
});

test("rejected review and incomplete checklist cannot grant readiness", async () => {
  const seeded = await seedCurrentLock();
  const view = await getVideoIdentityReadinessView(scope, seeded.personaId);
  await assert.rejects(() =>
    submitVideoIdentityReview(scope, seeded.personaId, {
      operationId: "00000000-0000-4000-8000-000000000704",
      expectedIdentityLockSnapshotId: view.identityLockSnapshotId,
      expectedIdentityLockVersion: view.identityLockVersion,
      expectedIdentityFingerprint: view.identityFingerprint,
      expectedReferencePackageFingerprint: view.referencePackageFingerprint,
      checklist: { ...allPassed, anglesSufficient: false },
      decision: "APPROVE",
    }),
  );
  const rejected = await submitVideoIdentityReview(scope, seeded.personaId, {
    operationId: "00000000-0000-4000-8000-000000000705",
    expectedIdentityLockSnapshotId: view.identityLockSnapshotId,
    expectedIdentityLockVersion: view.identityLockVersion,
    expectedIdentityFingerprint: view.identityFingerprint,
    expectedReferencePackageFingerprint: view.referencePackageFingerprint,
    checklist: { ...allPassed, noIdentityConflict: false },
    decision: "REJECT",
    note: "Identitätskonflikt prüfen",
  });
  assert.equal(rejected.persona.video_identity_ready, false);
  assert.equal(rejected.persona.video_use_approved, false);
});

test("lock change and rights revocation fail closed without rewriting history", async () => {
  const seeded = await seedCurrentLock();
  const view = await getVideoIdentityReadinessView(scope, seeded.personaId);
  await submitVideoIdentityReview(scope, seeded.personaId, {
    operationId: "00000000-0000-4000-8000-000000000706",
    expectedIdentityLockSnapshotId: view.identityLockSnapshotId,
    expectedIdentityLockVersion: view.identityLockVersion,
    expectedIdentityFingerprint: view.identityFingerprint,
    expectedReferencePackageFingerprint: view.referencePackageFingerprint,
    checklist: allPassed,
    decision: "APPROVE",
  });
  await approveVideoUse(scope, seeded.personaId, {
    confirmVideoUseApproval: true,
  });
  await personas.updateReferenceAsset(scope, seeded.refs[0].id, {
    rights_confirmed: false,
  });
  const lockedWithRevokedRights = await resolveLockedBrandIdentity(
    scope,
    seeded.personaId,
  );
  const persona = await personas.getPersona(scope, seeded.personaId);
  assert.ok(persona && lockedWithRevokedRights);
  assert.equal(
    isCurrentVideoIdentityReady(persona, lockedWithRevokedRights),
    false,
  );
  const eligibility = (await import("../use-approvals/eligibility")).evaluateBrandModelEligibility({
    persona,
    lockedIdentity: lockedWithRevokedRights,
  });
  assert.equal(eligibility.videoEligible, false);
  await personas.updatePersona(scope, seeded.personaId, {
    identity_lock_version: 4,
  });
  const staleLock = await resolveLockedBrandIdentity(scope, seeded.personaId);
  const stalePersona = await personas.getPersona(scope, seeded.personaId);
  assert.equal(staleLock, null);
  assert.ok(stalePersona);
  assert.equal(isCurrentVideoIdentityReady(stalePersona, staleLock), false);
  assert.equal(isCurrentVideoUseApproved(stalePersona, staleLock), false);
  assert.equal((await reviews.listForPersona(scope, seeded.personaId)).length, 1);
});

test("generic Persona CRUD rejects protected Video authority fields", () => {
  assert.throws(() =>
    assertNoGovernedPersonaFields(
      {
        video_identity_ready: true,
        video_identity_review_id: "00000000-0000-4000-8000-000000000707",
        video_use_approved: true,
      },
      "update",
    ),
  );
});
