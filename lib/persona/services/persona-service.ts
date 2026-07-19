/**
 * Persona Studio service — single domain entry point.
 * UI → API → this service → repository (Supabase in production).
 */

import { randomUUID } from "node:crypto";
import { logPersonaAuditEvent } from "../audit/persona-events";
import {
  applyPersonaStatus,
  canTransitionPersonaStatus,
} from "../approval/workflow";
import { PersonaDomainError } from "../domain/errors";
import {
  canApprovePersona,
  computePersonaReadiness,
  listApprovalPrerequisiteGaps,
} from "../domain/readiness";
import type {
  BrandLook,
  CameraPreset,
  CreateBrandLookInput,
  CreateCameraPresetInput,
  CreateLocationInput,
  CreateOutfitInput,
  CreatePersonaInput,
  CreatePoseInput,
  LibraryDeleteImpact,
  Location,
  Outfit,
  Persona,
  PersonaProductionPackage,
  PersonaReferenceAsset,
  PersonaReferenceAssetView,
  PersonaRelationKind,
  PersonaRelations,
  PersonaStudioDashboardCounts,
  PersonaStudioSnapshot,
  Pose,
  UpdateBrandLookInput,
  UpdateCameraPresetInput,
  UpdateLocationInput,
  UpdateOutfitInput,
  UpdatePersonaInput,
  UpdatePoseInput,
  UpdateReferenceAssetInput,
  WorkspaceScope,
} from "../domain/types";
import { getPersonaRepository } from "../repositories/factory";
import type { PersonaRepository } from "../repositories/persona-repository";
import {
  createPersonaReferenceSignedUrl,
  deletePersonaReferenceObject,
  uploadPersonaReferenceBytes,
} from "../storage/reference-storage";

function repo(): PersonaRepository {
  return getPersonaRepository();
}

async function requirePersona(
  scope: WorkspaceScope,
  id: string,
): Promise<Persona> {
  const persona = await repo().getPersona(scope, id);
  if (!persona) {
    throw new PersonaDomainError(`Persona not found: ${id}`, "NOT_FOUND");
  }
  return persona;
}

export async function getPersonaStudioSnapshot(
  scope: WorkspaceScope,
): Promise<PersonaStudioSnapshot> {
  return repo().snapshot(scope);
}

export async function getPersonaDashboardCounts(
  scope: WorkspaceScope,
): Promise<PersonaStudioDashboardCounts> {
  return repo().dashboardCounts(scope);
}

export async function listPersonas(scope: WorkspaceScope): Promise<Persona[]> {
  return repo().listPersonas(scope);
}

export async function getPersona(
  scope: WorkspaceScope,
  id: string,
): Promise<Persona> {
  return requirePersona(scope, id);
}

export async function createPersona(
  scope: WorkspaceScope,
  input: CreatePersonaInput,
): Promise<Persona> {
  if (input.status === "Approved") {
    throw new PersonaDomainError(
      "Personas cannot be created as Approved without reference prerequisites.",
      "MISSING_APPROVAL_PREREQUISITES",
    );
  }

  const persona = await repo().createPersona(scope, {
    ...input,
    status: input.status ?? "Draft",
    created_by: input.created_by ?? scope.actorId ?? null,
  });

  try {
    await logPersonaAuditEvent({
      workspaceId: scope.workspaceId,
      eventType: "persona.created",
      recordId: persona.id,
      actorId: scope.actorId,
      payload: { name: persona.name, status: persona.status },
    });
  } catch {
    // audit best-effort
  }

  return persona;
}

