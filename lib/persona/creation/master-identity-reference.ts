/**
 * Phase 2.3C — Master Identity Reference (selected Brand Face portrait).
 *
 * Links the original selected-candidate asset storage object into the Persona
 * Reference Library WITHOUT duplicating the file. Future Stage B angles may
 * strengthen Identity Lock but must never replace this master.
 */

import type {
  Persona,
  PersonaReferenceAsset,
  WorkspaceScope,
} from "@/lib/persona/domain/types";
import type { PersonaCandidateAsset } from "@/lib/persona/domain/creation-types";
import { PersonaDomainError } from "@/lib/persona/domain/errors";
import { getCreationRepository } from "@/lib/persona/creation/creation-factory";
import { getPersonaRepository } from "@/lib/persona/repositories/factory";

export const MASTER_IDENTITY_REFERENCE_TYPE = "identity_master" as const;
export const MASTER_IDENTITY_SOURCE = "selected_candidate" as const;

export type MasterIdentityReferenceMeta = {
  version: 1;
  source: typeof MASTER_IDENTITY_SOURCE;
  reference_type: typeof MASTER_IDENTITY_REFERENCE_TYPE;
  primary_identity_reference: true;
  immutable_source_reference: true;
  original_provider: string;
  source_candidate_id: string;
  source_candidate_asset_id: string;
  source_creation_project_id: string | null;
  label: "MASTER IDENTITY REFERENCE";
  subtitle: "Original selected Brand Face";
};

const MASTER_NOTES_PREFIX = "MASTER_IDENTITY_REF_V1:";

export function buildMasterIdentityNotes(
  meta: MasterIdentityReferenceMeta,
): string {
  return `${MASTER_NOTES_PREFIX}${JSON.stringify(meta)}`;
}

export function parseMasterIdentityNotes(
  notes: string | null | undefined,
): MasterIdentityReferenceMeta | null {
  if (!notes || !notes.startsWith(MASTER_NOTES_PREFIX)) return null;
  try {
    const raw = JSON.parse(notes.slice(MASTER_NOTES_PREFIX.length)) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const m = raw as Partial<MasterIdentityReferenceMeta>;
    if (m.version !== 1) return null;
    if (m.source !== MASTER_IDENTITY_SOURCE) return null;
    if (m.reference_type !== MASTER_IDENTITY_REFERENCE_TYPE) return null;
    if (m.primary_identity_reference !== true) return null;
    if (m.immutable_source_reference !== true) return null;
    if (typeof m.source_candidate_id !== "string") return null;
    if (typeof m.source_candidate_asset_id !== "string") return null;
    if (typeof m.original_provider !== "string") return null;
    return {
      version: 1,
      source: MASTER_IDENTITY_SOURCE,
      reference_type: MASTER_IDENTITY_REFERENCE_TYPE,
      primary_identity_reference: true,
      immutable_source_reference: true,
      original_provider: m.original_provider,
      source_candidate_id: m.source_candidate_id,
      source_candidate_asset_id: m.source_candidate_asset_id,
      source_creation_project_id:
        typeof m.source_creation_project_id === "string"
          ? m.source_creation_project_id
          : null,
      label: "MASTER IDENTITY REFERENCE",
      subtitle: "Original selected Brand Face",
    };
  } catch {
    return null;
  }
}

export function isMasterIdentityReference(
  asset: Pick<PersonaReferenceAsset, "notes" | "is_primary">,
): boolean {
  return parseMasterIdentityNotes(asset.notes) != null;
}

export function findMasterIdentityReference(
  refs: readonly PersonaReferenceAsset[],
): PersonaReferenceAsset | null {
  const masters = refs.filter((r) => isMasterIdentityReference(r));
  if (masters.length === 0) return null;
  // Prefer the primary pointer when multiple (should not happen).
  return masters.find((r) => r.is_primary) ?? masters[0] ?? null;
}

function creationRepo() {
  return getCreationRepository();
}

function personaRepo() {
  return getPersonaRepository();
}

function resolveOriginalCandidateAsset(
  assets: readonly PersonaCandidateAsset[],
  preferredAssetId: string | null,
): PersonaCandidateAsset | null {
  if (preferredAssetId) {
    const exact = assets.find((a) => a.id === preferredAssetId);
    if (exact && (exact.status === "ready" || exact.status === "uploaded")) {
      return exact;
    }
  }
  const primary =
    assets.find(
      (a) =>
        a.is_primary &&
        (a.status === "ready" || a.status === "uploaded") &&
        a.asset_type === "portrait_front",
    ) ??
    assets.find(
      (a) =>
        (a.status === "ready" || a.status === "uploaded") &&
        a.asset_type === "portrait_front",
    ) ??
    assets.find((a) => a.is_primary && (a.status === "ready" || a.status === "uploaded"));
  return primary ?? null;
}

export type EnsureMasterIdentityResult = {
  persona: Persona;
  reference: PersonaReferenceAsset;
  candidateAsset: PersonaCandidateAsset;
  alreadyLinked: boolean;
  created: boolean;
};

/**
 * Idempotently link the original selected-candidate portrait as the Persona's
 * Master Identity Reference. Reuses the candidate storage_path — no file copy.
 */
