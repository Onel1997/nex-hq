/**
 * Phase 2.2A — deterministic provider seed for every discovery attempt.
 * Different for every A1/B1/C1/D1/A2/… Never silently reuse another slot's seed.
 */

import { createHash } from "node:crypto";
import type { DiscoverySlot } from "@/lib/persona/identity-blueprints";
import type { DiscoveryProviderId } from "./discovery-provider-config";

/** FNV-1a style stable 32-bit integer in [1, 2^31-1]. */
export function deriveProviderSeed(input: {
  generationRunId: string;
  slot: DiscoverySlot;
  attemptNumber: number;
  provider: DiscoveryProviderId;
  creationProjectId?: string;
}): number {
  const material = [
    "persona-discovery-provider-seed-v1",
    input.generationRunId,
    input.slot,
    String(input.attemptNumber),
    input.provider,
    input.creationProjectId ?? "",
  ].join("|");
  const digest = createHash("sha256").update(material).digest();
  // Use first 4 bytes as unsigned int, mask to signed positive 31-bit.
  const raw = digest.readUInt32BE(0) & 0x7fffffff;
  return raw === 0 ? 1 : raw;
}

export function assertUniqueProviderSeeds(
  seeds: ReadonlyArray<{ slot: DiscoverySlot; attemptNumber: number; seed: number }>,
): void {
  const seen = new Map<number, string>();
  for (const row of seeds) {
    const key = `${row.slot}:${row.attemptNumber}`;
    const prior = seen.get(row.seed);
    if (prior && prior !== key) {
      throw new Error(
        `Provider seed collision between ${prior} and ${key} (seed=${row.seed})`,
      );
    }
    seen.set(row.seed, key);
  }
}
