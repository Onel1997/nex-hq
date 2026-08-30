import { FalDepthAnythingV2Provider } from "@/lib/image/depth-estimation/fal-depth-anything-v2-adapter";
import type { DepthEstimationProvider } from "@/lib/image/depth-estimation/types";

export function createDepthEstimationProviderFromEnvironment(): DepthEstimationProvider {
  const selected = process.env.NEXHQ_DEPTH_PROVIDER?.trim().toLowerCase();
  if (selected && selected !== "fal") {
    throw new Error("NEXHQ_DEPTH_PROVIDER must be fal.");
  }
  return new FalDepthAnythingV2Provider();
}