export async function ensureMasterIdentityReferenceFromSelectedCandidate(
  scope: WorkspaceScope,
  personaId: string,
  options?: {
    /** Prefer this candidate asset id (e.g. live OpenAI asset). */
    preferredCandidateAssetId?: string | null;
  },
): Promise<EnsureMasterIdentityResult> {
  const persona = await personaRepo().getPersona(scope, personaId);
  if (!persona) {
    throw new PersonaDomainError("Persona not found", "NOT_FOUND", { personaId });
  }
  if (!persona.source_candidate_id) {
    throw new PersonaDomainError(
      "Persona has no source_candidate_id — cannot link Master Identity Reference.",
      "WORKFLOW",
      { personaId },
    );
  }

  const candidate = await creationRepo().getCandidate(
    scope,
    persona.source_candidate_id,
  );
  if (!candidate) {
    throw new PersonaDomainError("Source candidate not found", "NOT_FOUND", {
      candidateId: persona.source_candidate_id,
    });
  }

  const candidateAssets = await creationRepo().listCandidateAssets(
    scope,
    candidate.id,
  );
  const preferredId =
    options?.preferredCandidateAssetId ??
    candidate.primary_preview_asset_id ??
    null;
  const candidateAsset = resolveOriginalCandidateAsset(
    candidateAssets,
    preferredId,
  );
  if (!candidateAsset) {
    throw new PersonaDomainError(
      "Original candidate portrait asset not found.",
      "NOT_FOUND",
      { candidateId: candidate.id, preferredId },
    );
  }

  const refs = await personaRepo().listReferenceAssets(scope, personaId);
  const existingMaster = findMasterIdentityReference(refs);

  const meta: MasterIdentityReferenceMeta = {
    version: 1,
    source: MASTER_IDENTITY_SOURCE,
    reference_type: MASTER_IDENTITY_REFERENCE_TYPE,
    primary_identity_reference: true,
    immutable_source_reference: true,
    original_provider: candidate.provider || "unknown",
    source_candidate_id: candidate.id,
    source_candidate_asset_id: candidateAsset.id,
    source_creation_project_id: persona.source_creation_project_id,
    label: "MASTER IDENTITY REFERENCE",
    subtitle: "Original selected Brand Face",
  };
  const notes = buildMasterIdentityNotes(meta);

  // Idempotent: already linked to this exact candidate asset + storage path.
  if (
    existingMaster &&
    parseMasterIdentityNotes(existingMaster.notes)?.source_candidate_asset_id ===
      candidateAsset.id &&
    existingMaster.storage_path === candidateAsset.storage_path &&
    existingMaster.is_primary &&
    persona.primary_reference_asset_id === existingMaster.id
  ) {
    return {
      persona,
      reference: existingMaster,
      candidateAsset,
      alreadyLinked: true,
      created: false,
    };
  }

  // Prefer upgrading the existing master or current primary portrait — never create a second master.
  let target =
    existingMaster ??
    refs.find((r) => r.id === persona.primary_reference_asset_id) ??
    refs.find((r) => r.is_primary && r.asset_type === "portrait") ??
    refs.find((r) => r.asset_type === "portrait") ??
    null;

  let created = false;
  if (!target) {
    target = await personaRepo().createReferenceAsset(scope, {
      persona_id: personaId,
      asset_type: "portrait",
      storage_path: candidateAsset.storage_path,
      mime_type: candidateAsset.mime_type,
      width: candidateAsset.width,
      height: candidateAsset.height,
      file_size_bytes: candidateAsset.file_size_bytes,
      checksum: candidateAsset.checksum,
      view_angle: "front",
      framing: "face",
      expression: "neutral",
      body_visibility: "partial",
      notes,
      source_type: "generated_external",
      rights_confirmed: false,
      status: "uploaded",
      is_primary: true,
    });
    created = true;
  } else {
    target = await personaRepo().updateReferenceAsset(scope, target.id, {
      storage_path: candidateAsset.storage_path,
      mime_type: candidateAsset.mime_type,
      width: candidateAsset.width,
      height: candidateAsset.height,
      file_size_bytes: candidateAsset.file_size_bytes,
      checksum: candidateAsset.checksum,
      asset_type: "portrait",
      view_angle: "front",
      framing: "face",
      notes,
      source_type: "generated_external",
      // Keep uploaded — do not auto-approve / image_ready.
      status: target.status === "archived" ? "uploaded" : target.status,
      is_primary: true,
      rights_confirmed: false,
    });
  }

  // Ensure exactly one primary / master.
  for (const ref of refs) {
    if (ref.id === target.id) continue;
    if (ref.is_primary || isMasterIdentityReference(ref)) {
      await personaRepo().updateReferenceAsset(scope, ref.id, {
        is_primary: false,
        // Demote accidental duplicate master notes.
        notes: isMasterIdentityReference(ref)
          ? `Superseded master link — see ${target.id}`
          : ref.notes,
      });
    }
  }

  const updatedPersona = await personaRepo().updatePersona(scope, personaId, {
    primary_reference_asset_id: target.id,
    // Do not approve / lock / image_ready.
  });

  return {
    persona: updatedPersona,
    reference: target,
    candidateAsset,
    alreadyLinked: false,
    created,
  };
}

/**
 * Resolve the Master Identity Reference for Stage B / future angle generation.
 * Never invents a new image — returns null if missing.
 */
export async function getMasterIdentityReferenceForPersona(
  scope: WorkspaceScope,
  personaId: string,
): Promise<{
  reference: PersonaReferenceAsset;
  meta: MasterIdentityReferenceMeta;
} | null> {
  const refs = await personaRepo().listReferenceAssets(scope, personaId);
  const master = findMasterIdentityReference(refs);
  if (!master) return null;
  const meta = parseMasterIdentityNotes(master.notes);
  if (!meta) return null;
  return { reference: master, meta };
}
