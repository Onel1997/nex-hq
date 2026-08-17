/**
 * Persona API authorization boundary.
 *
 * NexHQ does not yet have a durable workspace-membership model. Production
 * Persona access therefore fails closed to a server-configured user allowlist
 * for the server-configured active workspace. Local development may opt into
 * an explicit non-production bypass; it is never treated as production auth.
 */

import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { resolveValidatedNexhqActor } from "@/lib/auth/authentication";
import { PersonaDomainError } from "../domain/errors";
import type { WorkspaceScope } from "../domain/types";

export const PERSONA_LOCAL_DEV_ACTOR_ID = "persona-local-development" as const;

export type PersonaAuthorizationMode =
  | "authenticated_allowlist"
  | "local_development_bypass";

export type PersonaAuthorizationContext = WorkspaceScope & {
  actorId: string;
  authenticatedUserId: string | null;
  accessMode: PersonaAuthorizationMode;
  workspaceSource: "server_environment";
  authorized: true;
};

export type PersonaActorAuthorization = Pick<
  PersonaAuthorizationContext,
  "actorId" | "authenticatedUserId" | "accessMode" | "authorized"
>;

function enabled(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

export function parsePersonaAuthorizedUserIds(
  value: string | undefined,
): string[] {
  return [...new Set((value ?? "").split(",").map((id) => id.trim()).filter(Boolean))];
}

export function authorizePersonaActor(input: {
  environment: string;
  authenticatedUserId: string | null;
  authorizedUserIds: readonly string[];
  localDevelopmentBypassEnabled: boolean;
}): PersonaActorAuthorization {
  const production = input.environment === "production";
  const userId = input.authenticatedUserId?.trim() || null;

  if (userId && input.authorizedUserIds.includes(userId)) {
    return {
      actorId: userId,
      authenticatedUserId: userId,
      accessMode: "authenticated_allowlist",
      authorized: true,
    };
  }

  if (!production && input.localDevelopmentBypassEnabled) {
    return {
      actorId: userId ?? PERSONA_LOCAL_DEV_ACTOR_ID,
      authenticatedUserId: userId,
      accessMode: "local_development_bypass",
      authorized: true,
    };
  }

  if (!userId) {
    throw new PersonaDomainError(
      "Authentication is required for Persona Studio operations.",
      "AUTHENTICATION_REQUIRED",
      { reason: "missing_authenticated_actor" },
    );
  }

  throw new PersonaDomainError(
    "The authenticated actor is not authorized for the active Persona workspace.",
    "UNAUTHORIZED_WORKSPACE",
    {
      reason:
        input.authorizedUserIds.length === 0
          ? "persona_authorized_user_ids_not_configured"
          : "actor_not_authorized_for_persona_workspace",
    },
  );
}

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createServerSupabase();
    const authentication = await resolveValidatedNexhqActor(() =>
      supabase.auth.getUser(),
    );
    return authentication.authenticated
      ? authentication.actor.userId
      : null;
  } catch {
    return null;
  }
}

export type PersonaAuthorizationDependencies = {
  environment?: string;
  authorizedUserIds?: readonly string[];
  localDevelopmentBypassEnabled?: boolean;
  getAuthenticatedUserId?: () => Promise<string | null>;
  resolveServerWorkspaceId?: () => Promise<string>;
};

/**
 * Authenticate and authorize before resolving the service-role-backed
 * workspace. This ordering prevents a rejected request from reaching a
 * privileged workspace seed/repository operation.
 */
export async function resolvePersonaAuthorizationContext(
  dependencies: PersonaAuthorizationDependencies = {},
): Promise<PersonaAuthorizationContext> {
  const actor = authorizePersonaActor({
    environment: dependencies.environment ?? process.env.NODE_ENV ?? "development",
    authenticatedUserId: await (
      dependencies.getAuthenticatedUserId ?? getAuthenticatedUserId
    )(),
    authorizedUserIds:
      dependencies.authorizedUserIds ??
      parsePersonaAuthorizedUserIds(process.env.NEXHQ_PERSONA_AUTHORIZED_USER_IDS),
    localDevelopmentBypassEnabled:
      dependencies.localDevelopmentBypassEnabled ??
      enabled(process.env.NEXHQ_PERSONA_DEV_AUTH_BYPASS),
  });

  const workspaceId = dependencies.resolveServerWorkspaceId
    ? await dependencies.resolveServerWorkspaceId()
    : (await ensureWorkspaceBrainSeeded()).workspace.id;

  return {
    ...actor,
    workspaceId,
    workspaceSource: "server_environment",
  };
}
