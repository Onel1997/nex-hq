import type { DesignJobManifest } from "@/lib/design-studio/server-contracts";
import { designManifestToRun } from "@/lib/design-studio/generation-service";

/** Public history/run DTO contains no provider endpoint, request ID, cost or prompt enhancement. */
export function publicDesignRun(manifest: DesignJobManifest) {
  return designManifestToRun(manifest);
}
