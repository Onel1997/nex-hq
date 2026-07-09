"use client";

import Link from "next/link";
import type { CommerceLabPayload } from "@/lib/commerce/commerce-lab-types";
import { formatCommerceCurrency } from "@/lib/shopify/commerce-shared";
import {
  ArrowUpRight,
  Brain,
  Crown,
  Megaphone,
  Palette,
  ShoppingBag,
} from "lucide-react";

interface CommerceLabSidebarProps {
  data: CommerceLabPayload;
}

export function CommerceLabSidebar({ data }: CommerceLabSidebarProps) {
  const links = [
    {
      href: data.integrations.ceoCommand,
      label: "CEO Command",
      icon: Crown,
      desc: "Strategic decisions & missions",
      insightCount: data.ceoInsights.length,
    },
    {
      href: data.integrations.designStudio,
      label: "Design Studio",
      icon: Palette,
      desc: "Collection & visual direction",
      insightCount: data.designInsights.length,
    },
    {
      href: data.integrations.shopifyOperations,
      label: "Shopify Operations",
      icon: ShoppingBag,
      desc: "Catalog & inventory ops",
      insightCount: data.recommendations.length,
    },
    {
      href: data.integrations.marketingCenter,
      label: "Marketing Center",
      icon: Megaphone,
      desc: "Campaign timing & launches",
      insightCount: data.marketingInsights.length,
    },
  ];

  return (
    <aside className="commerce-lab-sidebar">
      <header className="commerce-lab-sidebar-header">
        <Brain className="size-4 text-[var(--commerce-accent)]" />
        <h2>Integrations</h2>
      </header>
      <p className="commerce-lab-sidebar-mission">{data.mission}</p>

      <ul className="commerce-lab-integration-list">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link href={link.href} className="commerce-lab-integration-card">
                <div className="commerce-lab-integration-icon">
                  <Icon className="size-4" />
                </div>
                <div className="commerce-lab-integration-body">
                  <span className="commerce-lab-integration-label">{link.label}</span>
                  <span className="commerce-lab-integration-desc">{link.desc}</span>
                </div>
                <span className="commerce-lab-integration-badge">
                  {link.insightCount} insights
                </span>
                <ArrowUpRight className="commerce-lab-integration-arrow size-3.5" />
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="commerce-lab-sidebar-meta">
        <p>
          <span>Source</span>
          <span>{data.hasHistoricalData ? "Historical CSV" : "Catalog"}</span>
        </p>
        <p>
          <span>Status</span>
          <span className="commerce-lab-live">
            <span className="commerce-lab-live-dot" />
            Live
          </span>
        </p>
      </div>
    </aside>
  );
}
