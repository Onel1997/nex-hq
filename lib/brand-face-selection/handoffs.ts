/**
 * Future studio handoffs — read-only interfaces.
 * Do NOT implement Image Studio or Video Studio.
 * These helpers never invoke provider/OpenAI APIs.
 */

import {
  recommendArchetypeForCampaign,
  recommendArchetypeForVideo,
  loadBrandArchetypeCatalog,
  type CampaignRecommendationInput,
  type VideoRecommendationInput,
} from "@/lib/brand-archetypes";
import type {
  BrandFaceProductionPackage,
  BrandFaceRecommendation,
  CampaignBrandFaceRecommendationInput,
  OfficialBrandFaceRecord,
  VideoBrandFaceRecommendationInput,
} from "./types";
import { getOrCreateRegistry } from "./store";
import { listSelectionProjects } from "./store";

/**
 * Read-only: current active Official Brand Face for an archetype.
 */
export function getOfficialBrandFace(
  archetypeId: string,
  workspaceId?: string,
): OfficialBrandFaceRecord | null {
  const ws = workspaceId ?? "ws-milaene";
  const registry = getOrCreateRegistry(ws);
  return registry.activeByArchetypeId[archetypeId] ?? null;
}

/**
 * Read-only: all Official Brand Faces (active + retired).
 */
export function listOfficialBrandFaces(
  workspaceId?: string,
): OfficialBrandFaceRecord[] {
  const ws = workspaceId ?? "ws-milaene";
  const registry = getOrCreateRegistry(ws);
  return Object.values(registry.facesById).sort((a, b) =>
    a.approvedAt < b.approvedAt ? 1 : -1,
  );
}

/**
 * Read-only production package for a persona — no Image/Video Studio calls.
 */
export function getBrandFaceProductionPackage(
  personaId: string,
  workspaceId?: string,
): BrandFaceProductionPackage | null {
  const ws = workspaceId ?? "ws-milaene";
  const registry = getOrCreateRegistry(ws);
  const face = Object.values(registry.facesById).find(
    (f) => f.personaId === personaId && f.status === "active",
  );
  const projects = listSelectionProjects(ws);
  const project =
    projects.find((p) => p.draftPersonaId === personaId) ??
    (face
      ? projects.find((p) => p.id === face.selectionProjectId)
      : undefined);

  if (!face && !project) return null;

  return {
    personaId,
    brandFaceId: face?.id ?? null,
    archetypeId: face?.archetypeId ?? project?.archetypeId ?? null,
    identityDnaFingerprint:
      face?.identityDnaFingerprint ?? project?.identityDnaFingerprint ?? null,
    identityLockVersion: project?.identityLock?.version ?? null,
    imageReady: face?.imageReady ?? project?.imageUseApproved ?? false,
    videoReady: face?.videoReady ?? project?.videoReady ?? false,
    referencePackageStatus: project?.referencePackageStatus ?? null,
    immutableFeatures: [
      "facial identity",
      "skin tone",
      "eye structure",
      "nose",
      "lips",
      "jaw",
      "body proportions",
      "approved age range",
      "distinguishing features",
      "approved hairstyle range",
      "approved expression range",
    ],
    flexibleFeatures: [
      "clothing",
      "pose",
      "lighting",
      "location",
      "campaign styling",
    ],
  };
}

/**
 * Recommend an Official Brand Face for a campaign context.
 * Uses archetype scoring + active registry faces. No Image Studio.
 */
export function recommendOfficialBrandFaceForCampaign(
  input: CampaignBrandFaceRecommendationInput,
  workspaceId?: string,
): BrandFaceRecommendation[] {
  const ws = workspaceId ?? "ws-milaene";
  const catalog = loadBrandArchetypeCatalog(ws);
  const registry = getOrCreateRegistry(ws);

  const campaignInput: CampaignRecommendationInput = {
    campaign: input.campaign,
    collection: input.collection,
    product: input.product,
    audience: input.audience,
    platform: input.platform as CampaignRecommendationInput["platform"],
  };

  const archetypeRecs = recommendArchetypeForCampaign(catalog, campaignInput);
  const out: BrandFaceRecommendation[] = [];

  for (const rec of archetypeRecs) {
    const face = registry.activeByArchetypeId[rec.archetypeId];
    if (!face) continue;
    out.push({
      brandFaceId: face.id,
      personaId: face.personaId,
      archetypeId: face.archetypeId,
      archetypeName: rec.archetypeName,
      confidence: rec.confidence,
      reason: rec.reason,
      imageReady: face.imageReady,
      videoReady: face.videoReady,
    });
  }

  return out;
}

/**
 * Recommend an Official Brand Face for future video work.
 * Video Studio is not started — recommendation only.
 */
export function recommendOfficialBrandFaceForVideo(
  input: VideoBrandFaceRecommendationInput,
  workspaceId?: string,
): BrandFaceRecommendation[] {
  const ws = workspaceId ?? "ws-milaene";
  const catalog = loadBrandArchetypeCatalog(ws);
  const registry = getOrCreateRegistry(ws);

  const videoInput: VideoRecommendationInput = {
    platform: input.platform as VideoRecommendationInput["platform"],
    product: input.product,
    audience: input.audience,
  };

  const archetypeRecs = recommendArchetypeForVideo(catalog, videoInput);
  const out: BrandFaceRecommendation[] = [];

  for (const rec of archetypeRecs) {
    const face = registry.activeByArchetypeId[rec.archetypeId];
    if (!face) continue;
    out.push({
      brandFaceId: face.id,
      personaId: face.personaId,
      archetypeId: face.archetypeId,
      archetypeName: rec.archetypeName,
      confidence: rec.confidence,
      reason: rec.reason,
      imageReady: face.imageReady,
      videoReady: face.videoReady,
    });
  }

  return out;
}

/** Explicit stubs — Image Studio must not be called from Brand Face Selection. */
export function assertNoImageStudioCall(): void {
  // Intentionally empty — presence documents the contract for tests.
}

/** Explicit stubs — Video Studio must not be called from Brand Face Selection. */
export function assertNoVideoStudioCall(): void {
  // Intentionally empty — presence documents the contract for tests.
}
