import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { SupabaseCreativeJobStore } from "@/lib/creative-studio/server-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupabaseUgcVideoJobStore } from "@/lib/ugc-video-studio/server-storage";
import {
  xerianoResultLibraryImportSchema,
} from "@/lib/xeriano/library";
import {
  requireXerianoAccount,
  XerianoAuthorizationError,
} from "@/lib/xeriano/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await requireXerianoAccount();
    const input = xerianoResultLibraryImportSchema.parse(await request.json());
    const admin = createAdminClient();
    const existing = await admin
      .from("xeriano_library_assets")
      .select("id")
      .eq("account_id", context.accountId)
      .eq("source_studio", input.sourceStudio)
      .eq("source_job_id", input.sourceJobId)
      .eq("source_result_id", input.sourceResultId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      return NextResponse.json({ success: true, assetId: existing.data.id, reused: true });
    }

    const scope = { workspaceId: context.workspaceKey, actorId: context.userId };
    const asset =
      input.sourceStudio === "CREATIVE_STUDIO"
        ? await new SupabaseCreativeJobStore().readResult({
            scope,
            jobId: input.sourceJobId,
            resultId: input.sourceResultId,
          })
        : await new SupabaseUgcVideoJobStore().readResult({
            scope,
            jobId: input.sourceJobId,
            resultId: input.sourceResultId,
          });
    if (!asset) {
      return NextResponse.json(
        { success: false, code: "RESULT_NOT_FOUND", error: "Das Ergebnis wurde nicht gefunden." },
        { status: 404 },
      );
    }
    if (asset.bytes.byteLength > 50 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, code: "RESULT_TOO_LARGE", error: "Das Ergebnis ist für die Bibliothek zu groß." },
        { status: 413 },
      );
    }
    const assetType = input.sourceStudio === "CREATIVE_STUDIO" ? "IMAGE" : "VIDEO";
    const extension = assetType === "VIDEO" ? "mp4" : asset.mimeType === "image/jpeg" ? "jpg" : asset.mimeType === "image/webp" ? "webp" : "png";
    const storagePath = `accounts/${context.accountId}/generated/${input.sourceStudio.toLowerCase()}/${input.sourceJobId}/${input.sourceResultId}.${extension}`;
    const upload = await admin.storage
      .from("xeriano-library-assets")
      .upload(storagePath, asset.bytes, {
        contentType: asset.mimeType,
        upsert: false,
      });
    if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) {
      throw upload.error;
    }
    const inserted = await admin
      .from("xeriano_library_assets")
      .insert({
        account_id: context.accountId,
        owner_user_id: context.userId,
        asset_type: assetType,
        title: input.title.trim().slice(0, 160),
        description: null,
        source_studio: input.sourceStudio,
        source_job_id: input.sourceJobId,
        source_result_id: input.sourceResultId,
        storage_bucket: "xeriano-library-assets",
        storage_path: storagePath,
        mime_type: asset.mimeType,
        byte_length: asset.bytes.byteLength,
        checksum_sha256: createHash("sha256").update(asset.bytes).digest("hex"),
        favorite: false,
        tags: [],
        provenance: {
          contractVersion: input.version,
          importedAt: new Date().toISOString(),
        },
      })
      .select("id")
      .single();
    if (inserted.error) {
      const raced = await admin
        .from("xeriano_library_assets")
        .select("id")
        .eq("account_id", context.accountId)
        .eq("source_studio", input.sourceStudio)
        .eq("source_job_id", input.sourceJobId)
        .eq("source_result_id", input.sourceResultId)
        .maybeSingle();
      if (raced.data) {
        return NextResponse.json({ success: true, assetId: raced.data.id, reused: true });
      }
      await admin.storage.from("xeriano-library-assets").remove([storagePath]);
      throw inserted.error;
    }
    return NextResponse.json({ success: true, assetId: inserted.data.id, reused: false });
  } catch (error) {
    if (error instanceof XerianoAuthorizationError) {
      return NextResponse.json({ success: false, error: "Kein Zugriff." }, { status: error.status });
    }
    console.error("[Xeriano] Result Library import failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { success: false, code: "LIBRARY_IMPORT_FAILED", error: "Das Ergebnis konnte nicht in der Bibliothek gespeichert werden." },
      { status: 503 },
    );
  }
}
