import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { hasXerianoOwnerAuthority, resolveXerianoAccess } from "@/lib/xeriano/auth";
import { assessTrustedXeriamoApplicationOrigin } from "@/lib/xeriano/request-origin";
import {
  ONLINE_MAINTENANCE_STATUS,
  type XeriamoOwnerMaintenanceStatus,
  type XeriamoPublicMaintenanceStatus,
} from "./contracts";

type StatusRow = {
  maintenance_enabled: boolean;
  maintenance_message: string | null;
  maintenance_expected_back_at: string | null;
  maintenance_discord_enabled: boolean;
  updated_at: string;
};

export class XeriamoMaintenanceError extends Error {
  constructor(
    public code: "OWNER_REQUIRED" | "MUTATION_ORIGIN_REQUIRED" | "MAINTENANCE_UNAVAILABLE",
    public status: number,
  ) { super(code); }
}

function mapStatus(row: StatusRow): XeriamoOwnerMaintenanceStatus {
  return {
    state: row.maintenance_enabled ? "MAINTENANCE" : "ONLINE",
    message: row.maintenance_message,
    expectedBackAt: row.maintenance_expected_back_at,
    discordEnabled: row.maintenance_discord_enabled,
    updatedAt: row.updated_at,
    version: createHash("sha256").update(row.updated_at).digest("hex").slice(0, 16),
  };
}

async function readStatusRow(): Promise<StatusRow> {
  if (!isSupabaseConfigured()) throw new XeriamoMaintenanceError("MAINTENANCE_UNAVAILABLE", 503);
  const { data, error } = await createAdminClient()
    .from("xeriano_system_status")
    .select("maintenance_enabled,maintenance_message,maintenance_expected_back_at,maintenance_discord_enabled,updated_at")
    .eq("id", "XERIAMO")
    .maybeSingle();
  if (error || !data) throw new XeriamoMaintenanceError("MAINTENANCE_UNAVAILABLE", 503);
  return data as StatusRow;
}

export async function loadPublicMaintenanceStatus(): Promise<XeriamoPublicMaintenanceStatus> {
  try {
    const status = mapStatus(await readStatusRow());
    return {
      state: status.state,
      message: status.message,
      expectedBackAt: status.expectedBackAt,
      discordEnabled: status.discordEnabled,
      version: status.version,
    };
  } catch {
    return ONLINE_MAINTENANCE_STATUS;
  }
}

export async function requireMaintenanceOwner() {
  const access = await resolveXerianoAccess();
  if (access.status !== "AUTHENTICATED" || !hasXerianoOwnerAuthority(access.context)) {
    throw new XeriamoMaintenanceError("OWNER_REQUIRED", 403);
  }
  return access.context;
}

export async function loadOwnerMaintenanceStatus() {
  await requireMaintenanceOwner();
  return mapStatus(await readStatusRow());
}

export async function updateMaintenanceStatus(input: {
  request: Request;
  enabled: boolean;
  message: string | null;
  expectedBackAt: string | null;
  discordEnabled: boolean;
}) {
  const owner = await requireMaintenanceOwner();
  const origin = assessTrustedXeriamoApplicationOrigin({
    originHeader: input.request.headers.get("origin"),
    requestUrl: input.request.url,
    applicationUrl: process.env.NEXT_PUBLIC_APP_URL,
    hostHeader: input.request.headers.get("host"),
    forwardedHostHeader: input.request.headers.get("x-forwarded-host"),
    forwardedProtoHeader: input.request.headers.get("x-forwarded-proto"),
    environment: process.env.NODE_ENV,
  });
  if (!origin.allowed) throw new XeriamoMaintenanceError("MUTATION_ORIGIN_REQUIRED", 403);

  const { error } = await createAdminClient().rpc("xeriano_set_maintenance_status", {
    p_maintenance_enabled: input.enabled,
    p_maintenance_message: input.message,
    p_maintenance_expected_back_at: input.expectedBackAt,
    p_maintenance_discord_enabled: input.discordEnabled,
    p_actor_user_id: owner.userId,
  });
  if (error) throw new XeriamoMaintenanceError("MAINTENANCE_UNAVAILABLE", 503);
  return mapStatus(await readStatusRow());
}
