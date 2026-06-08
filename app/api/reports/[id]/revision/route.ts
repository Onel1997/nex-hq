import { NextResponse } from "next/server";
import {
  ReportReviewError,
  reviewReportRecord,
  type ReviewReportOptions,
} from "@/lib/reports/review-report";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

async function parseReviewBody(request: Request): Promise<ReviewReportOptions> {
  try {
    const body = (await request.json()) as { note?: unknown };
    if (typeof body.note === "string") {
      return { note: body.note };
    }
  } catch {
    // Empty body is valid.
  }
  return {};
}

function handleReviewError(error: unknown) {
  if (error instanceof ReportReviewError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "INVALID_STATUS"
          ? 409
          : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  const message =
    error instanceof Error ? error.message : dict.research.errors.unexpected;
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.research.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const { id } = await context.params;
    const options = await parseReviewBody(request);
    const result = await reviewReportRecord(id, "revision", options);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleReviewError(error);
  }
}
