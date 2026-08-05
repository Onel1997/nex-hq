/**
 * Controlled pool helpers for L2 Slot Blueprints.
 */

import {
  CONTROLLED_POOL_KEYS,
  HIGH_LEVERAGE_POOL_KEYS,
  type ControlledPoolKey,
  type ControlledPools,
  type HighLeveragePoolKey,
} from "./types";

export const MIN_HIGH_LEVERAGE_POOL_SIZE = 4;
export const MIN_STANDARD_POOL_SIZE = 3;

export function isHighLeveragePoolKey(key: string): key is HighLeveragePoolKey {
  return (HIGH_LEVERAGE_POOL_KEYS as readonly string[]).includes(key);
}

export function minPoolSizeForKey(key: ControlledPoolKey): number {
  return isHighLeveragePoolKey(key)
    ? MIN_HIGH_LEVERAGE_POOL_SIZE
    : MIN_STANDARD_POOL_SIZE;
}

/** Assert every controlled pool key is present with unique non-empty strings. */
export function assertPoolsShape(
  pools: ControlledPools,
): { ok: true } | { ok: false; path: string; message: string } {
  for (const key of CONTROLLED_POOL_KEYS) {
    const options = pools[key];
    if (!options || options.length === 0) {
      return {
        ok: false,
        path: `controlledPools.${key}`,
        message: `Empty controlled pool: ${key}`,
      };
    }
    const min = minPoolSizeForKey(key);
    if (options.length < min) {
      return {
        ok: false,
        path: `controlledPools.${key}`,
        message: `Pool ${key} requires at least ${min} options, got ${options.length}`,
      };
    }
    const trimmed = options.map((o) => o.trim());
    if (trimmed.some((o) => o.length === 0)) {
      return {
        ok: false,
        path: `controlledPools.${key}`,
        message: `Pool ${key} contains empty option strings`,
      };
    }
    if (new Set(trimmed).size !== trimmed.length) {
      return {
        ok: false,
        path: `controlledPools.${key}`,
        message: `Pool ${key} contains duplicate options`,
      };
    }
    if (key === "optionalMicroMarks" && !trimmed.includes("none")) {
      return {
        ok: false,
        path: `controlledPools.optionalMicroMarks`,
        message: `optionalMicroMarks pool must include "none"`,
      };
    }
  }
  return { ok: true };
}

/** Parse "24-29" style age bands into inclusive integer bounds. */
export function parseAgeRange(
  ageRange: string,
): { min: number; max: number } | null {
  const match = ageRange.trim().match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  return { min, max };
}
