import type { Metadata } from "next";
import { ResearchInterface } from "@/components/research/research-interface";
import { AgentWorkspacePage } from "@/components/workspace/agent-workspace-page";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.research.page.title,
};

export default function ResearchAgentPage() {
  return (
    <AgentWorkspacePage agentId="research">
      <ResearchInterface />
    </AgentWorkspacePage>
  );
}
