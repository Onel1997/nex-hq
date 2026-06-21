import type { Metadata } from "next";
import { DesignStudioCenter } from "@/components/design/design-studio-center";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.design.page.title,
};

export default function DesignAgentPage() {
  return <DesignStudioCenter />;
}
