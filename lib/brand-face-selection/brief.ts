/**
 * Discovery brief — UI summary for A1 confirmation.
 * Expected cost comes from the existing paid confirmation estimate (caller-supplied).
 */

import {
  getProductAffinityForArchetype,
  type BrandArchetype,
  type BrandArchetypePlatform,
  type IdentityDna,
} from "@/lib/brand-archetypes";
import { loadProductCatalog } from "@/lib/product-intelligence";
import { A1_DISCOVERY_CANDIDATE_COUNT, A1_PORTRAITS_PER_CANDIDATE } from "./constants";
import { buildA1DiscoveryPlan } from "./discovery";
import { resolveArchetypeBundle, targetRoleForArchetype } from "./selection-project";
import type { BrandFaceSelectionProject, BrandFaceTargetRole } from "./types";

export type BrandFaceDiscoveryBrief = {
  archetypeId: string;
  archetypeName: string;
  role: BrandFaceTargetRole;
  commercialRole: string;
  productAffinities: Array<{ productType: string; rating: number; reason: string }>;
  bestPlatforms: BrandArchetypePlatform[];
  identityDnaSummary: {
    fingerprint: string;
    faceGeometryFamily: string;
    skinToneFamily: string;
    hairFamily: string;
    presence: string;
  };
  candidateCount: number;
  portraitsPerCandidate: number;
  totalImages: number;
  /** Caller fills from estimateCreationCost — never invented here. */
  expectedCostEur: { min: number; max: number } | null;
  requiresPaidConfirmation: true;
};

export function buildDiscoveryBrief(
  project: BrandFaceSelectionProject,
  expectedCostEur: { min: number; max: number } | null = null,
): BrandFaceDiscoveryBrief {
  const { archetype, dna } = resolveArchetypeBundle(
    project.archetypeId,
    project.workspaceId,
  );
  const plan = buildA1DiscoveryPlan(project);
  const catalog = loadProductCatalog(project.workspaceId);
  const affinity = getProductAffinityForArchetype(archetype, catalog);

  return {
    archetypeId: archetype.id,
    archetypeName: archetype.name,
    role: targetRoleForArchetype(archetype),
    commercialRole: archetype.commercialRole,
    productAffinities: affinity.map((a) => ({
      productType: a.productType,
      rating: a.rating,
      reason: a.reason,
    })),
    bestPlatforms: archetype.bestPlatforms,
    identityDnaSummary: summarizeIdentityDna(dna),
    candidateCount: plan.candidateCount,
    portraitsPerCandidate: plan.portraitsPerCandidate,
    totalImages: plan.totalImages,
    expectedCostEur,
    requiresPaidConfirmation: true,
  };
}

export function summarizeIdentityDna(dna: IdentityDna): BrandFaceDiscoveryBrief["identityDnaSummary"] {
  return {
    fingerprint: dna.fingerprint,
    faceGeometryFamily: dna.appearance.faceGeometryFamily,
    skinToneFamily: dna.appearance.skinToneFamily,
    hairFamily: dna.appearance.hairFamily,
    presence: [
      dna.presence.confidence,
      dna.presence.approachability,
      dna.presence.authenticity,
    ].join(" · "),
  };
}

export function discoveryDefaultsForArchetype(archetype: BrandArchetype): {
  candidateCount: number;
  portraitsPerCandidate: number;
} {
  void archetype;
  return {
    candidateCount: A1_DISCOVERY_CANDIDATE_COUNT,
    portraitsPerCandidate: A1_PORTRAITS_PER_CANDIDATE,
  };
}
