export type XerianoBillingReturnKind = "SUBSCRIPTION" | "TOP_UP";

export type XerianoBillingReturnState =
  | { status: "PROCESSING"; kind: XerianoBillingReturnKind | null }
  | { status: "CONFIRMED"; kind: XerianoBillingReturnKind };

export type XerianoBillingReturnAuthority = {
  mode: XerianoBillingReturnKind;
  checkoutStatus: string;
  matchingGrantExists: boolean;
};

/**
 * A Checkout return URL is never payment authority. Confirmation requires the
 * account-scoped checkout plus the bucket written by the transactional webhook
 * settlement. This helper is deliberately pure so the presentation contract can
 * be regression-tested without Stripe or database calls.
 */
export function resolveXerianoBillingReturnState(
  authority: XerianoBillingReturnAuthority | null,
): XerianoBillingReturnState {
  if (!authority) return { status: "PROCESSING", kind: null };

  const checkoutSettled = authority.mode === "TOP_UP"
    ? authority.checkoutStatus === "PAID"
    : authority.checkoutStatus === "COMPLETED";

  if (!checkoutSettled || !authority.matchingGrantExists) {
    return { status: "PROCESSING", kind: authority.mode };
  }

  return { status: "CONFIRMED", kind: authority.mode };
}
