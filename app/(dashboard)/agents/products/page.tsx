import type { Metadata } from "next";
import { ProductLibraryWorkspace } from "@/components/product-library/product-library-workspace";

export const metadata: Metadata = { title: "Produktbibliothek" };

export default function ProductLibraryPage() {
  return <ProductLibraryWorkspace />;
}
