import { ONLINE_MAINTENANCE_STATUS, type XeriamoPublicMaintenanceStatus } from "./contracts";

type RpcRow = {
  maintenance_enabled?: unknown;
  maintenance_message?: unknown;
  maintenance_expected_back_at?: unknown;
  maintenance_discord_enabled?: unknown;
  updated_at?: unknown;
};

const CACHE_TTL_MS = 2_000;
let cached: { expiresAt: number; value: XeriamoPublicMaintenanceStatus } | null = null;

function mapRow(row: RpcRow | null | undefined): XeriamoPublicMaintenanceStatus {
  if (!row || typeof row.maintenance_enabled !== "boolean") return ONLINE_MAINTENANCE_STATUS;
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : "unknown";
  return {
    state: row.maintenance_enabled ? "MAINTENANCE" : "ONLINE",
    message: typeof row.maintenance_message === "string" ? row.maintenance_message : null,
    expectedBackAt: typeof row.maintenance_expected_back_at === "string" ? row.maintenance_expected_back_at : null,
    discordEnabled: row.maintenance_discord_enabled === true,
    version: updatedAt,
  };
}

/** Best-effort Edge read. Missing migration/config fails open to current ONLINE behavior. */
export async function loadEdgeMaintenanceStatus(options: { fresh?: boolean } = {}) {
  const now = Date.now();
  if (!options.fresh && cached && cached.expiresAt > now) return cached.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return ONLINE_MAINTENANCE_STATUS;
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/xeriano_get_public_maintenance_status`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        "content-type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    if (!response.ok) return cached?.value ?? ONLINE_MAINTENANCE_STATUS;
    const body = await response.json() as RpcRow[] | RpcRow;
    const value = mapRow(Array.isArray(body) ? body[0] : body);
    cached = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch {
    // Once this isolate has observed Maintenance, a transient status-read
    // failure must not reopen customer access. A cold deployment without the
    // additive migration still preserves the existing ONLINE behavior.
    return cached?.value ?? ONLINE_MAINTENANCE_STATUS;
  }
}

export function clearEdgeMaintenanceStatusCacheForTests() {
  cached = null;
}
