import type { Metadata } from "next";
import { ShopifyOperationsCenter } from "@/components/shopify/shopify-operations-center";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const dict = getDictionary(DEFAULT_LOCALE);

export const metadata: Metadata = {
  title: dict.shopify.page.title,
};

export default function ShopifyAgentPage() {
  return <ShopifyOperationsCenter />;
}
