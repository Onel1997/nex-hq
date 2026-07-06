import type { Metadata } from "next";
import { ResearchStudio } from "@/components/research/v2";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import "@/app/research-studio.css";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: "Research Studio",
  description: dict.research.page.description,
};

export default function ResearchAgentPage() {
  return <ResearchStudio />;
}
