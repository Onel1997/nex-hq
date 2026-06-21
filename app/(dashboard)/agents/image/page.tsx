import type { Metadata } from "next";
import { ImageInterface } from "@/components/image/image-interface";
import { AgentWorkspacePage } from "@/components/workspace/agent-workspace-page";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.image.page.title,
};

export default function ImageAgentPage() {
  return (
    <AgentWorkspacePage agentId="image">
      <ImageInterface />
    </AgentWorkspacePage>
  );
}