export async function updatePersona(
  scope: WorkspaceScope,
  id: string,
  patch: UpdatePersonaInput,
): Promise<Persona> {
  const current = await requirePersona(scope, id);

  if (patch.status && patch.status !== current.status) {
    if (!canTransitionPersonaStatus(current.status, patch.status)) {
      throw new PersonaDomainError(
        `Cannot transition persona from ${current.status} to ${patch.status}`,
        "WORKFLOW",
      );
    }
    if (patch.status === "Approved") {
      const assets = await repo().listReferenceAssets(scope, id);
      const gaps = listApprovalPrerequisiteGaps(
        { ...current, ...patch, status: current.status },
        assets,
      );
      if (gaps.length > 0) {
        throw new PersonaDomainError(
          "Freigabevoraussetzungen nicht erfüllt.",
          "MISSING_APPROVAL_PREREQUISITES",
          { missing: gaps },
        );
      }
    }
  }

  if (patch.primary_reference_asset_id) {
    const asset = await repo().getReferenceAsset(
      scope,
      patch.primary_reference_asset_id,
    );
    if (!asset || asset.persona_id !== id) {
      throw new PersonaDomainError(
        "Ungültige Primärreferenz.",
        "INVALID_PRIMARY_REFERENCE",
      );
    }
    if (asset.status === "rejected" || asset.status === "archived") {
      throw new PersonaDomainError(
        "Abgelehnte oder archivierte Referenzen können nicht primär sein.",
        "INVALID_PRIMARY_REFERENCE",
      );
    }
  }

  return repo().updatePersona(scope, id, patch);
}

export async function deletePersona(
  scope: WorkspaceScope,
  id: string,
): Promise<void> {
  const assets = await repo().listReferenceAssets(scope, id);
  for (const asset of assets) {
    try {
      await deletePersonaReferenceObject(asset.storage_path);
    } catch {
      // continue deleting DB rows
    }
  }
  await repo().deletePersona(scope, id);
}

export async function setPersonaRelations(
  scope: WorkspaceScope,
  personaId: string,
  kind: PersonaRelationKind,
  ids: string[],
): Promise<Persona> {
  return repo().setPersonaRelations(scope, personaId, kind, ids);
}

export async function resolvePersonaRelations(
  scope: WorkspaceScope,
  personaId: string,
): Promise<PersonaRelations> {
  const persona = await requirePersona(scope, personaId);
  const [locations, cameras, poses, looks, outfits] = await Promise.all([
    repo().listLocations(scope),
    repo().listCameraPresets(scope),
    repo().listPoses(scope),
    repo().listBrandLooks(scope),
    repo().listOutfits(scope),
  ]);

  const pick = <T extends { id: string }>(all: T[], ids: string[]) =>
    ids.map((id) => all.find((x) => x.id === id)).filter((x): x is T => Boolean(x));

  return {
    locations: pick(locations, persona.preferred_location_ids),
    camera_presets: pick(cameras, persona.preferred_camera_preset_ids),
    poses: pick(poses, persona.preferred_pose_ids),
    brand_looks: pick(looks, persona.preferred_brand_look_ids),
    outfits: pick(outfits, persona.preferred_outfit_ids),
  };
}

export async function transitionPersona(
  scope: WorkspaceScope,
  id: string,
  action: "submit_review" | "approve" | "archive" | "reopen_draft",
): Promise<Persona> {
  const persona = await requirePersona(scope, id);
  const target =
    action === "submit_review"
      ? "Review"
      : action === "approve"
        ? "Approved"
        : action === "archive"
          ? "Archived"
          : "Draft";

  if (!canTransitionPersonaStatus(persona.status, target)) {
    throw new PersonaDomainError(
      `Cannot transition persona from ${persona.status} to ${target}`,
      "WORKFLOW",
    );
  }

  if (target === "Approved") {
    const assets = await repo().listReferenceAssets(scope, id);
    if (!canApprovePersona(persona, assets)) {
      throw new PersonaDomainError(
        "Freigabevoraussetzungen nicht erfüllt.",
        "MISSING_APPROVAL_PREREQUISITES",
        { missing: listApprovalPrerequisiteGaps(persona, assets) },
      );
    }
  }

  const next = applyPersonaStatus(persona, target);
  const updated = await repo().updatePersona(scope, id, {
    status: next.status,
  });

  const eventType =
    action === "submit_review"
      ? "persona.submitted_for_review"
      : action === "approve"
        ? "persona.approved"
        : action === "archive"
          ? "persona.archived"
          : null;

  if (eventType) {
    try {
      await logPersonaAuditEvent({
        workspaceId: scope.workspaceId,
        eventType,
        recordId: id,
        actorId: scope.actorId,
      });
    } catch {
      // best-effort
    }
  }

  return updated;
}

