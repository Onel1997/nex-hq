import { z } from "zod";

import type { PrintSurface } from "@/lib/image/print-surface/types";
import type { ProductProfile } from "@/lib/product-library/types";

type SurfaceProfile = Pick<
  ProductProfile,
  "productProfileId" | "version" | "printSurfaces"
>;

export const physicalProductFamilySelectionSchema = z
  .object({
    key: z.string().min(1).max(200),
    label: z.string().min(1).max(160),
    memberShopifyProductIds: z.array(z.string().min(1)).min(1).max(200),
    sourceLabel: z.string().min(1).max(160).nullable().default(null),
  })
  .strict();

export type PhysicalProductFamilySelection = z.infer<
  typeof physicalProductFamilySelectionSchema
>;

export type ReusablePrintSurface = {
  surface: PrintSurface;
  ownerProfileKey: string;
  ownerProfileVersion: number;
  inherited: boolean;
};

function uniqueSurfaceIdentity(candidate: ReusablePrintSurface): string {
  return [
    candidate.ownerProfileKey,
    candidate.ownerProfileVersion,
    candidate.surface.printSurfaceId,
    candidate.surface.version,
  ].join("|");
}

/**
 * Resolve reusable Product geometry without using Artwork or title similarity
 * as authority. Historical surfaces remain local to their ProductProfile.
 * Cross-listing inheritance requires persisted owner-confirmed equivalence.
 */
export function reusablePrintSurfacesForProduct(input: {
  profiles: readonly SurfaceProfile[];
  selectedProfile: SurfaceProfile | null;
  selectedShopifyProductId: string | null;
  physicalFamily: PhysicalProductFamilySelection | null;
}): ReusablePrintSurface[] {
  const selectedProfileId = input.selectedProfile?.productProfileId ?? null;
  const candidates: ReusablePrintSurface[] = [];

  for (const profile of input.profiles) {
    for (const surface of profile.printSurfaces) {
      if (profile.productProfileId === selectedProfileId) {
        candidates.push({
          surface,
          ownerProfileKey: profile.productProfileId,
          ownerProfileVersion:
            surface.reuse?.sourceProductProfileVersion ?? profile.version,
          inherited: false,
        });
        continue;
      }

      const reuse = surface.reuse;
      if (
        !reuse ||
        reuse.scope !== "PRODUCT_FAMILY" ||
        reuse.equivalenceAuthority !== "OWNER_CONFIRMED" ||
        reuse.variantPolicy !== "ALL_COMPATIBLE_VARIANTS" ||
        !input.selectedShopifyProductId ||
        !input.physicalFamily ||
        reuse.physicalProductKey !== input.physicalFamily.key ||
        !reuse.compatibleShopifyProductIds.includes(
          input.selectedShopifyProductId,
        ) ||
        !input.physicalFamily.memberShopifyProductIds.includes(
          input.selectedShopifyProductId,
        )
      ) {
        continue;
      }

      candidates.push({
        surface,
        ownerProfileKey: reuse.sourceProductProfileId,
        ownerProfileVersion: reuse.sourceProductProfileVersion,
        inherited: true,
      });
    }
  }

  const latestByRegion = new Map<string, ReusablePrintSurface>();
  for (const candidate of candidates) {
    const key = `${candidate.surface.region}|${candidate.surface.variantId ?? "all"}`;
    const current = latestByRegion.get(key);
    if (
      !current ||
      candidate.surface.version > current.surface.version ||
      (candidate.surface.version === current.surface.version &&
        uniqueSurfaceIdentity(candidate) > uniqueSurfaceIdentity(current))
    ) {
      latestByRegion.set(key, candidate);
    }
  }
  return [...latestByRegion.values()];
}

export function assertFamilySurfaceUsableForShopifyProduct(input: {
  surface: PrintSurface;
  selectedProfile: ProductProfile;
  selectedShopifyProductId: string;
}): void {
  if (input.surface.productProfileId === input.selectedProfile.productProfileId)
    return;
  const reuse = input.surface.reuse;
  if (
    !reuse ||
    reuse.scope !== "PRODUCT_FAMILY" ||
    reuse.equivalenceAuthority !== "OWNER_CONFIRMED" ||
    reuse.variantPolicy !== "ALL_COMPATIBLE_VARIANTS" ||
    !reuse.compatibleShopifyProductIds.includes(input.selectedShopifyProductId)
  ) {
    throw new Error(
      "The PrintSurface is not authorized for this physical Product family.",
    );
  }
}
