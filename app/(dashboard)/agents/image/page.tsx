import type { Metadata } from "next";
import { ImageInterface } from "@/components/image/image-interface";
import { ActiveWorkspaceBadge } from "@/components/shared/active-workspace-badge";
import { AgentStatusBadge } from "@/components/shared/agent-status-badge";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.image.page.title,
};

export default function ImageAgentPage() {
  return (
    <CommandSurface>
      <PageHeader
        title={dict.image.page.title}
        description={dict.image.page.description}
      >
        <ActiveWorkspaceBadge />
        <AgentStatusBadge status="active" showPulse />
      </PageHeader>

      <ImageInterface />
    </CommandSurface>
  );
}