export async function getPersonaReadiness(scope: WorkspaceScope, id: string) {
  const persona = await requirePersona(scope, id);
  const assets = await repo().listReferenceAssets(scope, id);
  return computePersonaReadiness(persona, assets);
}

export async function listImageReadyPersonas(
  scope: WorkspaceScope,
): Promise<Persona[]> {
  const personas = await repo().listPersonas(scope);
  const ready: Persona[] = [];
  for (const persona of personas) {
    const assets = await repo().listReferenceAssets(scope, persona.id);
    const report = computePersonaReadiness(persona, assets);
    if (report.image_ready) ready.push(persona);
  }
  return ready;
}

export async function listVideoReadyPersonas(
  scope: WorkspaceScope,
): Promise<Persona[]> {
  const personas = await repo().listPersonas(scope);
  const ready: Persona[] = [];
  for (const persona of personas) {
    const assets = await repo().listReferenceAssets(scope, persona.id);
    const report = computePersonaReadiness(persona, assets);
    if (report.video_ready) ready.push(persona);
  }
  return ready;
}

/** Production-eligible personas (image-ready baseline). */
export async function listProductionPersonas(
  scope: WorkspaceScope,
): Promise<Persona[]> {
  return listImageReadyPersonas(scope);
}

export async function getPersonaProductionPackage(
  scope: WorkspaceScope,
  personaId: string,
): Promise<PersonaProductionPackage> {
  const persona = await requirePersona(scope, personaId);
  const assets = await repo().listReferenceAssets(scope, personaId);
  const readiness = computePersonaReadiness(persona, assets);
  const preferred = await resolvePersonaRelations(scope, personaId);
  const approved = assets.filter(
    (a) => a.status === "approved" && a.rights_confirmed,
  );
  const primary =
    approved.find((a) => a.id === persona.primary_reference_asset_id) ?? null;

  return {
    persona,
    readiness,
    approved_reference_assets: approved,
    primary_reference: primary,
    preferred,
    prohibited_changes: persona.prohibited_changes,
    usage: {
      image_eligible: readiness.image_ready,
      video_eligible: readiness.video_ready,
    },
  };
}

// --- Libraries ---

export async function listLocations(scope: WorkspaceScope): Promise<Location[]> {
  return repo().listLocations(scope);
}
export async function getLocation(scope: WorkspaceScope, id: string): Promise<Location> {
  const item = await repo().getLocation(scope, id);
  if (!item) throw new PersonaDomainError(`Location not found: ${id}`, "NOT_FOUND");
  return item;
}
export async function createLocation(
  scope: WorkspaceScope,
  input: CreateLocationInput,
): Promise<Location> {
  return repo().createLocation(scope, {
    ...input,
    created_by: input.created_by ?? scope.actorId ?? null,
  });
}
export async function updateLocation(
  scope: WorkspaceScope,
  id: string,
  patch: UpdateLocationInput,
): Promise<Location> {
  return repo().updateLocation(scope, id, patch);
}
export async function deleteLocation(
  scope: WorkspaceScope,
  id: string,
): Promise<LibraryDeleteImpact> {
  const impact = await repo().countPersonasReferencingLocation(scope, id);
  await repo().deleteLocation(scope, id);
  return impact;
}
export async function previewLocationDelete(
  scope: WorkspaceScope,
  id: string,
): Promise<LibraryDeleteImpact> {
  return repo().countPersonasReferencingLocation(scope, id);
}

