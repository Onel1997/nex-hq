/**
 * Phase 2.0C.2 — Resolve archetype filter for historical novelty scans.
 *
 * Bug: callers often pass creation-project `brand_role` (e.g. "primary_male")
 * while novelty rows store official cast `archetype.id`
 * (e.g. "arch-mediterranean-premium-hero"). An equality filter then returns 0.
 *
 * Historical Face Protection is workspace-scoped (Phase 2.0C). Apply an
 * archetype equality filter only when it actually matches stored rows.
 */

/** Known Persona creation brand_role values — never equal to novelty archetype_id. */
export const PERSONA_BRAND_ROLE_IDS = new Set([
  "primary_male",
  "secondary_male",
  "primary_female",
  "secondary_female",
  "campaign_male",
  "campaign_female",
  "brand_face",
  "unknown",
]);

export type NoveltyArchetypeFilterResolution = {
  /** Archetype id to apply as equality filter, or null for workspace-wide. */
  effectiveArchetypeId: string | null;
  requestedArchetypeId: string | null;
  bypassed: boolean;
  reason: string;
};

/**
 * Decide whether to apply `.eq("archetype_id", …)` on a historical novelty query.
 *
 * @param matchingRowCountForRequested — forbidden-state row count in the
 *   workspace that already match `requestedArchetypeId` exactly.
 */
export function resolveHistoricalNoveltyArchetypeFilter(input: {
  requestedArchetypeId?: string | null;
  matchingRowCountForRequested: number;
}): NoveltyArchetypeFilterResolution {
  const requested =
    typeof input.requestedArchetypeId === "string" &&
    input.requestedArchetypeId.trim()
      ? input.requestedArchetypeId.trim()
      : null;

  if (!requested) {
    return {
      effectiveArchetypeId: null,
      requestedArchetypeId: null,
      bypassed: false,
      reason: "no_archetype_requested_workspace_scope",
    };
  }

  if (input.matchingRowCountForRequested > 0) {
    return {
      effectiveArchetypeId: requested,
      requestedArchetypeId: requested,
      bypassed: false,
      reason: "exact_archetype_id_match",
    };
  }

  // Creation-project brand_role was incorrectly passed as novelty archetype_id.
  // Genuine archetype ids with zero history must still return empty (not bypass).
  if (PERSONA_BRAND_ROLE_IDS.has(requested)) {
    return {
      effectiveArchetypeId: null,
      requestedArchetypeId: requested,
      bypassed: true,
      reason: "requested_value_is_brand_role_not_novelty_archetype_id",
    };
  }

  return {
    effectiveArchetypeId: requested,
    requestedArchetypeId: requested,
    bypassed: false,
    reason: "exact_archetype_id_no_rows_yet",
  };
}

export type HistoricalDiscoveryAuditFunnel = {
  workspaceId: string;
  requestedArchetypeId: string | null;
  effectiveArchetypeId: string | null;
  filterBypassReason: string | null;
  startTotalRows: number;
  afterWorkspaceFilter: number;
  afterArchetypeFilter: number;
  afterForbiddenStateFilter: number;
  withAssetId: number;
  withEmbedding: number;
  eligibleMissingEmbedding: number;
  queryPath: string;
};

export function logHistoricalDiscoveryAudit(
  funnel: HistoricalDiscoveryAuditFunnel,
): void {
  if (process.env.NODE_ENV === "production") return;
  console.info("[persona.novelty.historical_audit]", {
    queryPath: funnel.queryPath,
    workspaceId: funnel.workspaceId,
    requestedArchetypeId: funnel.requestedArchetypeId,
    effectiveArchetypeId: funnel.effectiveArchetypeId,
    filterBypassReason: funnel.filterBypassReason,
    Start: funnel.startTotalRows,
    "Workspace filter": funnel.afterWorkspaceFilter,
    "Archetype filter": funnel.afterArchetypeFilter,
    "Status filter (forbidden)": funnel.afterForbiddenStateFilter,
    "Asset exists": funnel.withAssetId,
    "Embedding exists": funnel.withEmbedding,
    Eligible: funnel.eligibleMissingEmbedding,
  });
}
