import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  createTempReferenceSlot,
  requireTempReferenceRequest,
  XerianoTempReferenceError,
} from "@/lib/xeriano/temp-references/server";

export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof XerianoTempReferenceError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json(
      {
        success: false,
        error: "Diese Referenz kann nicht verwendet werden.",
        code: "TEMP_REFERENCE_INVALID",
      },
      { status: 400 },
    );
  }
  return NextResponse.json(
    {
      success: false,
      error: "Upload konnte nicht vorbereitet werden.",
      code: "TEMP_REFERENCE_UNAVAILABLE",
    },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  try {
    const context = await requireTempReferenceRequest(request);
    const slot = await createTempReferenceSlot({
      context,
      request: await request.json(),
    });
    return NextResponse.json({ success: true, ...slot });
  } catch (error) {
    return failure(error);
  }
}

