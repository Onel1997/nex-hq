/** Persona → Video Studio contract boundary. Video generation remains absent. */

import type { WorkspaceScope } from "../domain/types";
import type {
  BrandModelHandoff,
  BrandModelSummary,
  ExpectedBrandModelIdentity,
} from "../domain/brand-model-contract";
import {
  buildBrandModelHandoff,
  listEligibleBrandModels,
  type BrandModelAssetAccessResolver,
} from "../integrations/brand-model-handoff";

export type VideoStudioPersonaHandoff = BrandModelHandoff & {
  consumer: "video";
};

export async function buildVideoStudioPersonaHandoff(
  scope: WorkspaceScope,
  personaId: string,
  options: {
    expectedIdentity?: ExpectedBrandModelIdentity;
    resolveAssetAccess?: boolean;
    assetAccessResolver?: BrandModelAssetAccessResolver;
  } = {},
): Promise<VideoStudioPersonaHandoff> {
  return (await buildBrandModelHandoff(
    scope,
    personaId,
    "video",
    options,
  )) as VideoStudioPersonaHandoff;
}

export function listVideoStudioBrandModels(
  scope: WorkspaceScope,
): Promise<BrandModelSummary[]> {
  return listEligibleBrandModels(scope, "video");
}
