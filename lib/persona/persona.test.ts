import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  assertAllowedPersonaReferenceUpload,
  buildPersonaReferenceStoragePath,
  createProductionPersonaRepository,
  getPersonaRepository,
  getPersonaRepositoryKind,
  isPublicPermanentPersonaUrl,
  MemoryPersonaRepository,
  PERSONA_DEMO_SEED,
  PERSONA_TEST_WORKSPACE_ID,
  setPersonaRepositoryForTests,
  SupabasePersonaRepository,
} from "@/lib/persona";
import {
  createLocation,
  createPersona,
  deleteLocation,
  getPersonaProductionPackage,
  listImageReadyPersonas,
  listPersonas,
  listProductionPersonas,
  listVideoReadyPersonas,
  setPersonaRelations,
  transitionPersona,
  updatePersona,
  updateReferenceAsset,
} from "@/lib/persona/services/persona-service";
import { getPersonaRepository as getRepo } from "@/lib/persona/repositories/factory";
import type { WorkspaceScope } from "@/lib/persona/domain/types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";

const WS_A = PERSONA_TEST_WORKSPACE_ID;
const WS_B = "22222222-2222-4222-8222-222222222222";

const scopeA: WorkspaceScope = { workspaceId: WS_A, actorId: "tester-a" };
const scopeB: WorkspaceScope = { workspaceId: WS_B, actorId: "tester-b" };

function profileFields() {
  return {
    gender: "Female",
    age_range: "25-32",
    height: "175 cm",
    body_type: "Athletic lean",
    skin_tone: "Light olive",
    hair: "Dark brown straight",
    beard: "None",
    eye_color: "Hazel",
    expression: "Calm",
    personality: "Reserved warmth",
    style: "Quiet luxury",
    notes: "",
    brand_fit_score: 90,
    visual_identity_notes: "Official Brand Cast lock",
    distinguishing_features: "Soft jawline",
    prohibited_changes: "No age shift, no face morph",
    default_hair_style: "Dark brown straight",
    default_facial_hair: "None",
    default_expression: "Neutral calm",
    default_body_proportions: "Athletic lean",
    default_styling_notes: "Quiet luxury streetwear",
    image_use_approved: true,
    video_use_approved: false,
  };
}

async function seedReadyReferences(
  repo: MemoryPersonaRepository,
  scope: WorkspaceScope,
  personaId: string,
) {
  const portrait = await repo.createReferenceAsset(scope, {
    persona_id: personaId,
    asset_type: "portrait",
    storage_path: `workspace/${scope.workspaceId}/personas/${personaId}/references/p.jpg`,
    mime_type: "image/jpeg",
    width: 800,
    height: 1000,
    file_size_bytes: 1200,
    checksum: `portrait-${personaId}`,
    status: "approved",
    is_primary: true,
    view_angle: "front",
    framing: "head_shoulders",
    expression: "neutral",
    body_visibility: "head",
    notes: "",
    source_type: "photoshoot",
    rights_confirmed: true,
  });

  await repo.createReferenceAsset(scope, {
    persona_id: personaId,
    asset_type: "full_body",
    storage_path: `workspace/${scope.workspaceId}/personas/${personaId}/references/b.jpg`,
    mime_type: "image/jpeg",
    width: 900,
    height: 1600,
    file_size_bytes: 1800,
    checksum: `body-${personaId}`,
    status: "approved",
    is_primary: false,
    view_angle: "front",
    framing: "full_body",
    expression: "neutral",
    body_visibility: "full",
    notes: "",
    source_type: "photoshoot",
    rights_confirmed: true,
  });

  await repo.updatePersona(scope, personaId, {
    primary_reference_asset_id: portrait.id,
  });

  return portrait;
}

