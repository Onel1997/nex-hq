import type { Metadata } from "next";
import { ImageStudioCenter } from "@/components/image/image-studio-center";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import "@/app/image-studio.css";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.image.page.title,
};

export default function ImageAgentPage() {
  return <ImageStudioCenter />;
}
