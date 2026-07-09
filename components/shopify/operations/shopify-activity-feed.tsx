"use client";

import type { CommerceActivityEvent } from "@/lib/shopify/operations";
import { cn } from "@/lib/utils";
import {
  Factory,
  FolderOpen,
  Megaphone,
  Package,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

interface ShopifyActivityFeedProps {
  events: CommerceActivityEvent[];
}

type TimelineCategory =
  | "collection"
  | "product"
  | "ai"
  | "marketprint"
  | "campaign";

interface TimelineMeta {
  category: TimelineCategory;
  label: string;
  icon: LucideIcon;
}

const TIMELINE_META: Record<TimelineCategory, Omit<TimelineMeta, "category">> = {
  collection: { label: "Collection live", icon: FolderOpen },
  product: { label: "Product synced", icon: Package },
  ai: { label: "AI insights generated", icon: Sparkles },
  marketprint: { label: "MarketPrint analyzed", icon: Factory },
  campaign: { label: "Campaign recommendations", icon: Megaphone },
};

function resolveTimelineMeta(event: CommerceActivityEvent): TimelineMeta {
  if (/marketprint/i.test(event.label)) {
    return { category: "marketprint", ...TIMELINE_META.marketprint };
  }

  switch (event.type) {
    case "collection":
      return { category: "collection", ...TIMELINE_META.collection };
    case "product_added":
    case "image":
      return { category: "product", ...TIMELINE_META.product };
    case "price_signal":
    case "ceo":
    case "inventory":
      return { category: "ai", ...TIMELINE_META.ai };
    case "campaign":
      return { category: "campaign", ...TIMELINE_META.campaign };
    default:
      return { category: "ai", ...TIMELINE_META.ai };
  }
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function shortenLabel(label: string): string {
  const cleaned = label.replace(/^Collection live:\s*/i, "").trim();
  if (cleaned.length <= 52) return cleaned;
  return `${cleaned.slice(0, 49)}…`;
}

export function ShopifyActivityFeed({ events }: ShopifyActivityFeedProps) {
  if (events.length === 0) {
    return (
      <footer className="shopify-activity-feed">
        <div className="shopify-activity-feed-header">
          <span className="shopify-activity-label">Activity Timeline</span>
        </div>
        <p className="shopify-activity-empty">No recent commerce activity</p>
      </footer>
    );
  }

  return (
    <footer className="shopify-activity-feed" aria-label="Commerce activity timeline">
      <div className="shopify-activity-feed-header">
        <span className="shopify-activity-label">Activity Timeline</span>
        <span className="shopify-activity-feed-hint">Live commerce signals</span>
      </div>

      <div className="shopify-activity-timeline">
        {events.map((event, index) => {
          const meta = resolveTimelineMeta(event);
          const Icon = meta.icon;

          return (
            <div key={event.id} className="shopify-activity-node">
              {index > 0 ? <span className="shopify-activity-connector" aria-hidden /> : null}
              <div
                className={cn(
                  "shopify-activity-node-card",
                  `shopify-activity-node-${meta.category}`,
                )}
              >
                <div className="shopify-activity-node-icon">
                  <Icon className="size-3" />
                </div>
                <div className="shopify-activity-node-body">
                  <span className="shopify-activity-node-category">{meta.label}</span>
                  <span className="shopify-activity-node-text">{shortenLabel(event.label)}</span>
                  {event.meta ? (
                    <span className="shopify-activity-node-meta">{event.meta}</span>
                  ) : null}
                </div>
                <time className="shopify-activity-node-time">{formatTime(event.time)}</time>
              </div>
            </div>
          );
        })}
      </div>
    </footer>
  );
}
