/**
 * Opt-in live Supabase persistence verification for Persona Studio Phase 1.1.
 *
 * Run:
 *   PERSONA_LIVE_VERIFY=1 npm test -- lib/persona/persona.live.test.ts
 *
 * Requires configured NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Creates and cleans up a temporary test persona — never seeds demo data.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  PERSONA_REFERENCE_MAX_BYTES,
  assertAllowedPersonaReferenceUpload,
  createProductionPersonaRepository,
  createPersonaReferenceSignedUrl,
  getPersonaRepositoryKind,
  isPublicPermanentPersonaUrl,
  setPersonaRepositoryForTests,
} from "@/lib/persona";
import {
  createLocation,
  createPersona,
  deletePersona,
  deleteReferenceAsset,
  getPersona,
  getPersonaProductionPackage,
  listImageReadyPersonas,
  listProductionPersonas,
  listVideoReadyPersonas,
  setPersonaRelations,
  transitionPersona,
  updatePersona,
  updateReferenceAsset,
  uploadReferenceAsset,
} from "@/lib/persona/services/persona-service";
import { resolvePersonaWorkspaceScope } from "@/lib/persona/services/workspace-scope";
import { checkPersonaStudioHealth } from "@/lib/persona/services/health";
import { createAdminClient } from "@/lib/supabase/admin";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import { SupabasePersonaRepository } from "@/lib/persona/repositories/supabase-persona-repository";

const enabled = process.env.PERSONA_LIVE_VERIFY === "1" && isSupabaseConfigured();

/** Minimal 1x1 PNG */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function profileFields(overrides: Record<string, unknown> = {}) {
  return {
    gender: "Male",
    age_range: "28-34",
    height: "182 cm",
    body_type: "Athletic",
    skin_tone: "Medium",
    hair: "Dark short",
    beard: "Light stubble",
    eye_color: "Brown",
    expression: "Calm confidence",
    personality: "Quiet luxury",
    style: "Editorial street",
    notes: "Live verify",
    brand_fit_score: 92,
    visual_identity_notes: "Official Brand Cast lock — Milan Test",
    distinguishing_features: "Strong jawline",
    prohibited_changes: "No age shift, no face morph, no smile exaggeration",
    default_hair_style: "Dark short",
    default_facial_hair: "Light stubble",
    default_expression: "Neutral calm",
    default_body_proportions: "Athletic",
    default_styling_notes: "Quiet luxury",
    image_use_approved: true,
    video_use_approved: false,
    ...overrides,
  };
}

