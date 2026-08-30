import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { creativeReferenceSnapshotSchema } from "@/lib/creative-studio/contracts";
import {
  CreativeReferenceSnapshotValidationError,
  validateCreativeReferenceSnapshotAuthority,
} from "@/lib/creative-studio/reference-recovery-server";
import { SupabaseCreativeJobStore } from "@/lib/creative-studio/server-storage";
import { resolveXerianoAccess } from "@/lib/xeriano/auth";
import { resolveCreativeAccountJobScope } from "@/lib/creative-studio/account-history";

export const runtime = "nodejs";

async function authorize() {
  const access = await resolveXerianoAccess();
  if (access.status === "UNAUTHENTICATED") {
    return {
      response: NextResponse.json(
        { success: false, code: "AUTHENTICATION_REQUIRED", error: "Nicht angemeldet." },
        { status: 401 },
      ),
    } as const;
  }
  if (access.status !== "AUTHENTICATED") {
    return {
      response: NextResponse.json(
        { success: false, code: "XERIANO_FOUNDATION_UNAVAILABLE", error: "Xeriamo-Konto nicht verfügbar." },
        { status: 503 },
      ),
    } as const;
  }
  if (access.context.role !== "OWNER" && access.context.role !== "CUSTOMER") {
    return {
      response: NextResponse.json(
        { success: false, code: "CUSTOMER_ACCOUNT_REQUIRED", error: "Kein Zugriff." },
        { status: 403 },
      ),
    } as const;
  }
  return { context: access.context } as const;
}

function validJobId(jobId: string) {
  return /^[0-9a-f-]{36}$/i.test(jobId);
}

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ jobId: string }> },
) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { jobId } = await routeContext.params;
  if (!validJobId(jobId)) {
    return NextResponse.json(
      { success: false, code: "INVALID_REQUEST", error: "Der Auftrag ist ungültig." },
      { status: 400 },
    );
  }
  try {
    const scope = await resolveCreativeAccountJobScope({
      context: auth.context,
      jobId,
    });
    if (!scope) {
      return NextResponse.json(
        { success: false, code: "REFERENCE_SNAPSHOT_NOT_FOUND", error: "Kein Referenz-Snapshot vorhanden." },
        { status: 404 },
      );
    }
    const snapshot = await new SupabaseCreativeJobStore().readReferenceSnapshot(
      scope,
      jobId,
    );
    if (!snapshot) {
      return NextResponse.json(
        { success: false, code: "REFERENCE_SNAPSHOT_NOT_FOUND", error: "Kein Referenz-Snapshot vorhanden." },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, snapshot });
  } catch {
    return NextResponse.json(
      { success: false, code: "REFERENCE_SNAPSHOT_READ_FAILED", error: "Die Referenzen konnten gerade nicht geladen werden." },
      { status: 503 },
    );
  }
}

export async function PUT(
  request: Request,
  routeContext: { params: Promise<{ jobId: string }> },
) {
  const auth = await authorize();
  if ("response" in auth) return auth.response;
  const { jobId } = await routeContext.params;
  if (!validJobId(jobId)) {
    return NextResponse.json(
      { success: false, code: "INVALID_REQUEST", error: "Der Auftrag ist ungültig." },
      { status: 400 },
    );
  }
  try {
    const parsed = creativeReferenceSnapshotSchema.parse(await request.json());
    if (parsed.jobId !== jobId) {
      return NextResponse.json(
        { success: false, code: "INVALID_REQUEST", error: "Der Referenz-Snapshot passt nicht zum Auftrag." },
        { status: 400 },
      );
    }
    const scope = {
      workspaceId: auth.context.workspaceKey,
      actorId: auth.context.userId,
    };
    const snapshot = await validateCreativeReferenceSnapshotAuthority({
      accountId: auth.context.accountId,
      scope,
      snapshot: parsed,
    });
    await new SupabaseCreativeJobStore().writeReferenceSnapshot({
      scope,
      jobId,
      snapshot,
    });
    return NextResponse.json({ success: true, snapshot });
  } catch (error) {
    if (
      error instanceof ZodError ||
      error instanceof CreativeReferenceSnapshotValidationError
    ) {
      return NextResponse.json(
        { success: false, code: "INVALID_REFERENCE_SNAPSHOT", error: "Die Referenz-Herkunft ist ungültig." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, code: "REFERENCE_SNAPSHOT_WRITE_FAILED", error: "Die Referenz-Herkunft konnte nicht gespeichert werden." },
      { status: 503 },
    );
  }
}