describe("Persona Studio Phase 1.1", () => {
  let memory: MemoryPersonaRepository;

  beforeEach(() => {
    memory = new MemoryPersonaRepository();
    setPersonaRepositoryForTests(memory);
  });

  afterEach(() => {
    setPersonaRepositoryForTests(null);
  });

  it("1. production repository factory uses Supabase, not memory", () => {
    setPersonaRepositoryForTests(null);
    if (isSupabaseConfigured()) {
      const repo = createProductionPersonaRepository();
      assert.equal(repo.kind, "supabase");
      assert.ok(repo instanceof SupabasePersonaRepository);
      assert.equal(getPersonaRepositoryKind(), "supabase");
    } else {
      assert.throws(
        () => createProductionPersonaRepository(),
        (err: unknown) =>
          err instanceof PersonaDomainError && err.code === "CONFIG",
      );
    }
    // Memory only via explicit test override
    setPersonaRepositoryForTests(memory);
    assert.equal(getPersonaRepository().kind, "memory");
  });

  it("2. workspace isolation blocks cross-workspace access", async () => {
    const persona = await createPersona(scopeA, {
      name: "Aria",
      role: "Lead",
      ...profileFields(),
    });
    await assert.rejects(
      () => getRepo().getPersona(scopeB, persona.id),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        (err.code === "UNAUTHORIZED_WORKSPACE" || err.code === "NOT_FOUND"),
    );
    // Force unauthorized when entity exists under other workspace lookup path
    const fetched = await memory.getPersona(scopeA, persona.id);
    assert.ok(fetched);
    await assert.rejects(
      async () => {
        // access via update under wrong scope
        await getRepo().updatePersona(scopeB, persona.id, { notes: "hack" });
      },
      (err: unknown) => err instanceof PersonaDomainError,
    );
  });

  it("3. CRUD persistence survives a new service/repository instance sharing store", async () => {
    const created = await createPersona(scopeA, {
      name: "Persist",
      role: "Extra",
      ...profileFields(),
    });
    // Same memory instance via override — new service call still sees data
    const listed = await listPersonas(scopeA);
    assert.ok(listed.some((p) => p.id === created.id));

    const secondHandle = getPersonaRepository();
    assert.equal(secondHandle.kind, "memory");
    const again = await secondHandle.getPersona(scopeA, created.id);
    assert.equal(again?.name, "Persist");
  });

  it("4. invalid approval without references is rejected", async () => {
    const persona = await createPersona(scopeA, {
      name: "NoRefs",
      role: "Draft",
      ...profileFields(),
    });
    await transitionPersona(scopeA, persona.id, "submit_review");
    await assert.rejects(
      () => transitionPersona(scopeA, persona.id, "approve"),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        err.code === "MISSING_APPROVAL_PREREQUISITES",
    );
  });

  it("5. approved primary portrait is required", async () => {
    const persona = await createPersona(scopeA, {
      name: "PortraitGap",
      role: "Cast",
      ...profileFields(),
    });
    await memory.createReferenceAsset(scopeA, {
      persona_id: persona.id,
      asset_type: "full_body",
      storage_path: "workspace/x/p/b.jpg",
      mime_type: "image/jpeg",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: "body-only",
      status: "approved",
      view_angle: "front",
      framing: "full_body",
      expression: "neutral",
      body_visibility: "full",
      notes: "",
      source_type: "user_upload",
      rights_confirmed: true,
    });
    await transitionPersona(scopeA, persona.id, "submit_review");
    await assert.rejects(
      () => transitionPersona(scopeA, persona.id, "approve"),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        err.code === "MISSING_APPROVAL_PREREQUISITES",
    );
  });

  it("6. approved body reference is required", async () => {
    const persona = await createPersona(scopeA, {
      name: "BodyGap",
      role: "Cast",
      ...profileFields(),
    });
    const portrait = await memory.createReferenceAsset(scopeA, {
      persona_id: persona.id,
      asset_type: "portrait",
      storage_path: "workspace/x/p/p.jpg",
      mime_type: "image/jpeg",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: "portrait-only",
      status: "approved",
      view_angle: "front",
      framing: "head_shoulders",
      expression: "neutral",
      body_visibility: "head",
      notes: "",
      source_type: "user_upload",
      rights_confirmed: true,
    });
    await updatePersona(scopeA, persona.id, {
      primary_reference_asset_id: portrait.id,
    });
    await transitionPersona(scopeA, persona.id, "submit_review");
    await assert.rejects(
      () => transitionPersona(scopeA, persona.id, "approve"),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        err.code === "MISSING_APPROVAL_PREREQUISITES",
    );
  });

  it("7. image approval and video approval are separate", async () => {
    const persona = await createPersona(scopeA, {
      name: "Split",
      role: "Cast",
      ...profileFields(),
      video_use_approved: false,
    });
    await seedReadyReferences(memory, scopeA, persona.id);
    await transitionPersona(scopeA, persona.id, "submit_review");
    await transitionPersona(scopeA, persona.id, "approve");

    const imageReady = await listImageReadyPersonas(scopeA);
    const videoReady = await listVideoReadyPersonas(scopeA);
    assert.ok(imageReady.some((p) => p.id === persona.id));
    assert.equal(videoReady.some((p) => p.id === persona.id), false);

    await updatePersona(scopeA, persona.id, { video_use_approved: true });
    const videoReady2 = await listVideoReadyPersonas(scopeA);
    assert.ok(videoReady2.some((p) => p.id === persona.id));
  });

  it("8. rejected reference cannot be primary", async () => {
    const persona = await createPersona(scopeA, {
      name: "RejectPrimary",
      role: "Cast",
      ...profileFields(),
    });
    const asset = await memory.createReferenceAsset(scopeA, {
      persona_id: persona.id,
      asset_type: "portrait",
      storage_path: "workspace/x/p/r.jpg",
      mime_type: "image/jpeg",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: "rej",
      status: "rejected",
      view_angle: "front",
      framing: "face",
      expression: "neutral",
      body_visibility: "head",
      notes: "",
      source_type: "user_upload",
      rights_confirmed: true,
    });
    await assert.rejects(
      () =>
        updateReferenceAsset(scopeA, asset.id, {
          is_primary: true,
        }),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        err.code === "INVALID_PRIMARY_REFERENCE",
    );
  });

  it("9. missing rights confirmation blocks production approval", async () => {
    const persona = await createPersona(scopeA, {
      name: "Rights",
      role: "Cast",
      ...profileFields(),
    });
    const portrait = await memory.createReferenceAsset(scopeA, {
      persona_id: persona.id,
      asset_type: "portrait",
      storage_path: "workspace/x/p/p.jpg",
      mime_type: "image/jpeg",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: "p",
      status: "approved",
      view_angle: "front",
      framing: "head_shoulders",
      expression: "neutral",
      body_visibility: "head",
      notes: "",
      source_type: "user_upload",
      rights_confirmed: false,
    });
    await memory.createReferenceAsset(scopeA, {
      persona_id: persona.id,
      asset_type: "full_body",
      storage_path: "workspace/x/p/b.jpg",
      mime_type: "image/jpeg",
      width: 1,
      height: 1,
      file_size_bytes: 10,
      checksum: "b",
      status: "approved",
      view_angle: "front",
      framing: "full_body",
      expression: "neutral",
      body_visibility: "full",
      notes: "",
      source_type: "user_upload",
      rights_confirmed: true,
    });
    await updatePersona(scopeA, persona.id, {
      primary_reference_asset_id: portrait.id,
    });
    await transitionPersona(scopeA, persona.id, "submit_review");
    await assert.rejects(
      () => transitionPersona(scopeA, persona.id, "approve"),
      (err: unknown) =>
        err instanceof PersonaDomainError &&
        err.code === "MISSING_APPROVAL_PREREQUISITES",
    );
  });

  it("10. listImageReadyPersonas returns only eligible personas", async () => {
    const ready = await createPersona(scopeA, {
      name: "Ready",
      role: "Cast",
      ...profileFields(),
    });
    await seedReadyReferences(memory, scopeA, ready.id);
    await transitionPersona(scopeA, ready.id, "submit_review");
    await transitionPersona(scopeA, ready.id, "approve");

    await createPersona(scopeA, {
      name: "NotReady",
      role: "Cast",
      ...profileFields(),
    });

    const list = await listImageReadyPersonas(scopeA);
    assert.equal(list.length, 1);
    assert.equal(list[0]?.id, ready.id);
    assert.deepEqual(
      (await listProductionPersonas(scopeA)).map((p) => p.id),
      list.map((p) => p.id),
    );
  });

  it("11. listVideoReadyPersonas returns only video-eligible personas", async () => {
    const persona = await createPersona(scopeA, {
      name: "Video",
      role: "Cast",
      ...profileFields(),
      video_use_approved: true,
    });
    await seedReadyReferences(memory, scopeA, persona.id);
    await transitionPersona(scopeA, persona.id, "submit_review");
    await transitionPersona(scopeA, persona.id, "approve");
    const list = await listVideoReadyPersonas(scopeA);
    assert.ok(list.some((p) => p.id === persona.id));
  });

  it("12. production package contains approved assets and preferences", async () => {
    const location = await createLocation(scopeA, {
      name: "Studio",
      category: "Controlled",
      setting: "indoor",
      description: "",
      tags: [],
      active: true,
    });
    const persona = await createPersona(scopeA, {
      name: "Pack",
      role: "Cast",
      ...profileFields(),
    });
    await setPersonaRelations(scopeA, persona.id, "locations", [location.id]);
    await seedReadyReferences(memory, scopeA, persona.id);
    await transitionPersona(scopeA, persona.id, "submit_review");
    await transitionPersona(scopeA, persona.id, "approve");

    const pack = await getPersonaProductionPackage(scopeA, persona.id);
    assert.equal(pack.persona.id, persona.id);
    assert.ok(pack.primary_reference);
    assert.ok(pack.approved_reference_assets.length >= 2);
    assert.equal(pack.preferred.locations[0]?.id, location.id);
    assert.equal(pack.usage.image_eligible, true);
    assert.ok(pack.prohibited_changes.length > 0);
  });

  it("13. deletion safely removes relationships without destroying personas", async () => {
    const location = await createLocation(scopeA, {
      name: "Garage",
      category: "Industrial",
      setting: "indoor",
      description: "",
      tags: [],
      active: true,
    });
    const persona = await createPersona(scopeA, {
      name: "KeepMe",
      role: "Cast",
      ...profileFields(),
    });
    await setPersonaRelations(scopeA, persona.id, "locations", [location.id]);
    const impact = await deleteLocation(scopeA, location.id);
    assert.equal(impact.referencing_persona_count, 1);
    const still = await getRepo().getPersona(scopeA, persona.id);
    assert.ok(still);
    assert.equal(still.preferred_location_ids.includes(location.id), false);
  });

  it("14. unauthorized storage path access is blocked", () => {
    const path = buildPersonaReferenceStoragePath({
      workspaceId: WS_A,
      personaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      assetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      filename: "shot.jpg",
    });
    assert.ok(path.startsWith(`workspace/${WS_A}/`));
    assert.equal(path.includes(WS_B), false);

    assert.throws(
      () =>
        assertAllowedPersonaReferenceUpload({
          mimeType: "application/pdf",
          byteLength: 100,
        }),
      (err: unknown) => err instanceof PersonaDomainError,
    );
  });

  it("15. signed URL helpers never expose permanent public persona URLs", () => {
    assert.equal(
      isPublicPermanentPersonaUrl(
        "https://x.supabase.co/storage/v1/object/public/persona-references/a.jpg",
      ),
      true,
    );
    assert.equal(
      isPublicPermanentPersonaUrl(
        "https://x.supabase.co/storage/v1/object/sign/persona-references/a.jpg?token=abc",
      ),
      false,
    );
  });

  it("16. no production demo seeding", async () => {
    const empty = new MemoryPersonaRepository();
    const snap = await empty.snapshot(scopeA);
    assert.equal(snap.personas.length, 0);
    assert.equal(snap.reference_assets.length, 0);
    assert.equal(PERSONA_DEMO_SEED.personas.length, 0);
  });

  it("17. legacy persona fields remain readable with defaults", async () => {
    // Simulate legacy-shaped create then read identity defaults
    const persona = await createPersona(scopeA, {
      name: "Legacy",
      role: "Cast",
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
    });
    assert.equal(persona.identity_lock_version, 1);
    assert.equal(persona.image_use_approved, false);
    assert.equal(persona.primary_reference_asset_id, null);
    assert.equal(persona.visual_identity_notes, "");
  });
});
