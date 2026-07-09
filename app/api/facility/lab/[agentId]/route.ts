import { NextResponse } from "next/server";
import { AGENT_IDS } from "@/lib/constants/agents";
import { getLabInspectorData } from "@/lib/facility/inspector";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const dict = getDictionary(DEFAULT_LOCALE);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: dict.ceo.errors.supabaseNotConfigured },
        { status: 503 },
      );
    }

    const { agentId } = await params;
    if (!AGENT_IDS.includes(agentId as (typeof AGENT_IDS)[number])) {
      return NextResponse.json({ error: "Invalid agent" }, { status: 400 });
    }

    const data = await getLabInspectorData(
      agentId as (typeof AGENT_IDS)[number],
    );
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : dict.ceo.errors.unexpected;
    console.error("[Facility Lab]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
