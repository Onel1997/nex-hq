import Stripe from "stripe";

import {
  XERIANO_STRIPE_API_VERSION,
  type XerianoStripePriceMapping,
} from "./stripe-config";

export const XERIANO_STRIPE_WEBHOOK_MAX_BYTES = 1024 * 1024;

export const XERIANO_STRIPE_EVENT_TYPES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;
export type XerianoStripeEventType = (typeof XERIANO_STRIPE_EVENT_TYPES)[number];

export type BillingEventResult = {
  status: "PROCESSED" | "IGNORED";
  financialEffect: "NONE" | "SUBSCRIPTION_GRANT" | "TOP_UP_GRANT";
};

type EventBase = { eventId: string; eventType: XerianoStripeEventType; metadata: Record<string, unknown> };

export interface XerianoBillingSettlementRepository {
  resolvePriceMapping(stripePriceId: string): Promise<XerianoStripePriceMapping | null>;
  completeSubscriptionCheckout(input: EventBase & {
    checkoutSessionId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
  }): Promise<BillingEventResult>;
  grantTopUp(input: EventBase & {
    checkoutSessionId: string;
    stripeCustomerId: string;
    paymentStatus: string;
  }): Promise<BillingEventResult>;
  grantSubscription(input: EventBase & {
    invoiceId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    catalogVersion: string;
    billingReason: string;
    invoiceStatus: string;
    amountPaidMinor: number;
    planLineAmountMinor: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
  }): Promise<BillingEventResult>;
  syncSubscription(input: EventBase & {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId: string;
    catalogVersion: string;
    stripeStatus: string;
    cancelAtPeriodEnd: boolean;
    periodStart: string;
    periodEnd: string;
    deleted: boolean;
  }): Promise<BillingEventResult>;
  markInvoicePaymentFailed(input: EventBase & {
    invoiceId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
  }): Promise<BillingEventResult>;
  recordOutcome(input: {
    eventId: string;
    eventType: string;
    status: "FAILED" | "IGNORED";
    failureCode: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

export class XerianoWebhookProcessingError extends Error {
  constructor(public readonly code: string, public readonly retryable = true) {
    super(code);
  }
}

export function isSupportedXerianoStripeEvent(type: string): type is XerianoStripeEventType {
  return (XERIANO_STRIPE_EVENT_TYPES as readonly string[]).includes(type);
}

export function verifyXerianoStripeEvent(input: {
  payload: string;
  signature: string;
  secret: string;
}): Stripe.Event {
  const stripe = new Stripe("sk_test_xeriano_signature_verification_only", { apiVersion: XERIANO_STRIPE_API_VERSION });
  return stripe.webhooks.constructEvent(input.payload, input.signature, input.secret);
}

export function billingEventAction(type: XerianoStripeEventType) {
  switch (type) {
    case "checkout.session.completed": return "SETTLE_CHECKOUT";
    case "customer.subscription.created":
    case "customer.subscription.updated": return "SYNC_SUBSCRIPTION";
    case "customer.subscription.deleted": return "CANCEL_SUBSCRIPTION";
    case "invoice.paid": return "GRANT_RENEWAL_CREDITS";
    case "invoice.payment_failed": return "MARK_PAST_DUE";
  }
}

function objectId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

function isoFromSeconds(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0) throw new XerianoWebhookProcessingError("INVALID_ENTITLEMENT_PERIOD");
  return new Date(value * 1000).toISOString();
}

function eventMetadata(event: Stripe.Event, objectIdValue: string): Record<string, unknown> {
  return { livemode: event.livemode, objectId: objectIdValue };
}

async function mappingForPrice(
  priceId: string,
  repository: XerianoBillingSettlementRepository,
): Promise<XerianoStripePriceMapping> {
  const mapping = await repository.resolvePriceMapping(priceId);
  if (!mapping) throw new XerianoWebhookProcessingError("UNKNOWN_STRIPE_PRICE");
  return mapping;
}

async function subscriptionSnapshot(
  subscription: Stripe.Subscription,
  repository: XerianoBillingSettlementRepository,
) {
  const items = subscription.items.data;
  if (items.length !== 1) throw new XerianoWebhookProcessingError("UNSUPPORTED_SUBSCRIPTION_ITEMS");
  const item = items[0]!;
  const priceId = objectId(item.price);
  if (!priceId) throw new XerianoWebhookProcessingError("SUBSCRIPTION_PRICE_MISSING");
  const mapping = await mappingForPrice(priceId, repository);
  if (mapping.kind !== "SUBSCRIPTION") throw new XerianoWebhookProcessingError("SUBSCRIPTION_PRICE_KIND_INVALID");
  return {
    mapping,
    periodStart: isoFromSeconds(item.current_period_start),
    periodEnd: isoFromSeconds(item.current_period_end),
  };
}

async function invoiceSnapshot(
  invoice: Stripe.Invoice,
  repository: XerianoBillingSettlementRepository,
) {
  const candidates: Array<{ line: Stripe.InvoiceLineItem; priceId: string; mapping: XerianoStripePriceMapping }> = [];
  for (const line of invoice.lines.data) {
    const priceId = objectId(line.pricing?.price_details?.price);
    if (!priceId) continue;
    const mapping = await repository.resolvePriceMapping(priceId);
    if (!mapping || mapping.kind !== "SUBSCRIPTION") continue;
    const proration = line.parent?.subscription_item_details?.proration ?? false;
    if (!proration) candidates.push({ line, priceId, mapping });
  }
  if (candidates.length !== 1) throw new XerianoWebhookProcessingError("INVOICE_PLAN_LINE_UNRESOLVED");
  const candidate = candidates[0]!;
  const subscriptionId = objectId(invoice.parent?.subscription_details?.subscription) ?? objectId(candidate.line.subscription);
  if (!subscriptionId) throw new XerianoWebhookProcessingError("INVOICE_SUBSCRIPTION_MISSING");
  const customerId = objectId(invoice.customer);
  if (!customerId) throw new XerianoWebhookProcessingError("INVOICE_CUSTOMER_MISSING");
  return {
    customerId,
    subscriptionId,
    priceId: candidate.priceId,
    mapping: candidate.mapping,
    periodStart: isoFromSeconds(candidate.line.period.start),
    periodEnd: isoFromSeconds(candidate.line.period.end),
    planLineAmountMinor: candidate.line.amount,
  };
}

export async function processVerifiedXerianoStripeEvent(input: {
  event: Stripe.Event;
  repository: XerianoBillingSettlementRepository;
}): Promise<BillingEventResult> {
  const { event, repository } = input;
  if (event.livemode) throw new XerianoWebhookProcessingError("LIVE_STRIPE_EVENT_FORBIDDEN", false);
  if (!isSupportedXerianoStripeEvent(event.type)) return { status: "IGNORED", financialEffect: "NONE" };
  const eventType = event.type;

  if (eventType === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = objectId(session.customer);
    if (!customerId) throw new XerianoWebhookProcessingError("CHECKOUT_CUSTOMER_MISSING");
    const base = { eventId: event.id, eventType, metadata: eventMetadata(event, session.id) };
    if (session.mode === "payment") {
      return repository.grantTopUp({
        ...base,
        checkoutSessionId: session.id,
        stripeCustomerId: customerId,
        paymentStatus: session.payment_status,
      });
    }
    if (session.mode === "subscription") {
      const subscriptionId = objectId(session.subscription);
      if (!subscriptionId) throw new XerianoWebhookProcessingError("CHECKOUT_SUBSCRIPTION_MISSING");
      return repository.completeSubscriptionCheckout({
        ...base,
        checkoutSessionId: session.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      });
    }
    throw new XerianoWebhookProcessingError("CHECKOUT_MODE_UNSUPPORTED");
  }

  if (eventType.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = objectId(subscription.customer);
    if (!customerId) throw new XerianoWebhookProcessingError("SUBSCRIPTION_CUSTOMER_MISSING");
    const snapshot = await subscriptionSnapshot(subscription, repository);
    return repository.syncSubscription({
      eventId: event.id,
      eventType,
      metadata: eventMetadata(event, subscription.id),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: snapshot.mapping.stripePriceId,
      catalogVersion: snapshot.mapping.catalogVersion,
      stripeStatus: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      deleted: eventType === "customer.subscription.deleted",
    });
  }

  const invoice = event.data.object as Stripe.Invoice;
  const invoiceData = await invoiceSnapshot(invoice, repository);
  const base = { eventId: event.id, eventType, metadata: eventMetadata(event, invoice.id) };
  if (eventType === "invoice.payment_failed") {
    return repository.markInvoicePaymentFailed({
      ...base,
      invoiceId: invoice.id,
      stripeCustomerId: invoiceData.customerId,
      stripeSubscriptionId: invoiceData.subscriptionId,
    });
  }
  if (invoice.billing_reason === "subscription_update") {
    await repository.recordOutcome({
      eventId: event.id,
      eventType,
      status: "IGNORED",
      failureCode: "PRORATION_GRANT_DEFERRED",
      metadata: { ...base.metadata, billingReason: invoice.billing_reason },
    });
    return { status: "IGNORED", financialEffect: "NONE" };
  }
  if (invoice.billing_reason !== "subscription_create" && invoice.billing_reason !== "subscription_cycle") {
    throw new XerianoWebhookProcessingError("INVOICE_BILLING_REASON_UNSUPPORTED");
  }
  return repository.grantSubscription({
    ...base,
    invoiceId: invoice.id,
    stripeCustomerId: invoiceData.customerId,
    stripeSubscriptionId: invoiceData.subscriptionId,
    stripePriceId: invoiceData.priceId,
    catalogVersion: invoiceData.mapping.catalogVersion,
    billingReason: invoice.billing_reason,
    invoiceStatus: invoice.status ?? "unknown",
    amountPaidMinor: invoice.amount_paid,
    planLineAmountMinor: invoiceData.planLineAmountMinor,
    currency: invoice.currency.toUpperCase(),
    periodStart: invoiceData.periodStart,
    periodEnd: invoiceData.periodEnd,
  });
}
