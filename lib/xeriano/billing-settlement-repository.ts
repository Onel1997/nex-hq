import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BillingEventResult,
  XerianoBillingSettlementRepository,
} from "./billing";

function result(data: unknown, fallbackEffect: BillingEventResult["financialEffect"]): BillingEventResult {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("BILLING_RPC_EMPTY_RESULT");
  const value = row as { status?: unknown; financialEffect?: unknown };
  const status = value.status === "IGNORED" ? "IGNORED" : "PROCESSED";
  const financialEffect = value.financialEffect === "SUBSCRIPTION_GRANT" || value.financialEffect === "TOP_UP_GRANT"
    ? value.financialEffect
    : fallbackEffect;
  return { status, financialEffect };
}

function rpcFailure(code: string): Error {
  return new Error(`XERIANO_BILLING_SETTLEMENT:${code}`);
}

export function createXerianoBillingSettlementRepository(): XerianoBillingSettlementRepository {
  const admin = createAdminClient();
  return {
    async resolvePriceMapping(stripePriceId) {
      const { data, error } = await admin
        .from("xeriano_stripe_price_mappings")
        .select("product_code,product_kind,stripe_price_id,catalog_code,catalog_version,gross_price_minor,currency,granted_credits")
        .eq("stripe_price_id", stripePriceId)
        .eq("livemode", false)
        .maybeSingle();
      if (error) throw rpcFailure("PRICE_MAPPING_READ_FAILED");
      if (!data) return null;
      return {
        code: String(data.product_code) as never,
        kind: data.product_kind === "SUBSCRIPTION" ? "SUBSCRIPTION" : "TOP_UP",
        stripePriceId: String(data.stripe_price_id),
        catalogCode: String(data.catalog_code),
        catalogVersion: String(data.catalog_version),
        grossPriceMinor: Number(data.gross_price_minor),
        currency: "EUR",
        grantedCredits: Number(data.granted_credits),
      };
    },
    async completeSubscriptionCheckout(input) {
      const { data, error } = await admin.rpc("xeriano_complete_subscription_checkout_event", {
        p_event_id: input.eventId,
        p_event_type: input.eventType,
        p_checkout_session_id: input.checkoutSessionId,
        p_stripe_customer_id: input.stripeCustomerId,
        p_stripe_subscription_id: input.stripeSubscriptionId,
        p_event_metadata: input.metadata,
      });
      if (error) throw rpcFailure("CHECKOUT_SYNC_FAILED");
      return result(data, "NONE");
    },
    async grantTopUp(input) {
      const { data, error } = await admin.rpc("xeriano_grant_topup_checkout_event", {
        p_event_id: input.eventId,
        p_event_type: input.eventType,
        p_checkout_session_id: input.checkoutSessionId,
        p_stripe_customer_id: input.stripeCustomerId,
        p_payment_status: input.paymentStatus,
        p_event_metadata: input.metadata,
      });
      if (error) throw rpcFailure("TOPUP_GRANT_FAILED");
      return result(data, "TOP_UP_GRANT");
    },
    async grantSubscription(input) {
      const { data, error } = await admin.rpc("xeriano_grant_subscription_invoice_event", {
        p_event_id: input.eventId,
        p_event_type: input.eventType,
        p_invoice_id: input.invoiceId,
        p_stripe_customer_id: input.stripeCustomerId,
        p_stripe_subscription_id: input.stripeSubscriptionId,
        p_stripe_price_id: input.stripePriceId,
        p_plan_version: input.catalogVersion,
        p_billing_reason: input.billingReason,
        p_invoice_status: input.invoiceStatus,
        p_amount_paid_minor: input.amountPaidMinor,
        p_plan_line_amount_minor: input.planLineAmountMinor,
        p_currency: input.currency,
        p_period_start: input.periodStart,
        p_period_end: input.periodEnd,
        p_event_metadata: input.metadata,
      });
      if (error) throw rpcFailure("SUBSCRIPTION_GRANT_FAILED");
      return result(data, "SUBSCRIPTION_GRANT");
    },
    async syncSubscription(input) {
      const { data, error } = await admin.rpc("xeriano_sync_subscription_event", {
        p_event_id: input.eventId,
        p_event_type: input.eventType,
        p_stripe_customer_id: input.stripeCustomerId,
        p_stripe_subscription_id: input.stripeSubscriptionId,
        p_stripe_price_id: input.stripePriceId,
        p_plan_version: input.catalogVersion,
        p_stripe_status: input.stripeStatus,
        p_cancel_at_period_end: input.cancelAtPeriodEnd,
        p_period_start: input.periodStart,
        p_period_end: input.periodEnd,
        p_deleted: input.deleted,
        p_event_metadata: input.metadata,
      });
      if (error) throw rpcFailure("SUBSCRIPTION_SYNC_FAILED");
      return result(data, "NONE");
    },
    async markInvoicePaymentFailed(input) {
      const { data, error } = await admin.rpc("xeriano_mark_invoice_payment_failed_event", {
        p_event_id: input.eventId,
        p_event_type: input.eventType,
        p_invoice_id: input.invoiceId,
        p_stripe_customer_id: input.stripeCustomerId,
        p_stripe_subscription_id: input.stripeSubscriptionId,
        p_event_metadata: input.metadata,
      });
      if (error) throw rpcFailure("PAYMENT_FAILURE_SYNC_FAILED");
      return result(data, "NONE");
    },
    async recordOutcome(input) {
      const { error } = await admin.rpc("xeriano_record_billing_event_outcome", {
        p_event_id: input.eventId,
        p_event_type: input.eventType,
        p_status: input.status,
        p_failure_code: input.failureCode,
        p_event_metadata: input.metadata,
      });
      if (error) throw rpcFailure("EVENT_OUTCOME_FAILED");
    },
  };
}