export async function listCameraPresets(scope: WorkspaceScope): Promise<CameraPreset[]> {
  return repo().listCameraPresets(scope);
}
export async function getCameraPreset(scope: WorkspaceScope, id: string): Promise<CameraPreset> {
  const item = await repo().getCameraPreset(scope, id);
  if (!item) throw new PersonaDomainError(`Camera preset not found: ${id}`, "NOT_FOUND");
  return item;
}
export async function createCameraPreset(
  scope: WorkspaceScope,
  input: CreateCameraPresetInput,
): Promise<CameraPreset> {
  return repo().createCameraPreset(scope, {
    ...input,
    created_by: input.created_by ?? scope.actorId ?? null,
  });
}
export async function updateCameraPreset(
  scope: WorkspaceScope,
  id: string,
  patch: UpdateCameraPresetInput,
): Promise<CameraPreset> {
  return repo().updateCameraPreset(scope, id, patch);
}
export async function deleteCameraPreset(
  scope: WorkspaceScope,
  id: string,
): Promise<LibraryDeleteImpact> {
  const impact = await repo().countPersonasReferencingCameraPreset(scope, id);
  await repo().deleteCameraPreset(scope, id);
  return impact;
}

export async function listPoses(scope: WorkspaceScope): Promise<Pose[]> {
  return repo().listPoses(scope);
}
export async function getPose(scope: WorkspaceScope, id: string): Promise<Pose> {
  const item = await repo().getPose(scope, id);
  if (!item) throw new PersonaDomainError(`Pose not found: ${id}`, "NOT_FOUND");
  return item;
}
export async function createPose(
  scope: WorkspaceScope,
  input: CreatePoseInput,
): Promise<Pose> {
  return repo().createPose(scope, {
    ...input,
    created_by: input.created_by ?? scope.actorId ?? null,
  });
}
export async function updatePose(
  scope: WorkspaceScope,
  id: string,
  patch: UpdatePoseInput,
): Promise<Pose> {
  return repo().updatePose(scope, id, patch);
}
export async function deletePose(
  scope: WorkspaceScope,
  id: string,
): Promise<LibraryDeleteImpact> {
  const impact = await repo().countPersonasReferencingPose(scope, id);
  await repo().deletePose(scope, id);
  return impact;
}

export async function listBrandLooks(scope: WorkspaceScope): Promise<BrandLook[]> {
  return repo().listBrandLooks(scope);
}
export async function getBrandLook(scope: WorkspaceScope, id: string): Promise<BrandLook> {
  const item = await repo().getBrandLook(scope, id);
  if (!item) throw new PersonaDomainError(`Brand look not found: ${id}`, "NOT_FOUND");
  return item;
}
export async function createBrandLook(
  scope: WorkspaceScope,
  input: CreateBrandLookInput,
): Promise<BrandLook> {
  return repo().createBrandLook(scope, {
    ...input,
    created_by: input.created_by ?? scope.actorId ?? null,
  });
}
export async function updateBrandLook(
  scope: WorkspaceScope,
  id: string,
  patch: UpdateBrandLookInput,
): Promise<BrandLook> {
  return repo().updateBrandLook(scope, id, patch);
}
export async function deleteBrandLook(
  scope: WorkspaceScope,
  id: string,
): Promise<LibraryDeleteImpact> {
  const impact = await repo().countPersonasReferencingBrandLook(scope, id);
  await repo().deleteBrandLook(scope, id);
  return impact;
}

export async function listOutfits(scope: WorkspaceScope): Promise<Outfit[]> {
  return repo().listOutfits(scope);
}
export async function getOutfit(scope: WorkspaceScope, id: string): Promise<Outfit> {
  const item = await repo().getOutfit(scope, id);
  if (!item) throw new PersonaDomainError(`Outfit not found: ${id}`, "NOT_FOUND");
  return item;
}
export async function createOutfit(
  scope: WorkspaceScope,
  input: CreateOutfitInput,
): Promise<Outfit> {
  return repo().createOutfit(scope, {
    ...input,
    created_by: input.created_by ?? scope.actorId ?? null,
  });
}
export async function updateOutfit(
  scope: WorkspaceScope,
  id: string,
  patch: UpdateOutfitInput,
): Promise<Outfit> {
  return repo().updateOutfit(scope, id, patch);
}
export async function deleteOutfit(
  scope: WorkspaceScope,
  id: string,
): Promise<LibraryDeleteImpact> {
  const impact = await repo().countPersonasReferencingOutfit(scope, id);
  await repo().deleteOutfit(scope, id);
  return impact;
}

