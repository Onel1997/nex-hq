import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  hasXerianoAccountMembership,
  resolveXerianoAccess,
  type XerianoAccountContext,
} from "./auth";
import {
  resolveXerianoBillingReturnState,
  type XerianoBillingReturnState,
} from "./billing-return";

export class XerianoAuthorizationError extends Error {
  constructor(public code: "AUTHENTICATION_REQUIRED" | "CUSTOMER_ACCOUNT_REQUIRED" | "XERIANO_FOUNDATION_UNAVAILABLE", public status: number) { super(code); }
}

export async function requireXerianoAccount(): Promise<XerianoAccountContext> {
  const access = await resolveXerianoAccess();
  if (access.status === "UNAUTHENTICATED") throw new XerianoAuthorizationError("AUTHENTICATION_REQUIRED",401);
  if (access.status !== "AUTHENTICATED") throw new XerianoAuthorizationError("XERIANO_FOUNDATION_UNAVAILABLE",503);
  if (!hasXerianoAccountMembership(access.context)) throw new XerianoAuthorizationError("CUSTOMER_ACCOUNT_REQUIRED",403);
  return access.context;
}

export type XerianoAccountSummary = {
  plan: string;
  /** Derived from eligible buckets; never a second balance authority. */
  availableCredits: number;
  totalAvailable: number;
  subscriptionCredits: number;
  topUpCredits: number;
  trialCredits: number;
  manualCredits: number;
  reservedCredits: number;
  planAllowance: number;
  renewalAt: string | null;
  imageConcurrencyLimit: number;
  videoConcurrencyLimit: number;
  activeImageJobs: number;
  activeVideoJobs: number;
};
export async function loadXerianoAccountSummary(accountId: string): Promise<XerianoAccountSummary | null> {
  try {
    const supabase = await createServerSupabase();
    const [subscription, buckets, claims] = await Promise.all([
      supabase.from("xeriano_subscription_state").select("plan,monthly_credits,current_period_end,image_concurrency_limit,video_concurrency_limit").eq("account_id",accountId).maybeSingle(),
      supabase.from("xeriano_credit_buckets").select("bucket_type,remaining_credits,reserved_credits,expires_at").eq("account_id",accountId),
      supabase.from("xeriano_generation_claims").select("operation").eq("account_id",accountId).eq("status","RUNNING"),
    ]);
    if (subscription.error || buckets.error || claims.error || !subscription.data) return null;
    const values = { SUBSCRIPTION:0,TOP_UP:0,TRIAL:0,MANUAL:0 };
    let reservedCredits = 0;
    const now = Date.now();
    for (const row of (buckets.data ?? []) as Array<{bucket_type:keyof typeof values;remaining_credits:number;reserved_credits:number;expires_at:string|null}>) {
      if (row.expires_at !== null && Date.parse(row.expires_at) <= now) continue;
      values[row.bucket_type] += row.remaining_credits-row.reserved_credits;
      reservedCredits += row.reserved_credits;
    }
    const subscriptionRow = subscription.data as {plan:string;monthly_credits:number;current_period_end:string|null;image_concurrency_limit:number;video_concurrency_limit:number};
    const active = (claims.data ?? []) as Array<{operation:"IMAGE"|"VIDEO"}>;
    const totalAvailable = values.SUBSCRIPTION+values.TOP_UP+values.TRIAL+values.MANUAL;
    return {
      plan:String(subscriptionRow.plan),
      availableCredits:totalAvailable,
      totalAvailable,
      subscriptionCredits:values.SUBSCRIPTION,
      topUpCredits:values.TOP_UP,
      trialCredits:values.TRIAL,
      manualCredits:values.MANUAL,
      reservedCredits,
      planAllowance:Number(subscriptionRow.monthly_credits),
      renewalAt:subscriptionRow.current_period_end,
      imageConcurrencyLimit:Number(subscriptionRow.image_concurrency_limit),
      videoConcurrencyLimit:Number(subscriptionRow.video_concurrency_limit),
      activeImageJobs:active.filter((row)=>row.operation==="IMAGE").length,
      activeVideoJobs:active.filter((row)=>row.operation==="VIDEO").length,
    };
  } catch { return null; }
}

export type XerianoCreditHistoryEntry = {
  id: string;
  type: string;
  modelId: string | null;
  jobId: string | null;
  credits: number;
  createdAt: string;
};

export type XerianoBillingPresentation = {
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
  status: string | null;
  cancelAtPeriodEnd: boolean;
};

