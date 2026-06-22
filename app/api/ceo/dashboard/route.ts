import { NextResponse } from "next/server";
import { getCeoDashboardData } from "@/lib/tasks/ceo-dashboard";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.ceo.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const dashboard = await getCeoDashboardData();

    return NextResponse.json(dashboard);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.ceo.errors.unexpected;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
