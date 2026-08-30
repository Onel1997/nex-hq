import { createAdminClient } from "@/lib/supabase/admin";
import type { XerianoStripePriceMapping } from "./stripe-config";

export type XerianoBillingCustomer = {
  accountId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingStatus: string;
};

export type CheckoutAuthorityInput = {
  accountId: string;
  requestId: string;
  stripeCustomerId: string;
  stripeCheckoutSessionId: string;
  mapping: XerianoStripePriceMapping;
};

export interface XerianoCheckoutRepository {
  getBillingCustomer(accountId: string): Promise<XerianoBillingCustomer | null>;
  bindStripeCustomer(accountId: string, stripeCustomerId: string): Promise<XerianoBillingCustomer>;
  registerPriceMapping(mapping: XerianoStripePriceMapping): Promise<void>;
  claimCheckout(accountId: string, stripeCustomerId: string, requestId: string, kind: "SUBSCRIPTION" | "TOP_UP", productCode: string): Promise<void>;
  recordCheckoutAuthority(input: CheckoutAuthorityInput): Promise<void>;
}

function repositoryError(code: string): Error {
  return new Error(`XERIANO_BILLING_REPOSITORY:${code}`);
}

export function createXerianoBillingRepository(): XerianoCheckoutRepository {
  const admin = createAdminClient();
  return {
    async getBillingCustomer(accountId) {
      const { data, error } = await admin
        .from("xeriano_billing_customers")
        .select("account_id,stripe_customer_id,stripe_subscription_id,billing_status")
        .eq("account_id", accountId)
        .maybeSingle();
      if (error) throw repositoryError("CUSTOMER_READ_FAILED");
      if (!data) return null;
      return {
        accountId: String(data.account_id),
        stripeCustomerId: data.stripe_customer_id ? String(data.stripe_customer_id) : null,
        stripeSubscriptionId: data.stripe_subscription_id ? String(data.stripe_subscription_id) : null,
        billingStatus: String(data.billing_status),
      };
    },
    async bindStripeCustomer(accountId, stripeCustomerId) {
      const { data, error } = await admin.rpc("xeriano_bind_stripe_customer", {
        p_account_id: accountId,
        p_stripe_customer_id: stripeCustomerId,
      });
      if (error || !data) throw repositoryError("CUSTOMER_BIND_FAILED");
      const row = Array.isArray(data) ? data[0] : data;
      return {
        accountId: String(row.account_id),
        stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
        stripeSubscriptionId: row.stripe_subscription_id ? String(row.stripe_subscription_id) : null,
        billingStatus: String(row.billing_status),
      };
    },
    async registerPriceMapping(mapping) {
      const { error } = await admin.rpc("xeriano_register_stripe_price_mapping", {
        p_mode: mapping.kind,
        p_product_code: mapping.code,
        p_catalog_version: mapping.catalogVersion,
        p_stripe_price_id: mapping.stripePriceId,
      });
      if (error) throw repositoryError("PRICE_MAPPING_RECORD_FAILED");
    },
    async claimCheckout(accountId, stripeCustomerId, requestId, kind, productCode) {
      const { error } = await admin.rpc("xeriano_claim_stripe_checkout", {
        p_account_id: accountId,
        p_stripe_customer_id: stripeCustomerId,
        p_request_id: requestId,
        p_mode: kind,
        p_product_code: productCode,
      });
      if (error) throw repositoryError("CHECKOUT_ALREADY_IN_PROGRESS");
    },
    async recordCheckoutAuthority(input) {
      const { error } = await admin.rpc("xeriano_record_stripe_checkout", {
        p_account_id: input.accountId,
        p_request_id: input.requestId,
        p_stripe_customer_id: input.stripeCustomerId,
        p_checkout_session_id: input.stripeCheckoutSessionId,
        p_mode: input.mapping.kind,
        p_product_code: input.mapping.code,
        p_catalog_version: input.mapping.catalogVersion,
        p_stripe_price_id: input.mapping.stripePriceId,
      });
      if (error) throw repositoryError("CHECKOUT_RECORD_FAILED");
    },
  };
}
