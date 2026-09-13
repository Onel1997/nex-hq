export function calculateRefundCreditTarget(input: {
  grantedCredits: number;
  grossAmountMinor: number;
  cumulativeRefundedAmountMinor: number;
}): number {
  const { grantedCredits, grossAmountMinor } = input;
  const refunded = Math.min(Math.max(input.cumulativeRefundedAmountMinor, 0), grossAmountMinor);
  if (!Number.isSafeInteger(grantedCredits) || grantedCredits <= 0
    || !Number.isSafeInteger(grossAmountMinor) || grossAmountMinor <= 0
    || !Number.isSafeInteger(refunded)) {
    throw new Error("INVALID_REFUND_CREDIT_AUTHORITY");
  }
  return refunded === grossAmountMinor
    ? grantedCredits
    : Math.floor((grantedCredits * refunded) / grossAmountMinor);
}

export function disputeAction(status: string): "HOLD" | "REVERSE_AND_HOLD" | "RELEASE" {
  if (status === "lost") return "REVERSE_AND_HOLD";
  if (status === "won" || status === "warning_closed" || status === "prevented") return "RELEASE";
  return "HOLD";
}
