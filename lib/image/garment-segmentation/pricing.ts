import type { GarmentSegmentationPolicy } from "@/lib/image/garment-segmentation/types";
import type { ImageCostEstimate } from "@/lib/image/paid-generation/types";

export function includeGarmentSegmentationCost(
  estimate: ImageCostEstimate,
  policy: GarmentSegmentationPolicy | undefined,
): ImageCostEstimate {
  if (!policy) return estimate;
  return {
    ...estimate,
    maximum: Number((estimate.maximum + policy.maximumCostUsd).toFixed(4)),
    pricingVersion: `${estimate.pricingVersion}+${policy.provider}-sam3-segmentation-v1`,
    basis:
      "One Stage-A base image plus the configured Persona/Product-reference allowance and one checksum-bound garment-segmentation request. Deterministic Stage B has no provider charge.",
  };
}
