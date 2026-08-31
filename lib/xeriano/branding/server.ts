import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "canvas";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { hasXerianoOwnerAuthority, resolveXerianoAccess } from "@/lib/xeriano/auth";
import { assessTrustedXeriamoApplicationOrigin } from "@/lib/xeriano/request-origin";
import {
  brandingRoleSlug,
  type XeriamoBrandingAsset,
  type XeriamoBrandingRole,
  type XeriamoPublicBranding,
} from "./contracts";
import { brandingExtension, validateBrandingUpload } from "./validation";

const BUCKET = "xeriamo-branding";

type BrandingRow = {
  id: string;
  role: XeriamoBrandingRole;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  byte_length: number;
  checksum_sha256: string;
  original_filename: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export class XeriamoBrandingError extends Error {
  constructor(
    public code: "OWNER_REQUIRED" | "MUTATION_ORIGIN_REQUIRED" | "BRANDING_UNAVAILABLE" | "ASSET_NOT_FOUND" | "ACTIVE_ASSET" | "ROLE_MISMATCH",
    public status: number,
  ) { super(code); }
}

export async function requireXeriamoBrandingOwner() {
  const access = await resolveXerianoAccess();
  if (access.status !== "AUTHENTICATED" || !hasXerianoOwnerAuthority(access.context)) {
    throw new XeriamoBrandingError("OWNER_REQUIRED", 403);
  }
  return access.context;
}

function logBrandingMutationDenial(input: {
  method: string;
  code: "OWNER_REQUIRED" | "MUTATION_ORIGIN_REQUIRED";
  originPresent: boolean;
  hostMatch: boolean;
  ownerAuthorized: boolean;
}) {
  if (process.env.NODE_ENV === "production") return;
  console.warn("[xeriamo-branding] mutation rejected", {
    stage: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    method: input.method,
    code: input.code,
    originPresent: input.originPresent,
    hostMatch: input.hostMatch,
    ownerAuthorized: input.ownerAuthorized,
  });
}

/** Shared exact-Owner + same-application authority for every Branding write. */
export async function requireXeriamoBrandingMutationRequest(request: Request) {
  const origin = assessTrustedXeriamoApplicationOrigin({
    originHeader: request.headers.get("origin"),
    requestUrl: request.url,
    applicationUrl: process.env.NEXT_PUBLIC_APP_URL,
    hostHeader: request.headers.get("host"),
    forwardedHostHeader: request.headers.get("x-forwarded-host"),
    forwardedProtoHeader: request.headers.get("x-forwarded-proto"),
    environment: process.env.NODE_ENV,
  });

  let owner;
  try {
    owner = await requireXeriamoBrandingOwner();
  } catch (error) {
    logBrandingMutationDenial({
      method: request.method,
      code: "OWNER_REQUIRED",
      originPresent: origin.originPresent,
      hostMatch: origin.hostMatch,
      ownerAuthorized: false,
    });
    throw error;
  }

  if (!origin.allowed) {
    logBrandingMutationDenial({
      method: request.method,
      code: "MUTATION_ORIGIN_REQUIRED",
      originPresent: origin.originPresent,
      hostMatch: origin.hostMatch,
      ownerAuthorized: true,
    });
    throw new XeriamoBrandingError("MUTATION_ORIGIN_REQUIRED", 403);
  }
  return owner;
}

function mapOwnerAsset(row: BrandingRow): XeriamoBrandingAsset {
  return {
    id: row.id,
    role: row.role,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    byteLength: Number(row.byte_length),
    originalFilename: row.original_filename,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    previewUrl: `/api/hq/branding/${row.id}/content?v=${encodeURIComponent(row.updated_at)}`,
  };
}

async function selectBrandingRows(options: { activeOnly?: boolean } = {}): Promise<BrandingRow[]> {
  if (!isSupabaseConfigured()) return [];
  const admin = createAdminClient();
  let query = admin.from("xeriano_branding_assets")
    .select("id,role,storage_bucket,storage_path,mime_type,width,height,byte_length,checksum_sha256,original_filename,active,created_at,updated_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (options.activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new XeriamoBrandingError("BRANDING_UNAVAILABLE", 503);
  return (data ?? []) as BrandingRow[];
}

export async function listOwnerBrandingAssets() {
  await requireXeriamoBrandingOwner();
  return (await selectBrandingRows()).map(mapOwnerAsset);
}

export async function loadPublicBranding(): Promise<XeriamoPublicBranding> {
  let rows: BrandingRow[] = [];
  try { rows = await selectBrandingRows({ activeOnly: true }); } catch { return {}; }
  return Object.fromEntries(rows.map((row) => {
    const version = createHash("sha256").update(`${row.id}:${row.updated_at}:${row.checksum_sha256}`).digest("hex").slice(0, 16);
    return [row.role, {
      role: row.role,
      url: `/api/public/branding/${brandingRoleSlug(row.role)}?v=${version}`,
      version,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
    }];
  })) as XeriamoPublicBranding;
}

async function fallbackIcon() {
  const bytes = await readFile(path.join(process.cwd(), "app", "favicon.ico"));
  return { bytes, mimeType: "image/x-icon", checksum: createHash("sha256").update(bytes).digest("hex") };
}

function fallbackAppleTouchIcon() {
  const canvas = createCanvas(180, 180);
  const context = canvas.getContext("2d");
  context.fillStyle = "#0b0c11";
  context.fillRect(0, 0, 180, 180);
  context.fillStyle = "#f4f0ff";
  context.font = "700 92px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("X", 90, 96);
  const bytes = canvas.toBuffer("image/png");
  return { bytes, mimeType: "image/png", checksum: createHash("sha256").update(bytes).digest("hex") };
}

export async function loadPublicBrandingBytes(role: XeriamoBrandingRole) {
  let rows: BrandingRow[] = [];
  try { rows = await selectBrandingRows({ activeOnly: true }); } catch { rows = []; }
  let row = rows.find((candidate) => candidate.role === role);
  if (!row && role === "APPLE_TOUCH_ICON") row = rows.find((candidate) => candidate.role === "ICON" && candidate.mime_type === "image/png");
  if (!row) {
    if (role === "APPLE_TOUCH_ICON") return fallbackAppleTouchIcon();
    if (role === "FAVICON") return fallbackIcon();
    return null;
  }
  const { data, error } = await createAdminClient().storage.from(row.storage_bucket).download(row.storage_path);
  if (error || !data) {
    if (role === "APPLE_TOUCH_ICON") return fallbackAppleTouchIcon();
    return role === "FAVICON" ? fallbackIcon() : null;
  }
  return { bytes: Buffer.from(await data.arrayBuffer()), mimeType: row.mime_type, checksum: row.checksum_sha256 };
}

export async function loadOwnerBrandingBytes(assetId: string) {
  await requireXeriamoBrandingOwner();
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(assetId)) throw new XeriamoBrandingError("ASSET_NOT_FOUND", 404);
  const { data: row, error } = await createAdminClient().from("xeriano_branding_assets")
    .select("storage_bucket,storage_path,mime_type,checksum_sha256")
    .eq("id", assetId).is("deleted_at", null).maybeSingle();
  if (error || !row) throw new XeriamoBrandingError("ASSET_NOT_FOUND", 404);
  const downloaded = await createAdminClient().storage.from(String(row.storage_bucket)).download(String(row.storage_path));
  if (downloaded.error || !downloaded.data) throw new XeriamoBrandingError("ASSET_NOT_FOUND", 404);
  return { bytes: Buffer.from(await downloaded.data.arrayBuffer()), mimeType: String(row.mime_type), checksum: String(row.checksum_sha256) };
}

export async function uploadBrandingAsset(input: {
  role: XeriamoBrandingRole;
  bytes: Buffer;
  declaredMimeType: string;
  originalFilename: string;
}) {
  const owner = await requireXeriamoBrandingOwner();
  const validated = await validateBrandingUpload(input);
  const assetId = randomUUID();
  const storagePath = `branding/${input.role.toLowerCase()}/${assetId}/${randomUUID()}.${brandingExtension(validated.mimeType)}`;
  const admin = createAdminClient();
  const uploaded = await admin.storage.from(BUCKET).upload(storagePath, input.bytes, {
    contentType: validated.mimeType,
    upsert: false,
  });
  if (uploaded.error) throw new XeriamoBrandingError("BRANDING_UNAVAILABLE", 503);
  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  const registered = await admin.rpc("xeriano_register_branding_asset", {
    p_asset_id: assetId,
    p_role: input.role,
    p_storage_path: storagePath,
    p_mime_type: validated.mimeType,
    p_width: validated.width,
    p_height: validated.height,
    p_byte_length: input.bytes.length,
    p_checksum_sha256: checksum,
    p_original_filename: validated.filename,
    p_actor_user_id: owner.userId,
  });
  if (registered.error) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new XeriamoBrandingError("BRANDING_UNAVAILABLE", 503);
  }
  return assetId;
}

