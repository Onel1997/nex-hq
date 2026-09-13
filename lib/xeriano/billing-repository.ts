import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoStripePriceMapping } from "./stripe-config";

export type XerianoBillingCustomer = {
  accountId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingStatus: string;
  livemode?: boolean;
};

export type CheckoutAuthorityInput = {
  accountId: string;
  requestId: string;
  stripeCustomerId: string;
  stripeCheckoutSessionId: string;
  mapping: XerianoStripePriceMapping;
  actorId: string;
  livemode: boolean;
  expiresAt: string | null;
  stripePaymentIntentId: string | null;
};

export interface XerianoCheckoutRepository {
  getBillingCustomer(accountId: string, livemode?: boolean): Promise<XerianoBillingCustomer | null>;
  bindStripeCustomer(accountId: string, stripeCustomerId: string, livemode?: boolean): Promise<XerianoBillingCustomer>;
  registerPriceMapping(mapping: XerianoStripePriceMapping): Promise<void>;
  claimCheckout(accountId: string, stripeCustomerId: string, requestId: string, kind: "SUBSCRIPTION" | "TOP_UP", productCode: string, livemode?: boolean): Promise<void | {
    status: "CLAIMED" | "RECORDED" | "EXISTING";
    checkoutSessionId: string | null;
  }>;
  recordCheckoutAuthority(input: CheckoutAuthorityInput): Promise<void>;
}

function repositoryError(code: string): Error {
  return new Error(`XERIANO_BILLING_REPOSITORY:${code}`);
}

export function createXerianoBillingRepository(): XerianoCheckoutRepository {
  const admin = createAdminClient();
  return {
    async getBillingCustomer(accountId, livemode = false) {
      const { data, error } = await admin
        .from("xeriano_billing_customers")
        .select("account_id,stripe_customer_id,stripe_subscription_id,billing_status,stripe_livemode")
        .eq("account_id", accountId)
        .eq("stripe_livemode", livemode)
        .maybeSingle();
      if (error) throw repositoryError("CUSTOMER_READ_FAILED");
      if (!data) return null;
      return {
        accountId: String(data.account_id),
        stripeCustomerId: data.stripe_customer_id ? String(data.stripe_customer_id) : null,
        stripeSubscriptionId: data.stripe_subscription_id ? String(data.stripe_subscription_id) : null,
        billingStatus: String(data.billing_status),
        livemode: Boolean(data.stripe_livemode),
      };
    },
    async bindStripeCustomer(accountId, stripeCustomerId, livemode = false) {
      const { data, error } = await admin.rpc("xeriano_bind_stripe_customer_v2", {
        p_account_id: accountId,
        p_stripe_customer_id: stripeCustomerId,
        p_livemode: livemode,
      });
      if (error || !data) throw repositoryError("CUSTOMER_BIND_FAILED");
      const row = Array.isArray(data) ? data[0] : data;
      return {
        accountId: String(row.account_id),
        stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
        stripeSubscriptionId: row.stripe_subscription_id ? String(row.stripe_subscription_id) : null,
        billingStatus: String(row.billing_status),
        livemode: Boolean(row.stripe_livemode),
      };
    },
    async registerPriceMapping(mapping) {
      const { error } = await admin.rpc("xeriano_register_stripe_price_mapping_v2", {
        p_mode: mapping.kind,
        p_product_code: mapping.code,
        p_catalog_version: mapping.catalogVersion,
        p_stripe_price_id: mapping.stripePriceId,
        p_livemode: mapping.livemode,
      });
      if (error) throw repositoryError("PRICE_MAPPING_RECORD_FAILED");
    },
    async claimCheckout(accountId, stripeCustomerId, requestId, kind, productCode, livemode = false) {
      const { data, error } = await admin.rpc("xeriano_claim_stripe_checkout_v2", {
        p_account_id: accountId,
        p_stripe_customer_id: stripeCustomerId,
        p_request_id: requestId,
        p_mode: kind,
        p_product_code: productCode,
        p_livemode: livemode,
      });
      if (error) throw repositoryError("CHECKOUT_ALREADY_IN_PROGRESS");
      const row = data && typeof data === "object" ? data as Record<string, unknown> : {};
      const status = row.status === "RECORDED" || row.status === "EXISTING" ? row.status : "CLAIMED";
      return {
        status,
        checkoutSessionId: typeof row.checkoutSessionId === "string" ? row.checkoutSessionId : null,
      };
    },
    async recordCheckoutAuthority(input) {
      const { error } = await admin.rpc("xeriano_record_stripe_checkout_v2", {
        p_account_id: input.accountId,
        p_request_id: input.requestId,
        p_stripe_customer_id: input.stripeCustomerId,
        p_checkout_session_id: input.stripeCheckoutSessionId,
        p_mode: input.mapping.kind,
        p_product_code: input.mapping.code,
        p_catalog_version: input.mapping.catalogVersion,
        p_stripe_price_id: input.mapping.stripePriceId,
        p_actor_id: input.actorId,
        p_livemode: input.livemode,
        p_expires_at: input.expiresAt,
        p_payment_intent_id: input.stripePaymentIntentId,
      });
      if (error) throw repositoryError("CHECKOUT_RECORD_FAILED");
    },
  };
}
