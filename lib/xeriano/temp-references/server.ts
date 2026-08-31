import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  hasXerianoAccountMembership,
  resolveXerianoAccess,
  type XerianoAccountContext,
} from "@/lib/xeriano/auth";
import { authorizeXerianoGeneration } from "@/lib/xeriano/credit-guard";
import { assessTrustedXeriamoApplicationOrigin } from "@/lib/xeriano/request-origin";
import {
  XERIAMO_PROVIDER_REFERENCE_URL_TTL_SECONDS,
  XERIAMO_TEMP_REFERENCE_BUCKET,
  XERIAMO_TEMP_REFERENCE_TTL_SECONDS,
  xerianoTempReferenceSlotRequestSchema,
  type XerianoTempReferenceGenerateEntry,
  type XerianoTempReferenceKind,
  type XerianoTempReferenceStudio,
} from "./contracts";

type TempReferenceRow = {
  id: string;
  account_id: string;
  actor_user_id: string;
  studio: XerianoTempReferenceStudio;
  kind: XerianoTempReferenceKind;
  original_filename: string;
  mime_type: string;
  declared_byte_size: number;
  verified_byte_size: number | null;
  storage_bucket: typeof XERIAMO_TEMP_REFERENCE_BUCKET;
  storage_path: string;
  upload_state: "PENDING" | "READY" | "BOUND" | "DELETED";
  storage_object_id: string | null;
  checksum_sha256: string | null;
  duration_seconds: number | null;
  expires_at: string;
  bound_job_id: string | null;
};

export class XerianoTempReferenceError extends Error {
  constructor(
    readonly code:
      | "AUTHENTICATION_REQUIRED"
      | "ACCOUNT_REQUIRED"
      | "MUTATION_ORIGIN_REQUIRED"
      | "TEMP_REFERENCE_INVALID"
      | "TEMP_REFERENCE_INCOMPLETE"
      | "TEMP_REFERENCE_EXPIRED"
      | "TEMP_REFERENCE_FORBIDDEN"
      | "TEMP_REFERENCE_UNAVAILABLE",
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "XerianoTempReferenceError";
  }
}

const MIME_LIMITS: Record<
  XerianoTempReferenceStudio,
  Partial<Record<XerianoTempReferenceKind, Record<string, number>>>
> = {
  CREATIVE_STUDIO: {
    IMAGE: {
      "image/png": 8 * 1024 * 1024,
      "image/jpeg": 8 * 1024 * 1024,
      "image/webp": 8 * 1024 * 1024,
      "image/avif": 8 * 1024 * 1024,
    },
  },
  UGC_VIDEO_STUDIO: {
    IMAGE: {
      "image/png": 30 * 1024 * 1024,
      "image/jpeg": 30 * 1024 * 1024,
      "image/webp": 30 * 1024 * 1024,
      "image/gif": 30 * 1024 * 1024,
      "image/avif": 30 * 1024 * 1024,
    },
    VIDEO: {
      "video/mp4": 200 * 1024 * 1024,
      "video/quicktime": 200 * 1024 * 1024,
      "video/webm": 200 * 1024 * 1024,
      "video/x-m4v": 200 * 1024 * 1024,
    },
    AUDIO: {
      "audio/mpeg": 15 * 1024 * 1024,
      "audio/wav": 15 * 1024 * 1024,
      "audio/x-wav": 15 * 1024 * 1024,
    },
  },
};

function extensionForMime(mimeType: string): string {
  return (
    {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/avif": "avif",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
      "video/x-m4v": "m4v",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
    } as Record<string, string>
  )[mimeType] ?? "bin";
}

function assertDeclaredUpload(input: {
  studio: XerianoTempReferenceStudio;
  kind: XerianoTempReferenceKind;
  mimeType: string;
  byteSize: number;
}) {
  const mimeType = input.mimeType.toLowerCase();
  const limit = MIME_LIMITS[input.studio][input.kind]?.[mimeType];
  if (!limit || input.byteSize < 1 || input.byteSize > limit) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_INVALID",
      400,
      "Diese Referenz kann nicht verwendet werden.",
    );
  }
}