export async function activateBrandingAsset(assetId: string, expectedRole: XeriamoBrandingRole) {
  const owner = await requireXeriamoBrandingOwner();
  const admin = createAdminClient();
  const found = await admin.from("xeriano_branding_assets").select("role").eq("id", assetId).is("deleted_at", null).maybeSingle();
  if (found.error || !found.data) throw new XeriamoBrandingError("ASSET_NOT_FOUND", 404);
  if (found.data.role !== expectedRole) throw new XeriamoBrandingError("ROLE_MISMATCH", 400);
  const activated = await admin.rpc("xeriano_activate_branding_asset", { p_asset_id: assetId, p_actor_user_id: owner.userId });
  if (activated.error) throw new XeriamoBrandingError("BRANDING_UNAVAILABLE", 503);
}

export async function deleteBrandingAsset(assetId: string) {
  const owner = await requireXeriamoBrandingOwner();
  const admin = createAdminClient();
  const removed = await admin.rpc("xeriano_delete_inactive_branding_asset", { p_asset_id: assetId, p_actor_user_id: owner.userId });
  if (removed.error) {
    if (removed.error.message.includes("BRANDING_ACTIVE_ASSET")) throw new XeriamoBrandingError("ACTIVE_ASSET", 409);
    throw new XeriamoBrandingError("ASSET_NOT_FOUND", 404);
  }
  if (typeof removed.data === "string") await admin.storage.from(BUCKET).remove([removed.data]);
}
