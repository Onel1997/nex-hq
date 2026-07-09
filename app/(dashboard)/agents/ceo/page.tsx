import type { Metadata } from "next";
import { CeoInterface } from "@/components/ceo/ceo-interface";
import { AgentWorkspacePage } from "@/components/workspace/agent-workspace-page";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import "@/app/ceo-command.css";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.ceo.page.title,
};

export default function CeoAgentPage() {
  return (
    <AgentWorkspacePage agentId="ceo">
      <CeoInterface />
    </AgentWorkspacePage>
  );
}
