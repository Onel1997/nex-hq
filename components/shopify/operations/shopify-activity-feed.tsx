"use client";

import type { CommerceActivityEvent } from "@/lib/shopify/operations";
import { cn } from "@/lib/utils";

interface ShopifyActivityFeedProps {
  events: CommerceActivityEvent[];
}

const TYPE_LABELS: Record<CommerceActivityEvent["type"], string> = {
  product_added: "Product",
  price_signal: "Pricing",
  collection: "Collection",
  campaign: "Campaign",
  image: "Image",
  ceo: "CEO",
  inventory: "Inventory",
};

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ShopifyActivityFeed({ events }: ShopifyActivityFeedProps) {
  if (events.length === 0) {
    return (
      <footer className="shopify-activity-feed">
        <span className="shopify-activity-label">Activity</span>
        <p className="shopify-activity-empty">No recent commerce activity</p>
      </footer>
    );
  }

  return (
    <footer className="shopify-activity-feed" aria-label="Commerce activity">
      <span className="shopify-activity-label">Activity</span>
      <div className="shopify-activity-track">
        {events.map((event) => (
          <div key={event.id} className="shopify-activity-item">
            <span className={cn("shopify-activity-type", `shopify-activity-type-${event.type}`)}>
              {TYPE_LABELS[event.type]}
            </span>
            <span className="shopify-activity-text">{event.label}</span>
            {event.meta ? (
              <span className="shopify-activity-meta">{event.meta}</span>
            ) : null}
            <span className="shopify-activity-time">{formatTime(event.time)}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}
