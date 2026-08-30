import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  hasXerianoOwnerAuthority,
  resolveXerianoAccess,
  type XerianoAccountContext,
} from "./auth";

export class XerianoOwnerCustomerError extends Error {
  constructor(
    public code: "OWNER_REQUIRED" | "CUSTOMER_CENTER_UNAVAILABLE" | "CUSTOMER_NOT_FOUND" | "INVALID_GRANT",
    public status: number,
  ) {
    super(code);
  }
}

export type XerianoOwnerCustomerListInput = {
  search?: string | null;
  plan?: string | null;
  status?: string | null;
  page?: number;
  pageSize?: number;
};

export type XerianoOwnerCustomerSummary = {
  accountId: string;
  userId: string;
  displayName: string;
  email: string;
  accountStatus: string;
  currentPlan: string;
  subscriptionStatus: string;
  renewalAt: string | null;
  totalAvailable: number;
  subscriptionAvailable: number;
  topUpAvailable: number;
  trialAvailable: number;
  manualAvailable: number;
  reservedCredits: number;
  registeredAt: string;
  latestActivityAt: string;
};

export type XerianoOwnerCustomerList = {
  customers: XerianoOwnerCustomerSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type XerianoOwnerLedgerEntry = {
  id: string;
  type: string;
  credits: number;
  modelId: string | null;
  createdAt: string;
};

export type XerianoOwnerManualGrant = {
  id: string;
  amount: number;
  reason: string;
  ownerUserId: string;
  createdAt: string;
};

export type XerianoOwnerCreationSummary = {
  id: string;
  type: string;
  studio: string;
  modelId: string;
  credits: number;
  createdAt: string;
};

export type XerianoOwnerCustomerDetail = XerianoOwnerCustomerSummary & {
  billing: {
    hasStripeCustomer: boolean;
    hasSubscription: boolean;
    status: string | null;
    cancelAtPeriodEnd: boolean;
  };
  ledger: XerianoOwnerLedgerEntry[];
  manualGrants: XerianoOwnerManualGrant[];
  creations: XerianoOwnerCreationSummary[];
};

type CustomerRow = {
  account_id: unknown;
  user_id: unknown;
  display_name: unknown;
  email: unknown;
  account_status: unknown;
  current_plan: unknown;
  subscription_status: unknown;
  renewal_at: unknown;
  total_available: unknown;
  subscription_available: unknown;
  topup_available: unknown;
  trial_available: unknown;
  manual_available: unknown;
  reserved_credits: unknown;
  registered_at: unknown;
  latest_activity_at: unknown;
  total_count: unknown;
};

const PLAN_FILTERS = new Set(["FREE", "CREATOR", "PRO", "STUDIO", "MAX"]);
const STATUS_FILTERS = new Set(["ACTIVE", "SUSPENDED", "CLOSED"]);

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeOwnerCustomerListInput(input: XerianoOwnerCustomerListInput) {
  const page = Number.isSafeInteger(input.page) && Number(input.page) > 0 ? Number(input.page) : 1;
  const pageSize = Math.min(50, Math.max(1, Number.isSafeInteger(input.pageSize) ? Number(input.pageSize) : 25));
  const search = input.search?.trim().slice(0, 120) || null;
  const planCandidate = input.plan?.trim().toUpperCase() ?? "";
  const statusCandidate = input.status?.trim().toUpperCase() ?? "";
  return {
    search,
    plan: PLAN_FILTERS.has(planCandidate) ? planCandidate : null,
    status: STATUS_FILTERS.has(statusCandidate) ? statusCandidate : null,
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function mapCustomerRow(row: CustomerRow): XerianoOwnerCustomerSummary {
  return {
    accountId: String(row.account_id),
    userId: String(row.user_id),
    displayName: String(row.display_name),
    email: String(row.email),
    accountStatus: String(row.account_status),
    currentPlan: String(row.current_plan),
    subscriptionStatus: String(row.subscription_status),
    renewalAt: row.renewal_at ? String(row.renewal_at) : null,
    totalAvailable: Number(row.total_available),
    subscriptionAvailable: Number(row.subscription_available),
    topUpAvailable: Number(row.topup_available),
    trialAvailable: Number(row.trial_available),
    manualAvailable: Number(row.manual_available),
    reservedCredits: Number(row.reserved_credits),
    registeredAt: String(row.registered_at),
    latestActivityAt: String(row.latest_activity_at),
  };
}

export async function requireXerianoOwner(): Promise<XerianoAccountContext> {
  const access = await resolveXerianoAccess();
  if (access.status !== "AUTHENTICATED" || !hasXerianoOwnerAuthority(access.context)) {
    throw new XerianoOwnerCustomerError("OWNER_REQUIRED", 403);
  }
  return access.context;
}

async function queryCustomers(
  input: ReturnType<typeof normalizeOwnerCustomerListInput>,
  accountId: string | null,
): Promise<{ rows: CustomerRow[]; total: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("xeriano_owner_list_customers", {
    p_search: input.search,
    p_plan: input.plan,
    p_status: input.status,
    p_limit: input.pageSize,
    p_offset: accountId ? 0 : input.offset,
    p_account_id: accountId,
  });
  if (error) throw new XerianoOwnerCustomerError("CUSTOMER_CENTER_UNAVAILABLE", 503);
  const rows = (data ?? []) as CustomerRow[];
  return { rows, total: rows.length ? Number(rows[0].total_count) : 0 };
}

export async function listXerianoOwnerCustomers(
  rawInput: XerianoOwnerCustomerListInput = {},
): Promise<XerianoOwnerCustomerList> {
  await requireXerianoOwner();
  const input = normalizeOwnerCustomerListInput(rawInput);
  const { rows, total } = await queryCustomers(input, null);
  return {
    customers: rows.map(mapCustomerRow),
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
  };
}

export async function loadXerianoOwnerCustomerDetail(
  accountId: string,
): Promise<XerianoOwnerCustomerDetail> {
  await requireXerianoOwner();
  if (!isUuid(accountId)) throw new XerianoOwnerCustomerError("CUSTOMER_NOT_FOUND", 404);
  const input = normalizeOwnerCustomerListInput({ pageSize: 1 });
  const { rows } = await queryCustomers(input, accountId);
  if (!rows[0]) throw new XerianoOwnerCustomerError("CUSTOMER_NOT_FOUND", 404);

  const admin = createAdminClient();
  const [ledgerResult, grantResult, creationResult, billingResult] = await Promise.all([
    admin.from("xeriano_credit_ledger")
      .select("id,transaction_type,amount_delta,reserved_delta,model_id,created_at")
      .eq("account_id", accountId).neq("transaction_type", "RESERVE")
      .order("created_at", { ascending: false }).limit(30),
    admin.from("xeriano_manual_credit_grants")
      .select("id,amount,reason,owner_user_id,created_at")
      .eq("account_id", accountId).order("created_at", { ascending: false }).limit(20),
    admin.from("xeriano_creations")
      .select("id,creation_type,source_studio,model_id,credit_cost,created_at")
      .eq("account_id", accountId).order("created_at", { ascending: false }).limit(12),
    admin.from("xeriano_billing_customers")
      .select("stripe_customer_id,stripe_subscription_id,billing_status,cancel_at_period_end")
      .eq("account_id", accountId).maybeSingle(),
  ]);

  if (ledgerResult.error || grantResult.error || creationResult.error || billingResult.error) {
    throw new XerianoOwnerCustomerError("CUSTOMER_CENTER_UNAVAILABLE", 503);
  }

  const customer = mapCustomerRow(rows[0]);
  return {
    ...customer,
    billing: {
      hasStripeCustomer: Boolean(billingResult.data?.stripe_customer_id),
      hasSubscription: Boolean(billingResult.data?.stripe_subscription_id),
      status: billingResult.data?.billing_status ? String(billingResult.data.billing_status) : null,
      cancelAtPeriodEnd: Boolean(billingResult.data?.cancel_at_period_end),
    },
    ledger: (ledgerResult.data ?? []).map((row) => ({
      id: String(row.id),
      type: String(row.transaction_type),
      credits: row.transaction_type === "RELEASE" ? Math.abs(Number(row.reserved_delta)) : Number(row.amount_delta),
      modelId: row.model_id ? String(row.model_id) : null,
      createdAt: String(row.created_at),
    })),
    manualGrants: (grantResult.data ?? []).map((row) => ({
      id: String(row.id), amount: Number(row.amount), reason: String(row.reason),
      ownerUserId: String(row.owner_user_id), createdAt: String(row.created_at),
    })),
    creations: (creationResult.data ?? []).map((row) => ({
      id: String(row.id), type: String(row.creation_type), studio: String(row.source_studio),
      modelId: String(row.model_id), credits: Number(row.credit_cost), createdAt: String(row.created_at),
    })),
  };
}

export async function grantXerianoOwnerManualCredits(input: {
  accountId: string;
  grantId: string;
  amount: number;
  reason: string;
}): Promise<{ status: "GRANTED" | "REPLAYED"; amount: number; availableCredits: number }> {
  const owner = await requireXerianoOwner();
  const reason = input.reason.trim();
  if (!isUuid(input.accountId) || !isUuid(input.grantId)
    || !Number.isSafeInteger(input.amount) || input.amount < 1 || input.amount > 1_000_000
    || reason.length < 2 || reason.length > 500) {
    throw new XerianoOwnerCustomerError("INVALID_GRANT", 400);
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("xeriano_grant_manual_credits", {
    p_grant_id: input.grantId,
    p_account_id: input.accountId,
    p_owner_user_id: owner.userId,
    p_amount: input.amount,
    p_reason: reason,
    p_idempotency_key: `owner-manual:${input.grantId}`,
  });
  if (error || !data || typeof data !== "object") {
    throw new XerianoOwnerCustomerError("CUSTOMER_CENTER_UNAVAILABLE", 503);
  }
  const result = data as { status?: unknown; amount?: unknown; availableCredits?: unknown };
  if (result.status !== "GRANTED" && result.status !== "REPLAYED") {
    throw new XerianoOwnerCustomerError("CUSTOMER_CENTER_UNAVAILABLE", 503);
  }
  return {
    status: result.status,
    amount: Number(result.amount),
    availableCredits: Number(result.availableCredits),
  };
}
