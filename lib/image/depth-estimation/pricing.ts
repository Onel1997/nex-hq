import type { ImageCostEstimate } from "@/lib/image/paid-generation/types";
import type { DepthEstimationPolicy } from "@/lib/image/depth-estimation/types";

export function includeDepthEstimationCost(
  estimate: ImageCostEstimate,
  policy: DepthEstimationPolicy | undefined,
): ImageCostEstimate {
  if (!policy) return estimate;
  return {
    ...estimate,
    maximum: Number((estimate.maximum + policy.maximumCostUsd).toFixed(4)),
    pricingVersion: `${estimate.pricingVersion}+fal-depth-anything-v2-v1`,
    basis:
      "One Stage-A base image, the configured identity/Product-reference allowance, one garment-segmentation request, and one checksum-bound depth request. Deterministic compositing has no provider charge.",
  };
}