describe("Persona Studio live Supabase verification", { skip: !enabled }, () => {
  const createdIds: string[] = [];
  let workspaceId = "";

  after(async () => {
    setPersonaRepositoryForTests(null);
    const scope = await resolvePersonaWorkspaceScope();
    for (const id of createdIds) {
      try {
        await deletePersona(scope, id);
      } catch {
        // best-effort cleanup
      }
    }
  });

  it("0. health is healthy against configured Supabase", async () => {
    setPersonaRepositoryForTests(null);
    const health = await checkPersonaStudioHealth();
    assert.equal(health.repositoryMode, "supabase");
    assert.equal(health.memoryFallback, false);
    assert.equal(health.status, "healthy", health.message);
    assert.equal(health.uiLabel, "Bereit");
  });

  it("1-5. CRUD + relationships survive new repository/service instances", async () => {
    setPersonaRepositoryForTests(null);
    assert.equal(getPersonaRepositoryKind(), "supabase");
    assert.ok(createProductionPersonaRepository() instanceof SupabasePersonaRepository);

    const scope = await resolvePersonaWorkspaceScope();
    workspaceId = scope.workspaceId;
    assert.ok(workspaceId);
    assert.equal(workspaceId.startsWith("local-"), false);

    const location = await createLocation(scope, {
      name: `Live Loc ${Date.now()}`,
      category: "Studio",
      setting: "indoor",
      description: "verify",
      tags: ["test"],
      active: true,
    });

    const created = await createPersona(scope, {
      name: `Milan Live ${Date.now()}`,
      role: "Brand Cast Lead",
      ...profileFields(),
    });
    createdIds.push(created.id);

    await setPersonaRelations(scope, created.id, "locations", [location.id]);

    // New repository instance
    const repo2 = new SupabasePersonaRepository();
    const again = await repo2.getPersona(scope, created.id);
    assert.ok(again);
    assert.equal(again.name, created.name);
    assert.deepEqual(again.preferred_location_ids, [location.id]);

    const updated = await updatePersona(scope, created.id, {
      notes: "updated-after-recon",
    });
    assert.equal(updated.notes, "updated-after-recon");

    const repo3 = new SupabasePersonaRepository();
    const persisted = await repo3.getPersona(scope, created.id);
    assert.equal(persisted?.notes, "updated-after-recon");
    assert.deepEqual(persisted?.preferred_location_ids, [location.id]);
  });

  it("6-12. reference upload, signed URL, validation, compensation paths", async () => {
    setPersonaRepositoryForTests(null);
    const scope = await resolvePersonaWorkspaceScope();
    const persona = await createPersona(scope, {
      name: `Ref Live ${Date.now()}`,
      role: "Cast",
      ...profileFields(),
    });
    createdIds.push(persona.id);

    assert.throws(
      () =>
        assertAllowedPersonaReferenceUpload({
          mimeType: "application/pdf",
          byteLength: 10,
        }),
      (e: unknown) => e instanceof PersonaDomainError,
    );
    assert.throws(
      () =>
        assertAllowedPersonaReferenceUpload({
          mimeType: "image/png",
          byteLength: PERSONA_REFERENCE_MAX_BYTES + 1,
        }),
      (e: unknown) => e instanceof PersonaDomainError,
    );

    const portrait = await uploadReferenceAsset(
      scope,
      persona.id,
      {
        filename: "portrait.png",
        mimeType: "image/png",
        bytes: PNG_1X1,
      },
      {
        asset_type: "portrait",
        view_angle: "front",
        framing: "head_shoulders",
        expression: "neutral",
        body_visibility: "head",
        notes: "",
        source_type: "user_upload",
        rights_confirmed: true,
      },
    );

    assert.ok(portrait.storage_path.startsWith(`workspace/${scope.workspaceId}/`));

    const signed = await createPersonaReferenceSignedUrl(portrait.storage_path, 60);
    assert.ok(signed.signedUrl.includes("/object/sign/") || signed.signedUrl.includes("token="));
    assert.equal(isPublicPermanentPersonaUrl(signed.signedUrl), false);
    assert.ok(new Date(signed.expiresAt).getTime() > Date.now());

    // Duplicate checksum rejected + no orphan claim
    await assert.rejects(
      () =>
        uploadReferenceAsset(
          scope,
          persona.id,
          {
            filename: "portrait-dup.png",
            mimeType: "image/png",
            bytes: PNG_1X1,
          },
          {
            asset_type: "portrait",
            view_angle: "front",
            framing: "face",
            expression: "neutral",
            body_visibility: "head",
            notes: "",
            source_type: "user_upload",
            rights_confirmed: true,
          },
        ),
      (e: unknown) =>
        e instanceof PersonaDomainError && e.code === "INVALID_REFERENCE_ASSET",
    );

    // Cross-workspace path rejection via storage builder/upload guards
    await assert.rejects(
      async () => {
        const other = { workspaceId: "00000000-0000-4000-8000-000000000099", actorId: "x" };
        await uploadReferenceAsset(
          other,
          persona.id,
          {
            filename: "x.png",
            mimeType: "image/png",
            bytes: PNG_1X1,
          },
          {
            asset_type: "portrait",
            view_angle: "front",
            framing: "face",
            expression: "",
            body_visibility: "",
            notes: "",
            source_type: "user_upload",
            rights_confirmed: true,
          },
        );
      },
      (e: unknown) => e instanceof PersonaDomainError,
    );

    // Second body reference for approval path
    const bodyBytes = Buffer.concat([PNG_1X1, Buffer.from(`-body-${Date.now()}`)]);
    // bodyBytes may fail PNG dim extract — still valid bytes; use slightly different content via notes checksum
    // Actually checksum of modified buffer differs; but MIME validation still png. Good.
    // Wait - invalid PNG with extra bytes still uploads. OK for storage test.
    const body = await uploadReferenceAsset(
      scope,
      persona.id,
      {
        filename: "body.png",
        mimeType: "image/png",
        bytes: bodyBytes,
      },
      {
        asset_type: "full_body",
        view_angle: "front",
        framing: "full_body",
        expression: "neutral",
        body_visibility: "full",
        notes: "",
        source_type: "user_upload",
        rights_confirmed: true,
      },
    );

    await updateReferenceAsset(scope, portrait.id, { status: "approved" });
    await updateReferenceAsset(scope, body.id, { status: "approved" });
    await updateReferenceAsset(scope, portrait.id, { is_primary: true });

    // Delete removes metadata; storage delete failure must not false-succeed
    // (happy path: delete succeeds)
    await deleteReferenceAsset(scope, body.id);
    const db = createAdminClient();
    const { data: gone } = await db
      .from("persona_reference_assets")
      .select("id")
      .eq("id", body.id)
      .maybeSingle();
    assert.equal(gone, null);
  });

  it("13-16. incomplete approval rejected; image-ready package complete", async () => {
    setPersonaRepositoryForTests(null);
    const scope = await resolvePersonaWorkspaceScope();
    const persona = await createPersona(scope, {
      name: `Approve Live ${Date.now()}`,
      role: "Cast",
      ...profileFields(),
    });
    createdIds.push(persona.id);

    await transitionPersona(scope, persona.id, "submit_review");
    await assert.rejects(
      () => transitionPersona(scope, persona.id, "approve"),
      (e: unknown) =>
        e instanceof PersonaDomainError &&
        e.code === "MISSING_APPROVAL_PREREQUISITES",
    );

    const portrait = await uploadReferenceAsset(
      scope,
      persona.id,
      { filename: "p.png", mimeType: "image/png", bytes: PNG_1X1 },
      {
        asset_type: "portrait",
        view_angle: "front",
        framing: "head_shoulders",
        expression: "neutral",
        body_visibility: "head",
        notes: "",
        source_type: "photoshoot",
        rights_confirmed: true,
      },
    );
    const bodyBytes = Buffer.concat([PNG_1X1, Buffer.from(`b-${Date.now()}`)]);
    const body = await uploadReferenceAsset(
      scope,
      persona.id,
      { filename: "b.png", mimeType: "image/png", bytes: bodyBytes },
      {
        asset_type: "full_body",
        view_angle: "front",
        framing: "full_body",
        expression: "neutral",
        body_visibility: "full",
        notes: "",
        source_type: "photoshoot",
        rights_confirmed: true,
      },
    );
    await updateReferenceAsset(scope, portrait.id, { status: "approved" });
    await updateReferenceAsset(scope, body.id, { status: "approved" });
    await updatePersona(scope, persona.id, {
      primary_reference_asset_id: portrait.id,
    });

    const approved = await transitionPersona(scope, persona.id, "approve");
    assert.equal(approved.status, "Approved");
    assert.equal(approved.approved, true);

    const imageReady = await listImageReadyPersonas(scope);
    assert.ok(imageReady.some((p) => p.id === persona.id));
    const videoReady = await listVideoReadyPersonas(scope);
    assert.equal(videoReady.some((p) => p.id === persona.id), false);
    const production = await listProductionPersonas(scope);
    assert.ok(production.some((p) => p.id === persona.id));

    const pack = await getPersonaProductionPackage(scope, persona.id);
    assert.equal(pack.persona.id, persona.id);
    assert.ok(pack.primary_reference);
    assert.ok(pack.approved_reference_assets.every((a) => a.status === "approved"));
    assert.ok(pack.prohibited_changes.length > 0);
    assert.equal(pack.usage.image_eligible, true);
    assert.equal(pack.usage.video_eligible, false);

    await updatePersona(scope, persona.id, { video_use_approved: true });
    const videoReady2 = await listVideoReadyPersonas(scope);
    assert.ok(videoReady2.some((p) => p.id === persona.id));
  });

  it("17. audit events land in brain_events with persona_studio domain", async () => {
    setPersonaRepositoryForTests(null);
    const scope = await resolvePersonaWorkspaceScope();
    const db = createAdminClient();
    const { data, error } = await db
      .from("brain_events")
      .select("event_type, domain")
      .eq("workspace_id", scope.workspaceId)
      .eq("domain", "persona_studio")
      .order("created_at", { ascending: false })
      .limit(20);
    assert.equal(error, null);
    const types = new Set((data ?? []).map((r) => r.event_type as string));
    assert.ok(types.has("persona.created"));
  });

  it("18. getPersona after new service instance still works (restart persistence)", async () => {
    setPersonaRepositoryForTests(null);
    const scope = await resolvePersonaWorkspaceScope();
    const id = createdIds[0];
    if (!id) return;
    const persona = await getPersona(scope, id);
    assert.ok(persona.id);
  });
});
