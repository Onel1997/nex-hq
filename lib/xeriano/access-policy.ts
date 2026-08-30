export type XerianoRole = "OWNER" | "ADMIN" | "CUSTOMER";

export type XerianoMembershipAuthority = {
  accountId: string;
  accountName: string;
  workspaceKey: string;
  brainWorkspaceId: string | null;
  role: XerianoRole;
};

export type XerianoAccountContext = {
  userId: string;
  email: string | null;
  role: XerianoRole;
  accountId: string;
  accountName: string;
  workspaceKey: string;
  brainWorkspaceId: string | null;
  source: "LEGACY_OWNER" | "XERIANO_MEMBERSHIP";
  /** Independent internal authority; it never substitutes for account membership. */
  internalOwner?: boolean;
};

/**
 * Membership wins for customer account context. Internal OWNER authority is
 * carried independently so one authenticated actor can safely use both /hq
 * and an account-scoped /app membership without either authority replacing
 * the other.
 */
export function selectXerianoAccountContext(input: {
  userId: string;
  email: string | null;
  legacyOwner: boolean;
  legacyWorkspaceKey: string;
  membership: XerianoMembershipAuthority | null;
}): XerianoAccountContext | null {
  if (input.membership) {
    return {
      userId: input.userId,
      email: input.email,
      role: input.membership.role,
      accountId: input.membership.accountId,
      accountName: input.membership.accountName,
      workspaceKey: input.membership.workspaceKey,
      brainWorkspaceId: input.membership.brainWorkspaceId,
      source: "XERIANO_MEMBERSHIP",
      internalOwner: input.legacyOwner || input.membership.role === "OWNER",
    };
  }

  if (!input.legacyOwner) return null;
  return {
    userId: input.userId,
    email: input.email,
    role: "OWNER",
    accountId: "legacy-owner",
    accountName: "Xeriamo",
    workspaceKey: input.legacyWorkspaceKey,
    brainWorkspaceId: null,
    source: "LEGACY_OWNER",
    internalOwner: true,
  };
}

export function hasXerianoOwnerAuthority(context: XerianoAccountContext): boolean {
  return context.internalOwner === true || context.role === "OWNER";
}

export function hasXerianoAccountMembership(context: XerianoAccountContext): boolean {
  return context.source === "XERIANO_MEMBERSHIP";
}
