import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  completeDesignPrintFileManifest,
  DesignPrintFileError,
  executeDesignPrintFile,
  loadOwnedDesignPrintSource,
} from "@/lib/design-studio/print-file";
import { PRINT_FILE_OPERATION, printFileRequestSchema } from "@/lib/design-studio/print-file-contracts";
import { persistDesignUtilityResult } from "@/lib/design-studio/projection";
import { requireXerianoAccount, XerianoAuthorizationError } from "@/lib/xeriano/server";

export const runtime = "nodejs";
export const maxDuration = 120;

function fail(error: string, code: string, status: number) {
  return NextResponse.json({ success: false, error, code }, { status });
}

export async function POST(request: Request) {
  try {
    const context = await requireXerianoAccount();
    const input = printFileRequestSchema.parse(await request.json());
    const source = await loadOwnedDesignPrintSource(context, input.sourceAssetId, input.removeBackground);
    const execution = await executeDesignPrintFile({
      context,
      scope: { workspaceId: context.workspaceKey, actorId: context.userId },
      jobId: input.jobId,
      sourceAssetId: input.sourceAssetId,
      removeBackground: input.removeBackground,
      source,
    });
    if (!execution.bytes) {
      return NextResponse.json({
        success: execution.manifest.status === "SUCCEEDED",
        status: execution.manifest.status,
        result: execution.manifest.resultAssetId ? {
          assetId: execution.manifest.resultAssetId,
          creationId: execution.manifest.resultCreationId,
          width: execution.manifest.width,
          height: execution.manifest.height,
        } : null,
      }, { status: execution.manifest.status === "SUCCEEDED" ? 200 : 409 });
    }
    const projected = await persistDesignUtilityResult({
      context,
      jobId: input.jobId,
      operation: PRINT_FILE_OPERATION,
      sourceAssetId: input.sourceAssetId,
      bytes: execution.bytes,
      printSource: {
        mimeType: source.mimeType,
        width: source.sourceWidth,
        height: source.sourceHeight,
        rasterUpscaled: source.rasterUpscaled,
      },
    });
    await completeDesignPrintFileManifest({ manifest: execution.manifest, result: projected });
    return NextResponse.json({ success: true, status: "SUCCEEDED", result: projected });
  } catch (error) {
    if (error instanceof XerianoAuthorizationError) return fail("Kein Zugriff.", error.code, error.status);
    if (error instanceof DesignPrintFileError) return fail(error.message, error.code, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError) return fail("Die Aktion ist ungültig.", "INVALID_REQUEST", 400);
    console.error("[xeriamo-design] print file failed", { code: "PRINT_FILE_FAILED", stage: "server_transform" });
    return fail("Druckdatei konnte nicht erstellt werden. Bitte versuche es erneut.", "PRINT_FILE_FAILED", 503);
  }
}
