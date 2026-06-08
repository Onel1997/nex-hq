import type { Metadata } from "next";
import { BrainKnowledgeSystem } from "@/components/brain/brain-knowledge-system";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "Brain",
};

export default function BrainPage() {
  return (
    <CommandSurface>
      <PageHeader
        title="Milaene Brain"
        description="The living memory of your brand — vision, design, competitors, and strategy in one place."
      />

      <BrainKnowledgeSystem />
    </CommandSurface>
  );
}
