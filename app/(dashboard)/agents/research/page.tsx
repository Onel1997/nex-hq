import type { Metadata } from "next";
import { ResearchStudioV3 } from "@/components/research/v3";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import "@/app/research-studio-v3.css";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: "Research Studio",
  description: dict.research.page.description,
};

export default function ResearchAgentPage() {
  return <ResearchStudioV3 />;
}