export async function loadXerianoBillingPresentation(
  accountId: string,
): Promise<XerianoBillingPresentation> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("xeriano_billing_customers")
      .select("stripe_customer_id,stripe_subscription_id,billing_status,cancel_at_period_end")
      .eq("account_id", accountId)
      .maybeSingle();
    if (error || !data) return { hasStripeCustomer: false, hasSubscription: false, status: null, cancelAtPeriodEnd: false };
    return {
      hasStripeCustomer: Boolean(data.stripe_customer_id),
      hasSubscription: Boolean(data.stripe_subscription_id),
      status: data.billing_status ? String(data.billing_status) : null,
      cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
    };
  } catch {
    return { hasStripeCustomer: false, hasSubscription: false, status: null, cancelAtPeriodEnd: false };
  }
}

const TEST_CHECKOUT_SESSION_PATTERN = /^cs_test_[A-Za-z0-9_]+$/;

/**
 * Reads only server-authoritative, account-scoped billing state. The Checkout
 * session id is used solely as a lookup key and is never returned to the client.
 */
export async function loadXerianoBillingReturnState(
  accountId: string,
  checkoutSessionId: string | null | undefined,
): Promise<XerianoBillingReturnState> {
  if (!checkoutSessionId || checkoutSessionId.length > 255 || !TEST_CHECKOUT_SESSION_PATTERN.test(checkoutSessionId)) {
    return resolveXerianoBillingReturnState(null);
  }

  try {
    const admin = createAdminClient();
    const { data: checkout, error: checkoutError } = await admin
      .from("xeriano_stripe_checkouts")
      .select("stripe_price_mapping_id,mode,status,created_at")
      .eq("account_id", accountId)
      .eq("stripe_checkout_session_id", checkoutSessionId)
      .maybeSingle();

    if (checkoutError || !checkout || (checkout.mode !== "SUBSCRIPTION" && checkout.mode !== "TOP_UP")) {
      return resolveXerianoBillingReturnState(null);
    }

    const { data: mapping, error: mappingError } = await admin
      .from("xeriano_stripe_price_mappings")
      .select("plan_version_id,topup_product_version_id")
      .eq("id", checkout.stripe_price_mapping_id)
      .maybeSingle();
    if (mappingError || !mapping) {
      return resolveXerianoBillingReturnState({
        mode: checkout.mode,
        checkoutStatus: String(checkout.status),
        matchingGrantExists: false,
      });
    }

    let grantQuery = admin
      .from("xeriano_credit_buckets")
      .select("id")
      .eq("account_id", accountId)
      .gte("granted_at", String(checkout.created_at))
      .limit(1);

    if (checkout.mode === "TOP_UP") {
      if (!mapping.topup_product_version_id) {
        return resolveXerianoBillingReturnState({ mode: "TOP_UP", checkoutStatus: String(checkout.status), matchingGrantExists: false });
      }
      grantQuery = grantQuery
        .eq("bucket_type", "TOP_UP")
        .eq("topup_product_version_id", mapping.topup_product_version_id)
        .eq("billing_source_id", checkoutSessionId);
    } else {
      if (!mapping.plan_version_id) {
        return resolveXerianoBillingReturnState({ mode: "SUBSCRIPTION", checkoutStatus: String(checkout.status), matchingGrantExists: false });
      }
      grantQuery = grantQuery
        .eq("bucket_type", "SUBSCRIPTION")
        .eq("plan_version_id", mapping.plan_version_id);
    }

    const { data: grant, error: grantError } = await grantQuery.maybeSingle();
    return resolveXerianoBillingReturnState({
      mode: checkout.mode,
      checkoutStatus: String(checkout.status),
      matchingGrantExists: !grantError && Boolean(grant),
    });
  } catch {
    return resolveXerianoBillingReturnState(null);
  }
}

/** Bounded, account-scoped ledger view. RESERVE is omitted to avoid double UI entries. */
export async function loadXerianoCreditHistory(
  accountId: string,
  limit = 30,
): Promise<XerianoCreditHistoryEntry[]> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("xeriano_credit_ledger")
      .select("id,transaction_type,amount_delta,reserved_delta,model_id,job_id,created_at")
      .eq("account_id", accountId)
      .neq("transaction_type", "RESERVE")
      .order("created_at", { ascending: false })
      .limit(Math.min(100, Math.max(1, limit)));
    if (error) return [];
    return (data ?? []).map((row) => ({
      id: String(row.id),
      type: String(row.transaction_type),
      modelId: row.model_id ? String(row.model_id) : null,
      jobId: row.job_id ? String(row.job_id) : null,
      credits:
        row.transaction_type === "RELEASE"
          ? Math.abs(Number(row.reserved_delta))
          : Number(row.amount_delta),
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}
