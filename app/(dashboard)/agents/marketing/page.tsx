import type { Metadata } from "next";
import { MarketingInterface } from "@/components/marketing/marketing-interface";
import { AgentWorkspacePage } from "@/components/workspace/agent-workspace-page";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.marketing.page.title,
};

export default function MarketingAgentPage() {
  return (
    <AgentWorkspacePage agentId="marketing">
      <MarketingInterface />
    </AgentWorkspacePage>
  );
}
