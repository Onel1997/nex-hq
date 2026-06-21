import type { Metadata } from "next";
import { DesignInterface } from "@/components/design/design-interface";
import { AgentWorkspacePage } from "@/components/workspace/agent-workspace-page";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.design.page.title,
};

export default function DesignAgentPage() {
  return (
    <AgentWorkspacePage agentId="designer">
      <DesignInterface />
    </AgentWorkspacePage>
  );
}
