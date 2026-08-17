/**
 * Phase 2.5B.FREEZE — Urban Community Hero casting freeze tag.
 *
 * Metadata only. Does not affect prompts, routing, thresholds, or generation.
 * Accidental casting drift is guarded by phase-2-5b-freeze-urban-casting.test.ts.
 */

/** Stable internal label for the frozen Urban casting configuration. */
export const URBAN_CASTING_VERSION = "2.5B-FROZEN" as const;

export type UrbanCastingVersion = typeof URBAN_CASTING_VERSION;
