/**
 * Phase 2.3C — Master Identity Reference from original selected candidate asset.
 * No paid provider calls. No image regeneration. No file duplication.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  convertCandidateToPersona,
  createCreationProject,
  ensureManualCandidateSlots,
  requestStageBReferencePackage,
  updateCandidateReview,
  uploadManualCandidateAsset,
} from "@/lib/persona/creation/creation-service";
import {
  ensureMasterIdentityReferenceFromSelectedCandidate,
  findMasterIdentityReference,
  isMasterIdentityReference,
  parseMasterIdentityNotes,
  MASTER_IDENTITY_REFERENCE_TYPE,
  MASTER_IDENTITY_SOURCE,
} from "@/lib/persona/creation/master-identity-reference";
import {
  MemoryCreationRepository,
  MemoryPersonaRepository,
  setCreationRepositoryForTests,
  setPersonaRepositoryForTests,
} from "@/lib/persona";
import type { WorkspaceScope } from "@/lib/persona/domain/types";

const ROOT = process.cwd();
const WS = "ws-phase-23c";
const scope: WorkspaceScope = { workspaceId: WS, actorId: "tester-23c" };

/** Live IDs — referenced for recovery contracts; not hit in unit tests. */
const LIVE_CANDIDATE_B_ID = "ded0b150-b3b1-4ab7-af97-6277777c6444";
const LIVE_ASSET_ID = "a4438bfc-b54c-4cb2-8bc5-593644276981";
const LIVE_PERSONA_ID = "724778f9-10df-4b27-8c49-ad4c18eaf5d5";

