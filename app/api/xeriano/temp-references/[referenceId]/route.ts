import { NextResponse } from "next/server";

import {
  deleteTempReference,
  requireTempReferenceRequest,
  XerianoTempReferenceError,
} from "@/lib/xeriano/temp-references/server";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ referenceId: string }> },
) {
  try {
    const account = await requireTempReferenceRequest(request);
    const { referenceId } = await context.params;
    const result = await deleteTempReference({
      context: account,
      referenceId,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof XerianoTempReferenceError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, error: "Die Referenz konnte nicht entfernt werden." },
      { status: 503 },
    );
  }
}

