import { NextResponse } from "next/server";
import { listDesignAccountHistory } from "@/lib/design-studio/account-history";
import { hasXerianoAccountMembership, resolveXerianoAccess } from "@/lib/xeriano/auth";

export async function GET(request: Request) {
  const access = await resolveXerianoAccess();
  if (access.status !== "AUTHENTICATED" || !hasXerianoAccountMembership(access.context)) return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });
  const requested = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "40", 10);
  try {
    const runs = await listDesignAccountHistory(access.context, Math.min(Math.max(requested || 40, 1), 60));
    return NextResponse.json({ success: true, runs });
  } catch {
    return NextResponse.json({ error: "Der Verlauf ist gerade nicht verfügbar." }, { status: 503 });
  }
}
