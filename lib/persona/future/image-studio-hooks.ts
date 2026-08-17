/** Persona → Image Studio contract boundary. No provider work is performed. */

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

export type ImageStudioPersonaHandoff = BrandModelHandoff & {
  consumer: "image";
};

export async function buildImageStudioPersonaHandoff(
  scope: WorkspaceScope,
  personaId: string,
  options: {
    expectedIdentity?: ExpectedBrandModelIdentity;
    resolveAssetAccess?: boolean;
    assetAccessResolver?: BrandModelAssetAccessResolver;
  } = {},
): Promise<ImageStudioPersonaHandoff> {
  return (await buildBrandModelHandoff(
    scope,
    personaId,
    "image",
    options,
  )) as ImageStudioPersonaHandoff;
}

export function listImageStudioBrandModels(
  scope: WorkspaceScope,
): Promise<BrandModelSummary[]> {
  return listEligibleBrandModels(scope, "image");
}
