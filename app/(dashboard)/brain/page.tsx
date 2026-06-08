import type { Metadata } from "next";
import { BrainKnowledgeSystem } from "@/components/brain/brain-knowledge-system";
import { CommandSurface } from "@/components/shared/command-surface";
import { PageHeader } from "@/components/shared/page-header";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.navigation.brain,
};

export default function BrainPage() {
  return (
    <CommandSurface>
      <PageHeader
        title={dict.brain.page.title}
        description={dict.brain.page.description}
      />

      <BrainKnowledgeSystem />
    </CommandSurface>
  );
}
