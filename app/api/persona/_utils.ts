import { NextResponse } from "next/server";
import { PersonaDomainError } from "@/lib/persona";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { resolvePersonaWorkspaceScope } from "@/lib/persona/services/workspace-scope";
import type { WorkspaceScope } from "@/lib/persona/domain/types";

const dict = getDictionary(DEFAULT_LOCALE);

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(error: unknown, fallback = dict.persona.errors.unexpected) {
  if (error instanceof PersonaDomainError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "UNAUTHORIZED_WORKSPACE"
          ? 403
          : error.code === "WORKFLOW" ||
              error.code === "MISSING_APPROVAL_PREREQUISITES"
            ? 409
            : error.code === "CONFIG"
              ? 503
              : error.code === "STORAGE_DELETE_FAILED"
                ? 500
                : 400;

    const localized =
      error.code === "CONFIG"
        ? dict.persona.errors.supabaseNotConfigured
        : error.code === "UNAUTHORIZED_WORKSPACE"
          ? dict.persona.errors.unauthorizedWorkspace
          : error.code === "MISSING_APPROVAL_PREREQUISITES"
            ? dict.persona.errors.missingApprovalPrerequisites
            : error.code === "INVALID_PRIMARY_REFERENCE"
              ? dict.persona.errors.invalidPrimary
              : error.code === "INVALID_REFERENCE_ASSET"
                ? dict.persona.errors.invalidReference
                : error.code === "STORAGE_UPLOAD_FAILED"
                  ? dict.persona.errors.storageFailed
                  : error.code === "STORAGE_DELETE_FAILED"
                    ? dict.persona.errors.storageDeleteFailed
                    : error.code === "WORKFLOW"
                    ? dict.persona.errors.workflow
                    : error.code === "NOT_FOUND"
                      ? dict.persona.errors.notFound
                      : error.message;

    return NextResponse.json(
      { error: localized, code: error.code, details: error.details },
      { status },
    );
  }

  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function requirePersonaScope(): Promise<
  { ok: true; scope: WorkspaceScope } | { ok: false; response: NextResponse }
> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: dict.persona.errors.supabaseNotConfigured },
        { status: 503 },
      ),
    };
  }

  try {
    const scope = await resolvePersonaWorkspaceScope();
    return { ok: true, scope };
  } catch (error) {
    return { ok: false, response: jsonError(error) };
  }
}

export { dict };
