import { createHash } from "node:crypto";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";

export type StoredStripeEventAuthority = {
  id: string;
  livemode: boolean;
  event: Stripe.Event;
};

function objectId(event: Stripe.Event): string | null {
  const value = event.data.object as { id?: unknown };
  return typeof value.id === "string" ? value.id : null;
}

export async function persistVerifiedStripeEventAuthority(input: {
  event: Stripe.Event;
  rawPayload: string;
}): Promise<void> {
  const digest = createHash("sha256").update(input.rawPayload, "utf8").digest("hex");
  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("xeriano_stripe_event_authorities")
    .select("payload_sha256")
    .eq("livemode", input.event.livemode)
    .eq("stripe_event_id", input.event.id)
    .maybeSingle();
  if (readError) throw new Error("STRIPE_EVENT_AUTHORITY_READ_FAILED");
  if (existing) {
    if (String(existing.payload_sha256) !== digest) throw new Error("STRIPE_EVENT_AUTHORITY_CONFLICT");
    return;
  }
  const { error } = await admin.from("xeriano_stripe_event_authorities").insert({
    livemode: input.event.livemode,
    stripe_event_id: input.event.id,
    event_type: input.event.type,
    event_created: input.event.created,
    object_id: objectId(input.event),
    payload: input.event,
    payload_sha256: digest,
  });
  if (error) {
    if (error.code !== "23505") throw new Error("STRIPE_EVENT_AUTHORITY_PERSIST_FAILED");
    const { data: concurrent, error: concurrentError } = await admin
      .from("xeriano_stripe_event_authorities")
      .select("payload_sha256")
      .eq("livemode", input.event.livemode)
      .eq("stripe_event_id", input.event.id)
      .maybeSingle();
    if (concurrentError || String(concurrent?.payload_sha256 ?? "") !== digest) {
      throw new Error("STRIPE_EVENT_AUTHORITY_CONFLICT");
    }
  }
}

export async function listStripeReconciliationCandidates(input: {
  livemode: boolean;
  limit?: number;
}) {
  const admin = createAdminClient();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const [{ data: events, error: eventError }, { data: authorities, error: authorityError }] = await Promise.all([
    admin
    .from("xeriano_billing_events")
    .select("id,stripe_event_id,event_type,processing_status,failure_code,received_at")
    .eq("livemode", input.livemode)
    .in("processing_status", ["RECEIVED", "PROCESSING", "FAILED"])
    .order("received_at", { ascending: true })
    .limit(limit),
    admin
      .from("xeriano_stripe_event_authorities")
      .select("id,stripe_event_id,event_type,received_at")
      .eq("livemode", input.livemode)
      .order("received_at", { ascending: true })
      .limit(limit),
  ]);
  if (eventError || authorityError) throw new Error("BILLING_RECONCILIATION_LIST_FAILED");
  const eventByStripeId = new Map((events ?? []).map((row) => [String(row.stripe_event_id), row]));
  const authorityByStripeId = new Map((authorities ?? []).map((row) => [String(row.stripe_event_id), row]));
  const candidates = (authorities ?? []).flatMap((authority) => {
    const event = eventByStripeId.get(String(authority.stripe_event_id));
    if (event && !["RECEIVED", "PROCESSING", "FAILED"].includes(String(event.processing_status))) return [];
    return [{
      recordId: String(authority.id),
      eventType: String(authority.event_type),
      status: event ? String(event.processing_status) : "UNPROCESSED",
      failureCode: event?.failure_code ? String(event.failure_code) : null,
      receivedAt: String(authority.received_at),
      replayable: true,
    }];
  });
  for (const event of events ?? []) {
    if (authorityByStripeId.has(String(event.stripe_event_id))) continue;
    candidates.push({
      recordId: String(event.id),
      eventType: String(event.event_type),
      status: "AUTHORITY_MISSING",
      failureCode: event.failure_code ? String(event.failure_code) : null,
      receivedAt: String(event.received_at),
      replayable: false,
    });
  }
  return candidates
    .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt))
    .slice(0, limit);
}

export async function loadStripeEventAuthorityForReplay(input: {
  recordId: string;
  livemode: boolean;
}): Promise<StoredStripeEventAuthority | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("xeriano_stripe_event_authorities")
    .select("id,stripe_event_id,livemode,payload")
    .eq("id", input.recordId)
    .eq("livemode", input.livemode)
    .maybeSingle();
  if (error) throw new Error("BILLING_RECONCILIATION_AUTHORITY_READ_FAILED");
  if (!data) return null;
  const event = data.payload as Partial<Stripe.Event>;
  if (typeof event.id !== "string" || typeof event.type !== "string"
    || typeof event.created !== "number" || typeof event.livemode !== "boolean"
    || event.id !== String(data.stripe_event_id) || event.livemode !== input.livemode
    || !event.data || typeof event.data !== "object") {
    throw new Error("BILLING_RECONCILIATION_AUTHORITY_INVALID");
  }
  return { id: String(data.id), livemode: Boolean(data.livemode), event: event as Stripe.Event };
}