// --- Reference library ---

export async function listReferenceAssets(
  scope: WorkspaceScope,
  personaId: string,
): Promise<PersonaReferenceAsset[]> {
  await requirePersona(scope, personaId);
  return repo().listReferenceAssets(scope, personaId);
}

export async function listReferenceAssetViews(
  scope: WorkspaceScope,
  personaId: string,
): Promise<PersonaReferenceAssetView[]> {
  const assets = await listReferenceAssets(scope, personaId);
  const views: PersonaReferenceAssetView[] = [];
  for (const asset of assets) {
    try {
      const signed = await createPersonaReferenceSignedUrl(asset.storage_path);
      views.push({
        ...asset,
        signed_url: signed.signedUrl,
        signed_url_expires_at: signed.expiresAt,
      });
    } catch {
      views.push({
        ...asset,
        signed_url: null,
        signed_url_expires_at: null,
      });
    }
  }
  return views;
}

export async function uploadReferenceAsset(
  scope: WorkspaceScope,
  personaId: string,
  file: {
    filename: string;
    mimeType: string;
    bytes: Buffer;
  },
  meta: {
    asset_type: PersonaReferenceAsset["asset_type"];
    view_angle: PersonaReferenceAsset["view_angle"];
    framing: PersonaReferenceAsset["framing"];
    expression: string;
    body_visibility: string;
    notes: string;
    source_type: PersonaReferenceAsset["source_type"];
    rights_confirmed: boolean;
  },
): Promise<PersonaReferenceAsset> {
  await requirePersona(scope, personaId);
  const assetId = randomUUID();

  const uploaded = await uploadPersonaReferenceBytes({
    workspaceId: scope.workspaceId,
    personaId,
    assetId,
    filename: file.filename,
    bytes: file.bytes,
    mimeType: file.mimeType,
  });

  const existing = await repo().findReferenceByChecksum(
    scope,
    personaId,
    uploaded.checksum,
  );
  if (existing) {
    try {
      await deletePersonaReferenceObject(uploaded.storagePath);
    } catch {
      // Compensating cleanup best-effort for duplicate upload object.
    }
    throw new PersonaDomainError(
      "Diese Datei wurde bereits hochgeladen (Checksumme).",
      "INVALID_REFERENCE_ASSET",
      { existingId: existing.id },
    );
  }

  let asset;
  try {
    asset = await repo().createReferenceAsset(scope, {
      persona_id: personaId,
      asset_type: meta.asset_type,
      storage_path: uploaded.storagePath,
      mime_type: file.mimeType,
      width: uploaded.width,
      height: uploaded.height,
      file_size_bytes: file.bytes.length,
      checksum: uploaded.checksum,
      status: "uploaded",
      is_primary: false,
      view_angle: meta.view_angle,
      framing: meta.framing,
      expression: meta.expression,
      body_visibility: meta.body_visibility,
      notes: meta.notes,
      source_type: meta.source_type,
      rights_confirmed: meta.rights_confirmed,
      created_by: scope.actorId ?? null,
    });
  } catch (error) {
    // Compensation: storage upload succeeded but DB insert failed — remove object.
    try {
      await deletePersonaReferenceObject(uploaded.storagePath);
    } catch {
      // best-effort cleanup
    }
    if (error instanceof PersonaDomainError) throw error;
    throw new PersonaDomainError(
      error instanceof Error
        ? `Referenz-Metadaten konnten nicht gespeichert werden: ${error.message}`
        : "Referenz-Metadaten konnten nicht gespeichert werden.",
      "STORAGE_UPLOAD_FAILED",
      { storagePath: uploaded.storagePath },
    );
  }

  try {
    await logPersonaAuditEvent({
      workspaceId: scope.workspaceId,
      eventType: "persona.reference_uploaded",
      recordId: personaId,
      actorId: scope.actorId,
      payload: { assetId: asset.id },
    });
  } catch {
    // best-effort
  }

  return asset;
}

