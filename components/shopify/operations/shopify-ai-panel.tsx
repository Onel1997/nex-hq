"use client";

import type { AgentConnectionStatus, CommerceInsight } from "@/lib/shopify/operations";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Crown,
  Factory,
  Sparkles,
  Tag,
  TrendingUp,
  Zap,
} from "lucide-react";

const KIND_ICONS = {
  bestseller: TrendingUp,
  pricing: Tag,
  inventory: AlertTriangle,
  supplier: Zap,
  marketprint: Factory,
  category: Tag,
  expansion: Zap,
  ceo: Crown,
} as const;

interface ShopifyAiPanelProps {
  insights: CommerceInsight[];
  agentConnections: AgentConnectionStatus;
}

const CONNECTION_ITEMS: Array<{
  key: keyof AgentConnectionStatus;
  label: string;
}> = [
  { key: "design", label: "Design assets available" },
  { key: "image", label: "Image assets available" },
  { key: "marketing", label: "Marketing campaign ready" },
  { key: "content", label: "Product copy available" },
  { key: "ceo", label: "CEO recommendations" },
];

export function ShopifyAiPanel({ insights, agentConnections }: ShopifyAiPanelProps) {
  return (
    <aside className="shopify-ai-panel" aria-label="AI commerce intelligence">
      <header className="shopify-ai-panel-header">
        <Sparkles className="size-4 text-[#22c55e]" />
        <h2>AI Commerce</h2>
      </header>

      <div className="shopify-ai-panel-body">
        <section className="shopify-ai-section">
          <h3 className="shopify-ai-section-title">Intelligence</h3>
          <ul className="shopify-ai-insights">
            {insights.map((insight) => {
              const Icon = KIND_ICONS[insight.kind];
              return (
                <li
                  key={insight.id}
                  className={cn(
                    "shopify-ai-insight",
                    `shopify-ai-insight-${insight.priority}`,
                  )}
                >
                  <Icon className="size-3.5 shrink-0 opacity-70" />
                  <span>{insight.message}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="shopify-ai-section">
          <h3 className="shopify-ai-section-title">Agent Connections</h3>
          <ul className="shopify-ai-connections">
            {CONNECTION_ITEMS.map((item) => {
              const connected = agentConnections[item.key];
              return (
                <li
                  key={item.key}
                  className={cn(
                    "shopify-ai-connection",
                    connected && "shopify-ai-connection-active",
                  )}
                >
                  <span className="shopify-ai-connection-mark">
                    {connected ? "✓" : "○"}
                  </span>
                  <span>{item.label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </aside>
  );
}
