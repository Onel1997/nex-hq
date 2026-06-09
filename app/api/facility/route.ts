import { NextResponse } from "next/server";
import { getFacilitySnapshot } from "@/lib/facility/aggregate";
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

    const snapshot = await getFacilitySnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.ceo.errors.unexpected;
    console.error("[Facility]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
