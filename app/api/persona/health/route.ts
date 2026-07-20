import { NextResponse } from "next/server";
import { checkPersonaStudioHealth } from "@/lib/persona/services/health";

/**
 * GET /api/persona/health
 * Safe production readiness probe — no secrets exposed.
 */
export async function GET() {
  try {
    const health = await checkPersonaStudioHealth();
    const httpStatus =
      health.status === "healthy" ? 200 : health.status === "degraded" ? 503 : 503;
    return NextResponse.json(health, { status: httpStatus });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unavailable",
        uiLabel: "Fehler",
        message:
          error instanceof Error
            ? error.message
            : "Persona Studio Health-Check fehlgeschlagen.",
        repositoryMode: "unconfigured",
        schemaVersion: null,
        checks: [],
        workspaceId: null,
        memoryFallback: false,
        checkedAt: new Date().toISOString(),
        paidGenerationSafety: {
          openaiApiKeyConfigured: false,
          paidGenerationEnabled: false,
          fakeProviderActive: true,
          liveTestsEnabled: false,
        },
      },
      { status: 503 },
    );
  }
}