export async function requireTempReferenceRequest(
  request?: Request,
): Promise<XerianoAccountContext> {
  if (request) {
    const origin = assessTrustedXeriamoApplicationOrigin({
      originHeader: request.headers.get("origin"),
      requestUrl: request.url,
      applicationUrl: process.env.NEXT_PUBLIC_APP_URL,
      hostHeader: request.headers.get("host"),
      forwardedHostHeader: request.headers.get("x-forwarded-host"),
      forwardedProtoHeader: request.headers.get("x-forwarded-proto"),
      environment: process.env.NODE_ENV,
    });
    if (!origin.allowed) {
      throw new XerianoTempReferenceError(
        "MUTATION_ORIGIN_REQUIRED",
        403,
        "Keine Berechtigung für diese Aktion.",
      );
    }
  }
  const access = await resolveXerianoAccess();
  if (access.status === "UNAUTHENTICATED") {
    throw new XerianoTempReferenceError(
      "AUTHENTICATION_REQUIRED",
      401,
      "Bitte melde dich erneut an.",
    );
  }
  if (
    access.status !== "AUTHENTICATED" ||
    !hasXerianoAccountMembership(access.context) ||
    !authorizeXerianoGeneration(access.context).allowed
  ) {
    throw new XerianoTempReferenceError(
      "ACCOUNT_REQUIRED",
      403,
      "Für diese Referenz ist ein aktives Xeriamo-Konto erforderlich.",
    );
  }
  return access.context;
}

export async function createTempReferenceSlot(input: {
  context: XerianoAccountContext;
  request: unknown;
}) {
  const parsed = xerianoTempReferenceSlotRequestSchema.parse(input.request);
  const mimeType = parsed.mimeType.toLowerCase();
  assertDeclaredUpload({ ...parsed, mimeType });
  const id = randomUUID();
  const storagePath = `accounts/${input.context.accountId}/references/${id}/source.${extensionForMime(mimeType)}`;
  const expiresAt = new Date(
    Date.now() + XERIAMO_TEMP_REFERENCE_TTL_SECONDS * 1_000,
  ).toISOString();
  const admin = createAdminClient();
  const inserted = await admin.from("xeriano_temp_references").insert({
    id,
    account_id: input.context.accountId,
    actor_user_id: input.context.userId,
    studio: parsed.studio,
    kind: parsed.kind,
    original_filename: parsed.filename,
    mime_type: mimeType,
    declared_byte_size: parsed.byteSize,
    storage_bucket: XERIAMO_TEMP_REFERENCE_BUCKET,
    storage_path: storagePath,
    upload_state: "PENDING",
    expires_at: expiresAt,
  });
  if (inserted.error) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_UNAVAILABLE",
      503,
      "Upload konnte nicht vorbereitet werden.",
    );
  }
  const signed = await admin.storage
    .from(XERIAMO_TEMP_REFERENCE_BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: false });
  if (signed.error) {
    await admin.from("xeriano_temp_references").delete().eq("id", id);
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_UNAVAILABLE",
      503,
      "Upload konnte nicht vorbereitet werden.",
    );
  }
  return {
    referenceId: id,
    path: signed.data.path,
    token: signed.data.token,
    expiresAt,
  };
}

function signatureMatches(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png")
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (mimeType === "image/webp")
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "image/gif") return /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii"));
  if (mimeType === "image/avif") return bytes.subarray(4, 12).toString("ascii").includes("ftypavif");
  if (["video/mp4", "video/quicktime", "video/x-m4v"].includes(mimeType))
    return bytes.subarray(4, 8).toString("ascii") === "ftyp";
  if (mimeType === "video/webm") return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mimeType === "audio/mpeg")
    return bytes.subarray(0, 3).toString("ascii") === "ID3" || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0);
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav")
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WAVE";
  return false;
}

