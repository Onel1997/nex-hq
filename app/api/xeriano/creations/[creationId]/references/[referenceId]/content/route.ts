import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { SupabaseCreativeJobStore } from "@/lib/creative-studio/server-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireXerianoAccount, XerianoAuthorizationError } from "@/lib/xeriano/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ creationId: string; referenceId: string }>;
  },
) {
  try {
    const account = await requireXerianoAccount();
    const { creationId, referenceId } = await context.params;
    const admin = createAdminClient();
    const reference = await admin
      .from("xeriano_creation_references")
      .select("source_kind,library_asset_id,source_job_id,source_result_id,mime_type,byte_length,checksum_sha256,storage_path")
      .eq("id", referenceId)
      .eq("creation_id", creationId)
      .eq("account_id", account.accountId)
      .maybeSingle();
    if (reference.error || !reference.data) {
      return NextResponse.json({ error: "Referenz nicht gefunden." }, { status: 404 });
    }
    let bytes: Buffer;
    let mimeType = reference.data.mime_type;
    if (reference.data.source_kind === "LOCAL_FILE_REFERENCE") {
      const stored = reference.data.storage_path
        ? await new SupabaseCreativeJobStore().readCreationReference(
            reference.data.storage_path,
          )
        : null;
      if (!stored) throw new Error("local_creation_reference_missing");
      bytes = stored.bytes;
      mimeType = stored.mimeType;
    } else if (reference.data.source_kind === "LIBRARY_REFERENCE") {
      const asset = await admin
        .from("xeriano_library_assets")
        .select("storage_bucket,storage_path,mime_type")
        .eq("id", reference.data.library_asset_id)
        .eq("account_id", account.accountId)
        .maybeSingle();
      if (asset.error || !asset.data) throw new Error("library_reference_missing");
      const downloaded = await admin.storage
        .from(asset.data.storage_bucket)
        .download(asset.data.storage_path);
      if (downloaded.error) throw downloaded.error;
      bytes = Buffer.from(await downloaded.data.arrayBuffer());
      mimeType = asset.data.mime_type;
    } else {
      const stored = await new SupabaseCreativeJobStore().readResult({
        scope: {
          workspaceId: account.workspaceKey,
          actorId: account.userId,
        },
        jobId: reference.data.source_job_id,
        resultId: reference.data.source_result_id,
      });
      if (!stored) throw new Error("generated_reference_missing");
      bytes = stored.bytes;
      mimeType = stored.mimeType;
    }
    const checksum = createHash("sha256").update(bytes).digest("hex");
    if (
      bytes.byteLength !== Number(reference.data.byte_length) ||
      checksum !== reference.data.checksum_sha256
    ) {
      throw new Error("creation_reference_integrity_failed");
    }
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof XerianoAuthorizationError) {
      return NextResponse.json({ error: "Kein Zugriff." }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Referenz konnte nicht geladen werden." },
      { status: 503 },
    );
  }
}
