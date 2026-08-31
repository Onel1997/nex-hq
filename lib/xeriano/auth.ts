import "server-only";

import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { resolveServerNexhqAuthentication } from "@/lib/auth/server";
import { parsePersonaAuthorizedUserIds } from "@/lib/persona/security/authorization";
import {
  selectXerianoAccountContext,
  type XerianoAccountContext,
  type XerianoMembershipAuthority,
  type XerianoRole,
} from "./access-policy";

export {
  hasXerianoAccountMembership,
  hasXerianoOwnerAuthority,
} from "./access-policy";
export type { XerianoAccountContext, XerianoRole } from "./access-policy";

export type XerianoAccessResult =
  | { status: "AUTHENTICATED"; context: XerianoAccountContext }
  | { status: "UNAUTHENTICATED" }
  | { status: "FOUNDATION_UNAVAILABLE"; userId: string; email: string | null };

function legacyOwnerIds(env: NodeJS.ProcessEnv): string[] {
  const explicitOwnerIds = parsePersonaAuthorizedUserIds(env.NEXHQ_OWNER_USER_IDS);
  if (explicitOwnerIds.length) return [...new Set(explicitOwnerIds)];
  // Temporary compatibility only: existing installations used the Persona
  // owner allowlist before NEXHQ_OWNER_USER_IDS existed.
  return [...new Set(parsePersonaAuthorizedUserIds(env.NEXHQ_PERSONA_AUTHORIZED_USER_IDS))];
}

export async function resolveXerianoAccess(): Promise<XerianoAccessResult> {
  const authentication = await resolveServerNexhqAuthentication();
  if (!authentication.authenticated) return { status: "UNAUTHENTICATED" };
  const { userId, email } = authentication.actor;
  const legacyOwner = legacyOwnerIds(process.env).includes(userId);
  const legacyWorkspaceKey = process.env.NEXHQ_WORKSPACE_SLUG ?? "owner";
  try {
    const supabase = await createServerSupabase();
    const [{ data, error }, ownerMembership] = await Promise.all([
      supabase
        .from("xeriano_account_memberships")
        .select("account_id,role,status,is_primary,xeriano_accounts!inner(id,name,studio_workspace_key,brain_workspace_id,status)")
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .eq("is_primary", true)
        .maybeSingle(),
      supabase
        .from("xeriano_account_memberships")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "OWNER")
        .eq("status", "ACTIVE")
        .limit(1)
        .maybeSingle(),
    ]);
    const activeOwnerMembership = !ownerMembership.error && Boolean(ownerMembership.data);
    if (error) {
      const context = selectXerianoAccountContext({
        userId,
        email,
        legacyOwner,
        internalOwner: activeOwnerMembership,
        legacyWorkspaceKey,
        membership: null,
      });
      return context
        ? { status: "AUTHENTICATED", context }
        : { status: "FOUNDATION_UNAVAILABLE", userId, email };
    }
    const record = data as unknown as {
      account_id: string; role: XerianoRole;
      xeriano_accounts: { id: string; name: string; studio_workspace_key: string; brain_workspace_id: string | null; status: string };
    } | null;
    const membership: XerianoMembershipAuthority | null = record && record.xeriano_accounts.status === "ACTIVE"
      ? {
          accountId: record.account_id,
          accountName: record.xeriano_accounts.name,
          workspaceKey: record.xeriano_accounts.studio_workspace_key,
          brainWorkspaceId: record.xeriano_accounts.brain_workspace_id,
          role: record.role,
        }
      : null;
    const context = selectXerianoAccountContext({
      userId,
      email,
      legacyOwner,
      internalOwner: activeOwnerMembership,
      legacyWorkspaceKey,
      membership,
    });
    return context
      ? { status: "AUTHENTICATED", context }
      : { status: "FOUNDATION_UNAVAILABLE", userId, email };
  } catch {
    const context = selectXerianoAccountContext({
      userId, email, legacyOwner, legacyWorkspaceKey, membership: null,
    });
    return context
      ? { status: "AUTHENTICATED", context }
      : { status: "FOUNDATION_UNAVAILABLE", userId, email };
  }
}

export function isInternalRole(role: XerianoRole): boolean { return role === "OWNER"; }