async function ownedRow(input: {
  context: XerianoAccountContext;
  referenceId: string;
}): Promise<TempReferenceRow> {
  const found = await createAdminClient()
    .from("xeriano_temp_references")
    .select("id,account_id,actor_user_id,studio,kind,original_filename,mime_type,declared_byte_size,verified_byte_size,storage_bucket,storage_path,upload_state,storage_object_id,checksum_sha256,duration_seconds,expires_at,bound_job_id")
    .eq("id", input.referenceId)
    .eq("account_id", input.context.accountId)
    .eq("actor_user_id", input.context.userId)
    .maybeSingle();
  if (found.error || !found.data) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_FORBIDDEN",
      403,
      "Diese Referenz gehört nicht zum aktiven Konto.",
    );
  }
  return found.data as TempReferenceRow;
}

async function inspectStorageObject(row: TempReferenceRow) {
  const storage = createAdminClient().storage.from(row.storage_bucket);
  const info = await storage.info(row.storage_path);
  if (info.error || !info.data) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_INCOMPLETE",
      409,
      "Eine Referenz wurde noch nicht vollständig hochgeladen.",
    );
  }
  const byteSize = Number(info.data.size ?? info.data.metadata?.size ?? 0);
  const contentType = String(
    info.data.contentType ?? info.data.metadata?.mimetype ?? "",
  ).toLowerCase();
  if (
    byteSize !== Number(row.declared_byte_size) ||
    contentType !== row.mime_type
  ) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_INVALID",
      400,
      "Diese Referenz kann nicht verwendet werden.",
    );
  }
  const signed = await storage.createSignedUrl(row.storage_path, 60);
  if (signed.error) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_UNAVAILABLE",
      503,
      "Die Referenz konnte nicht geprüft werden.",
    );
  }
  const prefixResponse = await fetch(signed.data.signedUrl, {
    headers: { Range: "bytes=0-65535" },
    cache: "no-store",
  });
  if (!prefixResponse.ok && prefixResponse.status !== 206) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_INCOMPLETE",
      409,
      "Eine Referenz wurde noch nicht vollständig hochgeladen.",
    );
  }
  const prefix = Buffer.from(await prefixResponse.arrayBuffer());
  if (!signatureMatches(prefix, row.mime_type)) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_INVALID",
      400,
      "Diese Referenz kann nicht verwendet werden.",
    );
  }
  return { objectId: info.data.id, byteSize };
}

export async function completeTempReference(input: {
  context: XerianoAccountContext;
  referenceId: string;
}) {
  const row = await ownedRow(input);
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_EXPIRED",
      410,
      "Diese Referenz ist abgelaufen. Bitte lade sie erneut hoch.",
    );
  }
  const inspected = await inspectStorageObject(row);
  const updated = await createAdminClient()
    .from("xeriano_temp_references")
    .update({
      upload_state: "READY",
      verified_byte_size: inspected.byteSize,
      storage_object_id: inspected.objectId,
    })
    .eq("id", row.id)
    .eq("account_id", input.context.accountId)
    .eq("upload_state", "PENDING");
  if (updated.error) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_UNAVAILABLE",
      503,
      "Der Upload konnte nicht abgeschlossen werden.",
    );
  }
  return { ready: true as const };
}

export type ResolvedTempReference = {
  id: string;
  authorityId: string;
  kind: XerianoTempReferenceKind;
  name: string;
  mimeType: string;
  byteSize: number;
  bytes: Buffer;
  checksumSha256: string;
  providerUrl: string;
};

