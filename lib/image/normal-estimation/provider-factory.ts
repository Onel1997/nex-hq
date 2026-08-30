import { FalMidasNormalProvider } from "@/lib/image/normal-estimation/fal-midas-adapter";
import type { NormalEstimationProvider } from "@/lib/image/normal-estimation/types";

export function createNormalEstimationProviderFromEnvironment(): NormalEstimationProvider {
  const selected = process.env.NEXHQ_MIDAS_PROVIDER?.trim().toLowerCase();
  if (selected && selected !== "fal") throw new Error("NEXHQ_MIDAS_PROVIDER must be fal.");
  return new FalMidasNormalProvider();
}