function tinyPng(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

const projectInput = {
  name: "OBF 2.3C",
  description: "master identity",
  gender_presentation: "Male",
  age_range: "22-25",
  height_range: "180",
  body_type: "Lean",
  skin_tone_direction: "",
  face_shape_direction: "",
  hair_direction: "",
  facial_hair_direction: "",
  eye_direction: "",
  expression_direction: "",
  personality: "",
  fashion_style: "streetwear",
  brand_role: "primary_male" as const,
  visual_keywords: "",
  preferred_brand_looks: "",
  preferred_outfits: "",
  intended_usage: "image_and_video" as const,
  candidate_count: 1,
  provider_mode: "manual_upload" as const,
  additional_description: "",
  excluded_features: "",
};

describe("Phase 2.3C Master Identity Reference", () => {
  let creationRepo: MemoryCreationRepository;
  let personaRepo: MemoryPersonaRepository;

  beforeEach(() => {
    creationRepo = new MemoryCreationRepository();
    personaRepo = new MemoryPersonaRepository();
    setCreationRepositoryForTests(creationRepo);
    setPersonaRepositoryForTests(personaRepo);
  });

  afterEach(() => {
    setCreationRepositoryForTests(null);
    setPersonaRepositoryForTests(null);
  });

  async function convertSelected(): Promise<{
    personaId: string;
    candidateId: string;
    candidateAssetId: string;
    candidateStoragePath: string;
  }> {
    const project = await createCreationProject(scope, projectInput);
    const [candidate] = await ensureManualCandidateSlots(scope, project.id);
    const asset = await uploadManualCandidateAsset(
      scope,
      candidate.id,
      { bytes: tinyPng(), mimeType: "image/png", filename: "front.png" },
      { asset_type: "portrait_front", is_primary: true },
    );
    await creationRepo.updateCandidate(scope, candidate.id, {
      status: "ready",
      provider: "openai",
      primary_preview_asset_id: asset.id,
    });
    await updateCandidateReview(scope, candidate.id, { status: "selected" });
    const { persona } = await convertCandidateToPersona(scope, candidate.id);
    return {
      personaId: persona.id,
      candidateId: candidate.id,
      candidateAssetId: asset.id,
      candidateStoragePath: asset.storage_path,
    };
  }

  it("links original candidate storage_path as sole Master Identity Reference", async () => {
    const ctx = await convertSelected();
    const persona = await personaRepo.getPersona(scope, ctx.personaId);
    assert.ok(persona);
    assert.equal(persona.status, "Draft");
    assert.equal(persona.image_identity_ready, false);
    assert.notEqual(persona.identity_lock_status, "locked");

    const refs = await personaRepo.listReferenceAssets(scope, ctx.personaId);
    const masters = refs.filter((r) => isMasterIdentityReference(r));
    assert.equal(masters.length, 1);

    const master = findMasterIdentityReference(refs)!;
    assert.equal(master.storage_path, ctx.candidateStoragePath);
    assert.equal(master.is_primary, true);
    assert.equal(persona.primary_reference_asset_id, master.id);

    const meta = parseMasterIdentityNotes(master.notes)!;
    assert.equal(meta.source, MASTER_IDENTITY_SOURCE);
    assert.equal(meta.reference_type, MASTER_IDENTITY_REFERENCE_TYPE);
    assert.equal(meta.primary_identity_reference, true);
    assert.equal(meta.immutable_source_reference, true);
    assert.equal(meta.original_provider, "openai");
    assert.equal(meta.source_candidate_asset_id, ctx.candidateAssetId);
    assert.equal(meta.label, "MASTER IDENTITY REFERENCE");
    assert.equal(meta.subtitle, "Original selected Brand Face");

    // Original candidate asset untouched.
    const candidateAssets = await creationRepo.listCandidateAssets(
      scope,
      ctx.candidateId,
    );
    assert.equal(candidateAssets.length, 1);
    assert.equal(candidateAssets[0].id, ctx.candidateAssetId);
    assert.equal(candidateAssets[0].storage_path, ctx.candidateStoragePath);
  });

  it("ensure is idempotent — never duplicates master reference", async () => {
    const ctx = await convertSelected();
    const first = await ensureMasterIdentityReferenceFromSelectedCandidate(
      scope,
      ctx.personaId,
      { preferredCandidateAssetId: ctx.candidateAssetId },
    );
    assert.equal(first.alreadyLinked, true);

    const second = await ensureMasterIdentityReferenceFromSelectedCandidate(
      scope,
      ctx.personaId,
      { preferredCandidateAssetId: ctx.candidateAssetId },
    );
    assert.equal(second.alreadyLinked, true);
    assert.equal(second.reference.id, first.reference.id);

    const refs = await personaRepo.listReferenceAssets(scope, ctx.personaId);
    assert.equal(refs.filter((r) => isMasterIdentityReference(r)).length, 1);
  });

  it("alreadyConverted convert path heals master without second persona", async () => {
    const ctx = await convertSelected();
    const again = await convertCandidateToPersona(scope, ctx.candidateId);
    assert.equal(again.alreadyConverted, true);
    assert.equal(again.persona.id, ctx.personaId);

    const refs = await personaRepo.listReferenceAssets(scope, ctx.personaId);
    assert.equal(refs.filter((r) => isMasterIdentityReference(r)).length, 1);
  });

  it("Stage B records Master Identity as identitySource", async () => {
    const ctx = await convertSelected();
    const result = await requestStageBReferencePackage(scope, ctx.candidateId);
    assert.equal(result.automaticExpansion, false);
    assert.ok(result.masterIdentityReferenceAssetId);

    const candidate = await creationRepo.getCandidate(scope, ctx.candidateId);
    assert.ok(candidate);
    assert.equal(candidate.status, "selected");
    assert.equal(
      candidate.generation_settings?.identitySource,
      "master_identity_reference",
    );
    assert.equal(
      candidate.generation_settings?.masterIdentityReferenceAssetId,
      result.masterIdentityReferenceAssetId,
    );
  });

  it("UI surfaces MASTER IDENTITY REFERENCE copy", () => {
    const studio = readFileSync(
      join(ROOT, "components/persona/persona-studio.tsx"),
      "utf8",
    );
    assert.match(studio, /MASTER-IDENTITÄTSREFERENZ/);
    assert.match(studio, /Original selected Brand Face/);
    assert.match(studio, /master-identity-reference/);
  });

  it("documents live Candidate B / asset / persona ids for recovery", () => {
    assert.match(LIVE_CANDIDATE_B_ID, /^ded0b150-/);
    assert.match(LIVE_ASSET_ID, /^a4438bfc-/);
    assert.match(LIVE_PERSONA_ID, /^724778f9-/);
  });
});
