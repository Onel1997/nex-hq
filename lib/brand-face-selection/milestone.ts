/**
 * Official Milaene Brand Face milestone — exactly three archetypes.
 * Persona Studio is complete only when all three are approved.
 */

import { loadBrandArchetypeCatalog } from "@/lib/brand-archetypes";
import {
  OFFICIAL_MILAENE_ARCHETYPE_COUNT,
} from "./types";
import type {
  BrandFaceArchetypeMilestone,
  OfficialBrandFaceMilestone,
} from "./types";
import { getOrCreateRegistry } from "./store";

export function getOfficialBrandFaceMilestone(
  workspaceId: string,
): OfficialBrandFaceMilestone {
  const catalog = loadBrandArchetypeCatalog(workspaceId);
  const registry = getOrCreateRegistry(workspaceId);
  const activeArchetypes = catalog.archetypes.filter((a) => a.status === "active");

  if (activeArchetypes.length !== OFFICIAL_MILAENE_ARCHETYPE_COUNT) {
    // Milestone still reports against active archetypes; required count stays 3.
  }

  const archetypes: BrandFaceArchetypeMilestone[] = activeArchetypes.map(
    (archetype) => {
      const active = registry.activeByArchetypeId[archetype.id] ?? null;
      const approvedCount = active ? 1 : 0;
      return {
        archetypeId: archetype.id,
        archetypeSlug: archetype.slug,
        archetypeName: archetype.name,
        approvedCount,
        requiredCount: 1,
        activeFaceId: active?.id ?? null,
        label: `${archetype.name}\n${approvedCount}/1 approved`,
      };
    },
  );

  // Ensure milestone always accounts for exactly three official slots.
  const approvedCount = archetypes.reduce((sum, a) => sum + a.approvedCount, 0);
  const requiredCount = OFFICIAL_MILAENE_ARCHETYPE_COUNT;

  return {
    archetypes,
    approvedCount,
    requiredCount,
    complete: approvedCount >= requiredCount && archetypes.length === requiredCount,
    label: `Overall:\n${approvedCount}/${requiredCount} Official Milaene Brand Faces`,
  };
}

export function isPersonaStudioBrandFaceComplete(
  workspaceId: string,
): boolean {
  return getOfficialBrandFaceMilestone(workspaceId).complete;
}

export function formatMilestoneLines(
  milestone: OfficialBrandFaceMilestone,
): string[] {
  const lines = milestone.archetypes.map(
    (a) => `${a.archetypeName}\n${a.approvedCount}/1 approved`,
  );
  lines.push(`Overall:\n${milestone.approvedCount}/${milestone.requiredCount} Official Milaene Brand Faces`);
  return lines;
}