export async function updateReferenceAsset(
  scope: WorkspaceScope,
  id: string,
  patch: UpdateReferenceAssetInput,
): Promise<PersonaReferenceAsset> {
  const current = await repo().getReferenceAsset(scope, id);
  if (!current) {
    throw new PersonaDomainError(`Reference asset not found: ${id}`, "NOT_FOUND");
  }

  if (patch.is_primary === true && (patch.status === "rejected" || current.status === "rejected")) {
    throw new PersonaDomainError(
      "Abgelehnte Referenzen können nicht primär sein.",
      "INVALID_PRIMARY_REFERENCE",
    );
  }

  if (patch.status === "rejected" && (patch.is_primary || current.is_primary)) {
    throw new PersonaDomainError(
      "Primäre Referenzen können nicht abgelehnt werden, ohne die Primärzuordnung zu entfernen.",
      "INVALID_PRIMARY_REFERENCE",
    );
  }

  const updated = await repo().updateReferenceAsset(scope, id, patch);

  if (patch.is_primary === true) {
    await repo().updatePersona(scope, current.persona_id, {
      primary_reference_asset_id: id,
    });
    try {
      await logPersonaAuditEvent({
        workspaceId: scope.workspaceId,
        eventType: "persona.primary_reference_changed",
        recordId: current.persona_id,
        actorId: scope.actorId,
        payload: { assetId: id },
      });
    } catch {
      // best-effort
    }
  }

  if (patch.status === "approved") {
    try {
      await logPersonaAuditEvent({
        workspaceId: scope.workspaceId,
        eventType: "persona.reference_approved",
        recordId: current.persona_id,
        actorId: scope.actorId,
        payload: { assetId: id },
      });
    } catch {
      // best-effort
    }
  }
  if (patch.status === "rejected") {
    try {
      await logPersonaAuditEvent({
        workspaceId: scope.workspaceId,
        eventType: "persona.reference_rejected",
        recordId: current.persona_id,
        actorId: scope.actorId,
        payload: { assetId: id },
      });
    } catch {
      // best-effort
    }
  }

  return updated;
}

export async function deleteReferenceAsset(
  scope: WorkspaceScope,
  id: string,
): Promise<void> {
  const current = await repo().getReferenceAsset(scope, id);
  if (!current) {
    throw new PersonaDomainError(`Reference asset not found: ${id}`, "NOT_FOUND");
  }

  const persona = await requirePersona(scope, current.persona_id);
  if (persona.primary_reference_asset_id === id) {
    await repo().updatePersona(scope, persona.id, {
      primary_reference_asset_id: null,
    });
  }

  // Storage first — if delete fails, keep DB row and surface error (no false success).
  try {
    await deletePersonaReferenceObject(current.storage_path);
  } catch (error) {
    throw new PersonaDomainError(
      error instanceof Error
        ? `Löschen fehlgeschlagen: ${error.message}`
        : "Speicherobjekt konnte nicht gelöscht werden. Datenbankzeile bleibt erhalten.",
      "STORAGE_DELETE_FAILED",
      { storagePath: current.storage_path, assetId: id },
    );
  }

  try {
    await repo().deleteReferenceAsset(scope, id);
  } catch (error) {
    // Compensation note: storage object already removed; DB row orphan would remain.
    // Surface failure — do not claim success.
    throw new PersonaDomainError(
      error instanceof Error
        ? `Metadaten nach Speicherlöschung nicht entfernt: ${error.message}`
        : "Metadaten nach Speicherlöschung nicht entfernt.",
      "STORAGE_DELETE_FAILED",
      { storagePath: current.storage_path, assetId: id, orphanDbRow: true },
    );
  }
}

export { PersonaDomainError };
