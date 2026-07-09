import type { Metadata } from "next";
import { ContentInterface } from "@/components/content/content-interface";
import { AgentWorkspacePage } from "@/components/workspace/agent-workspace-page";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.content.page.title,
};

export default function ContentAgentPage() {
  return (
    <AgentWorkspacePage agentId="content">
      <ContentInterface />
    </AgentWorkspacePage>
  );
}
