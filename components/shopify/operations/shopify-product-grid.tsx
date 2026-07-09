"use client";

import type { ShopifyKnowledgeProduct } from "@/lib/shopify/types";
import { ShopifyProductCard } from "@/components/shopify/operations/shopify-product-card";

interface ShopifyProductGridProps {
  products: ShopifyKnowledgeProduct[];
  storeDomain: string;
  onOpenProduct: (product: ShopifyKnowledgeProduct) => void;
}

export function ShopifyProductGrid({
  products,
  storeDomain,
  onOpenProduct,
}: ShopifyProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="shopify-product-grid-empty">
        <p>No products match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="shopify-product-grid">
      {products.map((product) => (
        <ShopifyProductCard
          key={product.id}
          product={product}
          storeDomain={storeDomain}
          onOpen={onOpenProduct}
        />
      ))}
    </div>
  );
}
