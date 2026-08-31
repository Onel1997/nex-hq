import { NextResponse } from "next/server";

import {
  completeTempReference,
  requireTempReferenceRequest,
  XerianoTempReferenceError,
} from "@/lib/xeriano/temp-references/server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ referenceId: string }> },
) {
  try {
    const account = await requireTempReferenceRequest(request);
    const { referenceId } = await context.params;
    const completed = await completeTempReference({
      context: account,
      referenceId,
    });
    return NextResponse.json({ success: true, ...completed });
  } catch (error) {
    if (error instanceof XerianoTempReferenceError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: "Der Upload konnte nicht abgeschlossen werden.",
        code: "TEMP_REFERENCE_UNAVAILABLE",
      },
      { status: 503 },
    );
  }
}

