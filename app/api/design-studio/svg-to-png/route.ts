import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  loadOwnedDesignSvgSource,
  renderDesignSvgPng,
  SVG_TO_PNG_OPERATION,
  SvgToPngError,
  svgToPngRequestSchema,
} from "@/lib/design-studio/svg-to-png";
import { persistDesignUtilityResult } from "@/lib/design-studio/projection";
import { requireXerianoAccount, XerianoAuthorizationError } from "@/lib/xeriano/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(error: string, code: string, status: number) {
  return NextResponse.json({ success: false, error, code }, { status });
}

export async function POST(request: Request) {
  try {
    const context = await requireXerianoAccount();
    const input = svgToPngRequestSchema.parse(await request.json());
    const source = await loadOwnedDesignSvgSource(context, input.sourceAssetId);
    const bytes = await renderDesignSvgPng(source);
    const result = await persistDesignUtilityResult({
      context,
      jobId: input.jobId,
      operation: SVG_TO_PNG_OPERATION,
      sourceAssetId: input.sourceAssetId,
      bytes,
    });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof XerianoAuthorizationError) {
      return fail("Kein Zugriff.", error.code, error.status);
    }
    if (error instanceof SvgToPngError) {
      return fail(error.message, error.code, error.status);
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return fail("Die Aktion ist ungültig.", "INVALID_REQUEST", 400);
    }
    console.error("[xeriamo-design] SVG conversion failed", {
      code: "SVG_TO_PNG_FAILED",
      stage: "server_transform",
    });
    return fail("PNG-Version konnte nicht erstellt werden. Bitte versuche es erneut.", "SVG_TO_PNG_FAILED", 503);
  }
}
