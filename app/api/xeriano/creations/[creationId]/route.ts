import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireXerianoAccount, XerianoAuthorizationError } from "@/lib/xeriano/server";

export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof XerianoAuthorizationError) {
    return NextResponse.json({ success: false, error: "Kein Zugriff." }, { status: error.status });
  }
  console.error("[Xeriano] Creation read failed", {
    message: error instanceof Error ? error.message : "unknown",
  });
  return NextResponse.json(
    { success: false, code: "CREATION_UNAVAILABLE", error: "Die Kreation ist gerade nicht verfügbar." },
    { status: 503 },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ creationId: string }> },
) {
  try {
    const account = await requireXerianoAccount();
    const { creationId } = await context.params;
    const admin = createAdminClient();
    const creation = await admin
      .from("xeriano_creations")
      .select("id,library_asset_id,creation_type,source_studio,source_job_id,source_result_id,original_prompt,model_id,settings,credit_cost,favorite,status,created_at")
      .eq("id", creationId)
      .eq("account_id", account.accountId)
      .maybeSingle();
    if (creation.error) throw creation.error;
    if (!creation.data) {
      return NextResponse.json(
        { success: false, code: "CREATION_NOT_FOUND", error: "Kreation nicht gefunden." },
        { status: 404 },
      );
    }
    const [asset, references] = await Promise.all([
      admin
        .from("xeriano_library_assets")
        .select("id,title,mime_type,favorite")
        .eq("id", creation.data.library_asset_id)
        .eq("account_id", account.accountId)
        .maybeSingle(),
      admin
        .from("xeriano_creation_references")
        .select("id,reference_order,role,source_kind,library_asset_id,source_job_id,source_result_id,filename,mime_type,byte_length,checksum_sha256")
        .eq("creation_id", creationId)
        .eq("account_id", account.accountId)
        .order("reference_order", { ascending: true }),
    ]);
    if (asset.error || references.error || !asset.data) {
      throw asset.error ?? references.error ?? new Error("creation_asset_missing");
    }
    return NextResponse.json({
      success: true,
      creation: {
        id: creation.data.id,
        assetId: asset.data.id,
        creationType: creation.data.creation_type,
        sourceStudio: creation.data.source_studio,
        sourceJobId: creation.data.source_job_id,
        sourceResultId: creation.data.source_result_id,
        title: asset.data.title,
        mimeType: asset.data.mime_type,
        originalPrompt: creation.data.original_prompt,
        modelId: creation.data.model_id,
        settings: creation.data.settings,
        creditCost: Number(creation.data.credit_cost),
        favorite: Boolean(creation.data.favorite || asset.data.favorite),
        status: creation.data.status,
        createdAt: creation.data.created_at,
        resultContentUrl: `/api/xeriano/library/${asset.data.id}/content`,
        resultDownloadUrl: `/api/xeriano/library/${asset.data.id}/content?download=1`,
        references: (references.data ?? []).map((reference) => ({
          id: reference.id,
          order: Number(reference.reference_order),
          role: reference.role,
          sourceKind: reference.source_kind,
          filename: reference.filename,
          mimeType: reference.mime_type,
          byteLength: Number(reference.byte_length),
          checksumSha256: reference.checksum_sha256,
          contentUrl: `/api/xeriano/creations/${creationId}/references/${reference.id}/content`,
          source:
            reference.source_kind === "LIBRARY_REFERENCE"
              ? { kind: "LIBRARY_REFERENCE", libraryAssetId: reference.library_asset_id }
              : reference.source_kind === "GENERATED_RESULT_REFERENCE"
                ? { kind: "GENERATED_RESULT_REFERENCE", sourceJobId: reference.source_job_id, sourceResultId: reference.source_result_id }
                : { kind: "LOCAL_FILE_REFERENCE" },
        })),
      },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ creationId: string }> },
) {
  try {
    const account = await requireXerianoAccount();
    const { creationId } = await context.params;
    const body = (await request.json()) as { favorite?: unknown };
    if (typeof body.favorite !== "boolean") {
      return NextResponse.json({ success: false, error: "Ungültige Aktion." }, { status: 400 });
    }
    const admin = createAdminClient();
    const creation = await admin
      .from("xeriano_creations")
      .select("library_asset_id")
      .eq("id", creationId)
      .eq("account_id", account.accountId)
      .maybeSingle();
    if (creation.error || !creation.data) {
      return NextResponse.json({ success: false, error: "Kreation nicht gefunden." }, { status: 404 });
    }
    const [updatedCreation, updatedAsset] = await Promise.all([
      admin
        .from("xeriano_creations")
        .update({ favorite: body.favorite })
        .eq("id", creationId)
        .eq("account_id", account.accountId),
      admin
        .from("xeriano_library_assets")
        .update({ favorite: body.favorite })
        .eq("id", creation.data.library_asset_id)
        .eq("account_id", account.accountId),
    ]);
    if (updatedCreation.error || updatedAsset.error) {
      throw updatedCreation.error ?? updatedAsset.error;
    }
    return NextResponse.json({ success: true, favorite: body.favorite });
  } catch (error) {
    return failure(error);
  }
}
