"use client";

import type { AgentConnectionStatus, CommerceInsight } from "@/lib/shopify/operations";
import { cn } from "@/lib/utils";
import { Megaphone, Sparkles, TrendingUp } from "lucide-react";

interface ShopifyAiPanelProps {
  insights: CommerceInsight[];
  agentConnections: AgentConnectionStatus;
}

const CONNECTION_ITEMS: Array<{
  key: keyof AgentConnectionStatus;
  label: string;
}> = [
  { key: "design", label: "Design" },
  { key: "image", label: "Image" },
  { key: "marketing", label: "Marketing" },
  { key: "content", label: "Content" },
  { key: "ceo", label: "CEO" },
];

function groupInsights(insights: CommerceInsight[]) {
  const historicalSignals = insights.filter(
    (i) => i.kind === "bestseller" || i.kind === "ceo",
  );
  const productRecommendations = insights.filter(
    (i) =>
      i.kind === "category" ||
      i.kind === "pricing" ||
      i.kind === "supplier" ||
      i.kind === "inventory",
  );
  const campaignOpportunities = insights.filter(
    (i) => i.kind === "marketprint" || i.kind === "expansion",
  );

  return { historicalSignals, productRecommendations, campaignOpportunities };
}

function InsightSection({
  title,
  icon: Icon,
  items,
  emptyMessage,
}: {
  title: string;
  icon: typeof Sparkles;
  items: CommerceInsight[];
  emptyMessage: string;
}) {
  return (
    <section className="shopify-ai-section">
      <h3 className="shopify-ai-section-title">
        <Icon className="size-3 opacity-70" />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="shopify-ai-section-empty">{emptyMessage}</p>
      ) : (
        <ul className="shopify-ai-insights">
          {items.map((insight) => (
            <li
              key={insight.id}
              className={cn(
                "shopify-ai-insight",
                `shopify-ai-insight-${insight.priority}`,
              )}
            >
              <span className="shopify-ai-insight-text">{insight.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ShopifyAiPanel({ insights, agentConnections }: ShopifyAiPanelProps) {
  const { historicalSignals, productRecommendations, campaignOpportunities } =
    groupInsights(insights);

  return (
    <aside className="shopify-ai-panel" aria-label="AI commerce intelligence">
      <header className="shopify-ai-panel-header">
        <Sparkles className="size-4 text-[#22c55e]" />
        <h2>AI Commerce</h2>
      </header>

      <div className="shopify-ai-panel-body">
        <InsightSection
          title="Historical Signals"
          icon={TrendingUp}
          items={historicalSignals}
          emptyMessage="Historical signals will appear as order data loads."
        />

        <InsightSection
          title="Product Recommendations"
          icon={Sparkles}
          items={productRecommendations}
          emptyMessage="Product recommendations will appear from catalog analysis."
        />

        <InsightSection
          title="Campaign Opportunities"
          icon={Megaphone}
          items={campaignOpportunities}
          emptyMessage="Campaign opportunities will surface from commerce trends."
        />

        <section className="shopify-ai-section shopify-ai-section-connections">
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
