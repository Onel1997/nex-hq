import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { updateXeriamoMaintenanceSchema } from "@/lib/xeriano/maintenance/contracts";
import {
  loadOwnerMaintenanceStatus,
  updateMaintenanceStatus,
  XeriamoMaintenanceError,
} from "@/lib/xeriano/maintenance/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof XeriamoMaintenanceError) {
    const message = error.code === "OWNER_REQUIRED" || error.code === "MUTATION_ORIGIN_REQUIRED"
      ? "Keine Berechtigung für diese Aktion."
      : "Der Xeriamo Status ist gerade nicht verfügbar.";
    return NextResponse.json(
      { success: false, code: error.code, error: message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return NextResponse.json(
      { success: false, code: "INVALID_MAINTENANCE_CONFIG", error: "Die Status-Einstellungen sind ungültig." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { success: false, code: "MAINTENANCE_UNAVAILABLE", error: "Der Xeriamo Status ist gerade nicht verfügbar." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET() {
  try {
    return NextResponse.json(
      { success: true, status: await loadOwnerMaintenanceStatus() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const input = updateXeriamoMaintenanceSchema.parse(await request.json());
    const status = await updateMaintenanceStatus({
      request,
      enabled: input.enabled,
      message: input.message || null,
      expectedBackAt: input.expectedBackAt,
      discordEnabled: input.discordEnabled,
    });
    return NextResponse.json(
      { success: true, status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
