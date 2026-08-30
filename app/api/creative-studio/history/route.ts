import { NextResponse } from "next/server";

import { listCreativeAccountHistory } from "@/lib/creative-studio/account-history";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await resolveXerianoAccess();
  if (access.status === "UNAUTHENTICATED") {
    return NextResponse.json(
      { success: false, code: "AUTHENTICATION_REQUIRED", error: "Nicht angemeldet." },
      { status: 401 },
    );
  }
  if (access.status !== "AUTHENTICATED") {
    return NextResponse.json(
      { success: false, code: "XERIANO_FOUNDATION_UNAVAILABLE", error: "Xeriamo-Konto nicht verfügbar." },
      { status: 503 },
    );
  }
  if (access.context.role === "OWNER") {
    return NextResponse.json({ success: true, runs: [] });
  }
  try {
    const requested = Number(new URL(request.url).searchParams.get("limit") ?? 60);
    const runs = await listCreativeAccountHistory({
      context: access.context,
      limit: Number.isFinite(requested) ? requested : 60,
    });
    return NextResponse.json(
      { success: true, runs },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[Creative Studio] Account history read failed", {
      accountId: access.context.accountId,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { success: false, code: "CREATIVE_HISTORY_UNAVAILABLE", error: "Der Verlauf ist gerade nicht verfügbar." },
      { status: 503 },
    );
  }
}
