import type { Metadata } from "next";
import { ShopifyInterface } from "@/components/shopify/shopify-interface";
import { ActiveWorkspaceBadge } from "@/components/shared/active-workspace-badge";
import { AgentStatusBadge } from "@/components/shared/agent-status-badge";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.shopify.page.title,
};

export default function ShopifyAgentPage() {
  return (
    <CommandSurface>
      <PageHeader
        title={dict.shopify.page.title}
        description={dict.shopify.page.description}
      >
        <ActiveWorkspaceBadge />
        <AgentStatusBadge status="active" showPulse />
      </PageHeader>

      <ShopifyInterface />
    </CommandSurface>
  );
}
