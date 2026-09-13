import Stripe from "stripe";

import {
  XERIANO_STRIPE_API_VERSION,
  type XerianoStripePriceMapping,
} from "./stripe-config";

export const XERIANO_STRIPE_WEBHOOK_MAX_BYTES = 1024 * 1024;

export const XERIANO_STRIPE_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.expired",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "refund.created",
  "refund.updated",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
] as const;
export type XerianoStripeEventType = (typeof XERIANO_STRIPE_EVENT_TYPES)[number];

export type BillingEventResult = {
  status: "PROCESSED" | "IGNORED";
  financialEffect: "NONE" | "SUBSCRIPTION_GRANT" | "TOP_UP_GRANT" | "CREDIT_REVERSAL" | "BILLING_HOLD";
};

type EventBase = {
  eventId: string;
  eventType: XerianoStripeEventType;
  eventCreated: number;
  livemode: boolean;
  metadata: Record<string, unknown>;
};

export interface XerianoStripeAuthorityResolver {
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
}

export interface XerianoBillingSettlementRepository {
  resolvePriceMapping(stripePriceId: string, livemode?: boolean): Promise<XerianoStripePriceMapping | null>;
  completeSubscriptionCheckout(input: EventBase & {
    checkoutSessionId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
  }): Promise<BillingEventResult>;
  grantTopUp(input: EventBase & {
    checkoutSessionId: string;
    stripeCustomerId: string;
    paymentStatus: string;
    paymentIntentId: string | null;
    amountTotalMinor: number | null;
    currency: string | null;
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
    paymentIntentId: string | null;
    chargeId: string | null;
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
    objectMarker: number;
  }): Promise<BillingEventResult>;
  markInvoicePaymentFailed(input: EventBase & {
    invoiceId: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
  }): Promise<BillingEventResult>;
  expireCheckout?(input: EventBase & {
    checkoutSessionId: string;
    stripeCustomerId: string | null;
    checkoutMode: "SUBSCRIPTION" | "TOP_UP";
  }): Promise<BillingEventResult>;
  applyRefund?(input: EventBase & {
    adjustmentId: string;
    paymentIntentId: string | null;
    chargeId: string | null;
    customerId: string | null;
    amountMinor: number;
    currency: string;
    status: string;
    aggregate: boolean;
  }): Promise<BillingEventResult>;
  applyDispute?(input: EventBase & {
    disputeId: string;
    paymentIntentId: string | null;
    chargeId: string;
    amountMinor: number;
    currency: string;
    disputeStatus: string;
  }): Promise<BillingEventResult>;
  recordOutcome(input: {
    eventId: string;
    eventType: string;
    eventCreated?: number;
    livemode?: boolean;
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
    case "checkout.session.expired": return "EXPIRE_CHECKOUT";
    case "customer.subscription.created":
    case "customer.subscription.updated": return "SYNC_SUBSCRIPTION";
    case "customer.subscription.deleted": return "CANCEL_SUBSCRIPTION";
    case "invoice.paid": return "GRANT_RENEWAL_CREDITS";
    case "invoice.payment_failed": return "MARK_PAST_DUE";
    case "refund.created":
    case "refund.updated":
    case "charge.refunded": return "RECONCILE_REFUND";
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed": return "RECONCILE_DISPUTE";
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

function checkoutEventMetadata(event: Stripe.Event, session: Stripe.Checkout.Session): Record<string, unknown> {
  const metadata = session.metadata ?? {};
  return {
    ...eventMetadata(event, session.id),
    accountId: metadata.xeriano_account_id ?? null,
    actorId: metadata.xeriano_actor_id ?? null,
    requestId: metadata.xeriano_request_id ?? null,
    productCode: metadata.xeriano_product_code ?? null,
    catalogVersion: metadata.xeriano_catalog_version ?? null,
  };
}

async function mappingForPrice(
  priceId: string,
  repository: XerianoBillingSettlementRepository,
  livemode = false,
): Promise<XerianoStripePriceMapping> {
  const mapping = await repository.resolvePriceMapping(priceId, livemode);
  if (!mapping) throw new XerianoWebhookProcessingError("UNKNOWN_STRIPE_PRICE");
  return mapping;
}

async function subscriptionSnapshot(
  subscription: Stripe.Subscription,
  repository: XerianoBillingSettlementRepository,
  livemode: boolean,
) {
  const items = subscription.items.data;
  if (items.length !== 1) throw new XerianoWebhookProcessingError("UNSUPPORTED_SUBSCRIPTION_ITEMS");
  const item = items[0]!;
  const priceId = objectId(item.price);
  if (!priceId) throw new XerianoWebhookProcessingError("SUBSCRIPTION_PRICE_MISSING");
  const mapping = await mappingForPrice(priceId, repository, livemode);
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
  livemode: boolean,
) {
  const candidates: Array<{ line: Stripe.InvoiceLineItem; priceId: string; mapping: XerianoStripePriceMapping }> = [];
  for (const line of invoice.lines.data) {
    const priceId = objectId(line.pricing?.price_details?.price);
    if (!priceId) continue;
    const mapping = await repository.resolvePriceMapping(priceId, livemode);
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
  const paidPayment = invoice.payments?.data.find((payment) => payment.status === "paid") ?? null;
  return {
    customerId,
    subscriptionId,
    priceId: candidate.priceId,
    mapping: candidate.mapping,
    periodStart: isoFromSeconds(candidate.line.period.start),
    periodEnd: isoFromSeconds(candidate.line.period.end),
    planLineAmountMinor: candidate.line.amount,
    paymentIntentId: objectId(paidPayment?.payment.payment_intent)
      ?? objectId((invoice as unknown as { payment_intent?: unknown }).payment_intent),
    chargeId: objectId(paidPayment?.payment.charge)
      ?? objectId((invoice as unknown as { charge?: unknown }).charge),
  };
}

export async function processVerifiedXerianoStripeEvent(input: {
  event: Stripe.Event;
  repository: XerianoBillingSettlementRepository;
  expectedLivemode?: boolean;
  authorityResolver?: XerianoStripeAuthorityResolver;
}): Promise<BillingEventResult> {
  const { event, repository } = input;
  const expectedLivemode = input.expectedLivemode ?? false;
  if (event.livemode !== expectedLivemode) throw new XerianoWebhookProcessingError("STRIPE_EVENT_MODE_MISMATCH", false);
  if (!isSupportedXerianoStripeEvent(event.type)) return { status: "IGNORED", financialEffect: "NONE" };
  const eventType = event.type;

  if (eventType === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = objectId(session.customer);
    if (!customerId) throw new XerianoWebhookProcessingError("CHECKOUT_CUSTOMER_MISSING");
    const base = { eventId: event.id, eventType, eventCreated: event.created, livemode: event.livemode, metadata: checkoutEventMetadata(event, session) };
    if (session.mode === "payment") {
      return repository.grantTopUp({
        ...base,
        checkoutSessionId: session.id,
        stripeCustomerId: customerId,
        paymentStatus: session.payment_status,
        paymentIntentId: objectId(session.payment_intent),
        amountTotalMinor: session.amount_total,
        currency: session.currency?.toUpperCase() ?? null,
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

  if (eventType === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!repository.expireCheckout) throw new XerianoWebhookProcessingError("CHECKOUT_EXPIRY_HANDLER_UNAVAILABLE");
    if (session.mode !== "payment" && session.mode !== "subscription") throw new XerianoWebhookProcessingError("CHECKOUT_MODE_UNSUPPORTED");
    return repository.expireCheckout({
      eventId: event.id,
      eventType,
      eventCreated: event.created,
      livemode: event.livemode,
      metadata: checkoutEventMetadata(event, session),
      checkoutSessionId: session.id,
      stripeCustomerId: objectId(session.customer),
      checkoutMode: session.mode === "subscription" ? "SUBSCRIPTION" : "TOP_UP",
    });
  }

  if (eventType.startsWith("customer.subscription.")) {
    const deliveredSubscription = event.data.object as Stripe.Subscription;
    const subscription = input.authorityResolver
      ? await input.authorityResolver.retrieveSubscription(deliveredSubscription.id)
      : deliveredSubscription;
    const customerId = objectId(subscription.customer);
    if (!customerId) throw new XerianoWebhookProcessingError("SUBSCRIPTION_CUSTOMER_MISSING");
    const snapshot = await subscriptionSnapshot(subscription, repository, event.livemode);
    return repository.syncSubscription({
      eventId: event.id,
      eventType,
      eventCreated: event.created,
      livemode: event.livemode,
      metadata: eventMetadata(event, subscription.id),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: snapshot.mapping.stripePriceId,
      catalogVersion: snapshot.mapping.catalogVersion,
      stripeStatus: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      deleted: input.authorityResolver
        ? subscription.status === "canceled"
        : eventType === "customer.subscription.deleted",
      objectMarker: Math.max(event.created, subscription.created ?? 0),
    });
  }

  if (eventType === "refund.created" || eventType === "refund.updated") {
    if (!repository.applyRefund) throw new XerianoWebhookProcessingError("REFUND_HANDLER_UNAVAILABLE");
    const refund = event.data.object as Stripe.Refund;
    return repository.applyRefund({
      eventId: event.id,
      eventType,
      eventCreated: event.created,
      livemode: event.livemode,
      metadata: eventMetadata(event, refund.id),
      adjustmentId: refund.id,
      paymentIntentId: objectId(refund.payment_intent),
      chargeId: objectId(refund.charge),
      customerId: objectId(refund.customer),
      amountMinor: refund.amount,
      currency: refund.currency.toUpperCase(),
      status: refund.status ?? "unknown",
      aggregate: false,
    });
  }

  if (eventType === "charge.refunded") {
    if (!repository.applyRefund) throw new XerianoWebhookProcessingError("REFUND_HANDLER_UNAVAILABLE");
    const charge = event.data.object as Stripe.Charge;
    return repository.applyRefund({
      eventId: event.id,
      eventType,
      eventCreated: event.created,
      livemode: event.livemode,
      metadata: eventMetadata(event, charge.id),
      adjustmentId: charge.id,
      paymentIntentId: objectId(charge.payment_intent),
      chargeId: charge.id,
      customerId: objectId(charge.customer),
      amountMinor: charge.amount_refunded,
      currency: charge.currency.toUpperCase(),
      status: charge.refunded || charge.amount_refunded > 0 ? "succeeded" : "unknown",
      aggregate: true,
    });
  }

  if (eventType.startsWith("charge.dispute.")) {
    if (!repository.applyDispute) throw new XerianoWebhookProcessingError("DISPUTE_HANDLER_UNAVAILABLE");
    const dispute = event.data.object as Stripe.Dispute;
    return repository.applyDispute({
      eventId: event.id,
      eventType,
      eventCreated: event.created,
      livemode: event.livemode,
      metadata: eventMetadata(event, dispute.id),
      disputeId: dispute.id,
      paymentIntentId: objectId(dispute.payment_intent),
      chargeId: objectId(dispute.charge)!,
      amountMinor: dispute.amount,
      currency: dispute.currency.toUpperCase(),
      disputeStatus: dispute.status,
    });
  }

  const invoice = event.data.object as Stripe.Invoice;
  const invoiceData = await invoiceSnapshot(invoice, repository, event.livemode);
  const base = { eventId: event.id, eventType, eventCreated: event.created, livemode: event.livemode, metadata: eventMetadata(event, invoice.id) };
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
      eventCreated: event.created,
      livemode: event.livemode,
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
    paymentIntentId: invoiceData.paymentIntentId,
    chargeId: invoiceData.chargeId,
  });
}
