import type { ImageCostEstimate } from "@/lib/image/paid-generation/types";
import type { NormalEstimationPolicy } from "@/lib/image/normal-estimation/types";

export function includeMidasNormalCost(estimate: ImageCostEstimate, policy: NormalEstimationPolicy | undefined): ImageCostEstimate {
  if (!policy) return estimate;
  return {
    ...estimate,
    maximum: Number((estimate.maximum + policy.maximumCostUsd).toFixed(4)),
    pricingVersion: `${estimate.pricingVersion}+fal-midas-normal-v1`,
    basis: "One Stage-A base, identity/Product-reference allowance, one garment segmentation, one checksum-bound MiDaS normal request, one checksum-bound Depth Anything request, and local deterministic compositing.",
  };
}