/** Resolve opaque ids before quote/reservation; no client URL/path is trusted. */
export async function resolveTempReferences(input: {
  context: XerianoAccountContext;
  studio: XerianoTempReferenceStudio;
  entries: XerianoTempReferenceGenerateEntry[];
  jobId: string;
}): Promise<ResolvedTempReference[]> {
  if (new Set(input.entries.map((entry) => entry.tempReferenceId)).size !== input.entries.length) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_INVALID",
      400,
      "Die Referenzen konnten nicht eindeutig zugeordnet werden.",
    );
  }
  const resolved: ResolvedTempReference[] = [];
  for (const entry of input.entries) {
    const row = await ownedRow({
      context: input.context,
      referenceId: entry.tempReferenceId,
    });
    if (row.studio !== input.studio || row.upload_state === "DELETED") {
      throw new XerianoTempReferenceError(
        "TEMP_REFERENCE_FORBIDDEN",
        403,
        "Diese Referenz gehört nicht zum aktiven Studio.",
      );
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      throw new XerianoTempReferenceError(
        "TEMP_REFERENCE_EXPIRED",
        410,
        "Diese Referenz ist abgelaufen. Bitte lade sie erneut hoch.",
      );
    }
    if (row.upload_state !== "READY" && row.upload_state !== "BOUND") {
      throw new XerianoTempReferenceError(
        "TEMP_REFERENCE_INCOMPLETE",
        409,
        "Eine Referenz wurde noch nicht vollständig hochgeladen.",
      );
    }
    await inspectStorageObject(row);
    const downloaded = await createAdminClient().storage
      .from(row.storage_bucket)
      .download(row.storage_path);
    if (downloaded.error) {
      throw new XerianoTempReferenceError(
        "TEMP_REFERENCE_INCOMPLETE",
        409,
        "Eine Referenz wurde noch nicht vollständig hochgeladen.",
      );
    }
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    if (
      bytes.byteLength !== Number(row.verified_byte_size) ||
      !signatureMatches(bytes, row.mime_type)
    ) {
      throw new XerianoTempReferenceError(
        "TEMP_REFERENCE_INVALID",
        400,
        "Diese Referenz kann nicht verwendet werden.",
      );
    }
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const signed = await createAdminClient().storage
      .from(row.storage_bucket)
      .createSignedUrl(
        row.storage_path,
        XERIAMO_PROVIDER_REFERENCE_URL_TTL_SECONDS,
      );
    if (signed.error) {
      throw new XerianoTempReferenceError(
        "TEMP_REFERENCE_UNAVAILABLE",
        503,
        "Die Referenz konnte nicht vorbereitet werden.",
      );
    }
    await createAdminClient()
      .from("xeriano_temp_references")
      .update({
        checksum_sha256: checksumSha256,
      })
      .eq("id", row.id)
      .eq("account_id", input.context.accountId);
    resolved.push({
      id: entry.referenceId,
      authorityId: row.id,
      kind: row.kind,
      name: row.original_filename,
      mimeType: row.mime_type,
      byteSize: bytes.byteLength,
      bytes,
      checksumSha256,
      providerUrl: signed.data.signedUrl,
    });
  }
  return resolved;
}

/** Bind only after customer reservation succeeds (Owner has no reservation). */
export async function bindTempReferences(input: {
  context: XerianoAccountContext;
  referenceIds: string[];
  jobId: string;
}) {
  if (!input.referenceIds.length) return;
  const updated = await createAdminClient()
    .from("xeriano_temp_references")
    .update({ upload_state: "BOUND", bound_job_id: input.jobId })
    .eq("account_id", input.context.accountId)
    .eq("actor_user_id", input.context.userId)
    .in("id", input.referenceIds)
    .in("upload_state", ["READY", "BOUND"])
    .select("id");
  if (
    updated.error ||
    !updated.data ||
    updated.data.length !== input.referenceIds.length
  ) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_UNAVAILABLE",
      503,
      "Die Referenzen konnten nicht an den Auftrag gebunden werden.",
    );
  }
}

export async function deleteTempReference(input: {
  context: XerianoAccountContext;
  referenceId: string;
}) {
  const row = await ownedRow(input);
  if (row.upload_state === "BOUND") return { deleted: false as const };
  await createAdminClient().storage.from(row.storage_bucket).remove([row.storage_path]);
  const removed = await createAdminClient()
    .from("xeriano_temp_references")
    .update({ upload_state: "DELETED" })
    .eq("id", row.id)
    .eq("account_id", input.context.accountId);
  if (removed.error) {
    throw new XerianoTempReferenceError(
      "TEMP_REFERENCE_UNAVAILABLE",
      503,
      "Die Referenz konnte nicht entfernt werden.",
    );
  }
  return { deleted: true as const };
}
