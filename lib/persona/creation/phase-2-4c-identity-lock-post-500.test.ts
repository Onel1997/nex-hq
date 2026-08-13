/**
 * Phase 2.4C — Identity Lock POST 500 root-cause regression.
 * No OpenAI / FLUX / provider calls.
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
  REFERENCE_PACKAGE_SLOTS,
  lockBrandIdentity,
  coerceUuidOrNull,
  IdentityLockError,
} from "@/lib/persona";
import { getIdentityLockRepository } from "@/lib/persona/creation/identity-lock/repository";
import type { CreateIdentityLockSnapshotInput } from "@/lib/persona/creation/identity-lock/types";
import {
  buildMasterIdentityNotes,
} from "@/lib/persona/creation/master-identity-reference";
import { buildReferencePackageAssetNotes } from "@/lib/persona/creation/reference-package/types";
import type { WorkspaceScope } from "@/lib/persona/domain/types";

const ROOT = process.cwd();
const WS = "ws-phase-24c";
const scope: WorkspaceScope = {
  workspaceId: WS,
  actorId: "workspace-user", // exact live failure actor label
};

describe("Phase 2.4C Identity Lock POST 500 fix", () => {
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
  });

  async function seedEligiblePersona() {
    const persona = await personaRepo.createPersona(scope, {
      name: "Lock Target",
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
      brand_fit_score: 0,
      visual_identity_notes: "notes",
      distinguishing_features: "",
      prohibited_changes: "none",
      default_hair_style: "short",
      default_facial_hair: "",
      default_expression: "neutral",
      default_body_proportions: "lean",
      default_styling_notes: "street",
      source_creation_project_id: "acde560f-321f-4821-9a6f-1654a5bf8f90",
      source_candidate_id: "ded0b150-b3b1-4ab7-af97-6277777c6444",
      primary_reference_asset_id: null,
    });

    await personaRepo.updatePersona(scope, persona.id, {
      identity_lock_status: "collecting_references",
      source_candidate_id: "ded0b150-b3b1-4ab7-af97-6277777c6444",
      source_creation_project_id: "acde560f-321f-4821-9a6f-1654a5bf8f90",
    });
    const fresh = (await personaRepo.getPersona(scope, persona.id))!;

    const master = await personaRepo.createReferenceAsset(scope, {
      persona_id: fresh.id,
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
        source_candidate_id: "ded0b150-b3b1-4ab7-af97-6277777c6444",
        source_candidate_asset_id: "a4438bfc-b54c-4cb2-8bc5-593644276981",
        source_creation_project_id: "acde560f-321f-4821-9a6f-1654a5bf8f90",
        label: "MASTER IDENTITY REFERENCE",
        subtitle: "Original selected Brand Face",
      }),
    });
    await personaRepo.updatePersona(scope, fresh.id, {
      primary_reference_asset_id: master.id,
    });

    const session = await pkgRepo.createSession(scope, {
      persona_id: fresh.id,
      master_reference_id: master.id,
      confirmation_token: "tok",
      estimate_hash: createHash("sha256").update("pkg").digest("hex"),
      estimated_cost_min: 0,
      estimated_cost_max: 0,
      max_authorized_spend: 0,
      image_count: 5,
    });

    const slotAssets: Record<string, string> = {};
    for (const slot of REFERENCE_PACKAGE_SLOTS) {
      const created = await personaRepo.createReferenceAsset(scope, {
        persona_id: fresh.id,
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
      slotAssets[slot] = created.id;
      const row = await pkgRepo.createAttempt(scope, {
        persona_id: fresh.id,
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

    return { persona: fresh, master, slotAssets };
  }

  it("0. coerceUuidOrNull rejects workspace-user (root cause)", () => {
    assert.equal(coerceUuidOrNull("workspace-user"), null);
    assert.equal(
      coerceUuidOrNull("ded0b150-b3b1-4ab7-af97-6277777c6444"),
      "ded0b150-b3b1-4ab7-af97-6277777c6444",
    );
  });

  it("1–6. eligible 5/5 locks; snapshot + persona + six assets + fingerprint", async () => {
    const { persona, master, slotAssets } = await seedEligiblePersona();
    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(locked.providerCalled, false);
    assert.equal(locked.persona.identity_lock_status, "approved");
    assert.equal(locked.persona.image_identity_ready, true);
    assert.ok(locked.persona.identity_locked_at);
    assert.equal(locked.snapshot.master_reference_asset_id, master.id);
    assert.equal(locked.snapshot.front_asset_id, slotAssets.front);
    assert.equal(locked.snapshot.canonical_references.length, 5);
    assert.equal(locked.snapshot.reference_package_fingerprint.length, 64);
    assert.equal(locked.snapshot.identity_locked_by, null); // workspace-user coerced
    const ids = new Set([
      locked.snapshot.master_reference_asset_id,
      locked.snapshot.front_asset_id,
      locked.snapshot.three_quarter_left_asset_id,
      locked.snapshot.three_quarter_right_asset_id,
      locked.snapshot.left_profile_asset_id,
      locked.snapshot.right_profile_asset_id,
    ]);
    assert.equal(ids.size, 6);
  });

  it("7. optional novelty failure does not 500", async () => {
    const { persona } = await seedEligiblePersona();
    // Memory creation repo → promotion skipped_non_supabase / skipped_no_record.
    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(locked.persona.identity_lock_status, "approved");
    assert.ok(
      locked.historicalProtectionPromotion === "skipped_non_supabase" ||
        locked.historicalProtectionPromotion === "skipped_no_record",
    );
  });

  it("8. core DB failure does fail closed with staged error", async () => {
    const { persona } = await seedEligiblePersona();
    const failing = {
      kind: "memory" as const,
      async createSnapshot() {
        const err = new Error('invalid input syntax for type uuid: "workspace-user"');
        Object.assign(err, { code: "22P02" });
        throw err;
      },
      async getLatestSnapshotForPersona() {
        return null;
      },
      async getSnapshotByVersion() {
        return null;
      },
    };
    setIdentityLockRepositoryForTests(failing as never);
    await assert.rejects(
      () =>
        lockBrandIdentity(scope, persona.id, { confirmIdentityLock: true }),
      (err: unknown) =>
        err instanceof IdentityLockError &&
        err.stage === "snapshot_insert" &&
        /uuid/i.test(err.message),
    );
    const after = await personaRepo.getPersona(scope, persona.id);
    assert.notEqual(after?.identity_lock_status, "approved");
  });

  it("9. partial snapshot recovers idempotently", async () => {
    const { persona, master, slotAssets } = await seedEligiblePersona();
    // Simulate snapshot written but persona update never completed.
    await lockRepo.createSnapshot(scope, {
      persona_id: persona.id,
      source_candidate_id: persona.source_candidate_id,
      source_creation_project_id: persona.source_creation_project_id,
      master_reference_asset_id: master.id,
      master_checksum: "chk-master",
      front_asset_id: slotAssets.front,
      three_quarter_left_asset_id: slotAssets.three_quarter_left,
      three_quarter_right_asset_id: slotAssets.three_quarter_right,
      left_profile_asset_id: slotAssets.left_profile,
      right_profile_asset_id: slotAssets.right_profile,
      canonical_references: REFERENCE_PACKAGE_SLOTS.map((slot) => ({
        slot,
        assetId: slotAssets[slot]!,
        checksum: `chk-${slot}`,
        provenance: "machine_match" as const,
        identitySourceConfidence: "machine_match" as const,
        referenceProvenance: "generated" as const,
        effectiveSlot: slot,
      })),
      identity_lock_version: 2,
      identity_locked_at: new Date().toISOString(),
      identity_locked_by: null,
      reference_package_version: "reference-package-reconciler-v1.0.0",
      reference_package_fingerprint: "a".repeat(64),
      provenance_counts: {
        machineMatchCount: 5,
        warningApprovedCount: 0,
        mismatchOverrideCount: 0,
        derivedReferenceCount: 0,
        reassignedCount: 0,
        replacementApprovedCount: 0,
      },
      policy_version: "identity-lock-v1.0.0",
    } satisfies CreateIdentityLockSnapshotInput);

    const recovered = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.persona.identity_lock_status, "approved");
    assert.equal(recovered.persona.image_identity_ready, true);

    const snaps = await getIdentityLockRepository().getLatestSnapshotForPersona(
      scope,
      persona.id,
    );
    assert.ok(snaps);
    // Still a single latest snapshot (version 2).
    assert.equal(snaps!.identity_lock_version, 2);
  });

  it("10–12. repeated confirm creates no duplicate snapshot; already locked returns existing", async () => {
    const { persona } = await seedEligiblePersona();
    const first = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    const second = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(second.alreadyLocked, true);
    assert.equal(second.snapshot.id, first.snapshot.id);
    assert.equal(second.snapshot.identity_lock_version, first.snapshot.identity_lock_version);

    // Memory repo only keeps map entries — count unique for persona.
    const latest = await lockRepo.getLatestSnapshotForPersona(scope, persona.id);
    assert.equal(latest?.id, first.snapshot.id);
  });

  it("13–14. UI failure keeps unlock CTA; success reloads (source assertions)", () => {
    const ui = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(ui, /identity-lock-error/);
    assert.match(ui, /setLockError/);
    assert.match(ui, /onLocked\(\)/);
    assert.match(ui, /stage=\$\{body\.stage\}/);
  });

  it("15–17. no provider / references untouched / no discovery changes", async () => {
    const { persona } = await seedEligiblePersona();
    const beforeRefs = await personaRepo.listReferenceAssets(scope, persona.id);
    const locked = await lockBrandIdentity(scope, persona.id, {
      confirmIdentityLock: true,
    });
    assert.equal(locked.providerCalled, false);
    const afterRefs = await personaRepo.listReferenceAssets(scope, persona.id);
    assert.equal(afterRefs.length, beforeRefs.length);
    for (const ref of beforeRefs) {
      const after = afterRefs.find((a) => a.id === ref.id);
      assert.equal(after?.storage_path, ref.storage_path);
      assert.equal(after?.checksum, ref.checksum);
    }
    const src = readFileSync(
      join(ROOT, "lib/persona/creation/identity-lock/identity-lock-service.ts"),
      "utf8",
    );
    assert.doesNotMatch(src, /openai|flux|discovery/i);
    assert.match(src, /coerceUuidOrNull/);
  });

  it("route returns structured stage/requestId on failure", () => {
    const route = readFileSync(
      join(ROOT, "app/api/persona/[id]/identity-lock/route.ts"),
      "utf8",
    );
    assert.match(route, /stage/);
    assert.match(route, /requestId/);
    assert.match(route, /identityLockErrorResponse/);
  });
});
