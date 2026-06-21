"use client";

import {
  formatPrice,
  getProductStockStatus,
  getShopifyAdminProductUrl,
  getStorefrontProductUrl,
} from "@/lib/shopify/operations";
import type { ShopifyKnowledgeProduct } from "@/lib/shopify/types";
import { cn } from "@/lib/utils";
import { ExternalLink, Sparkles } from "lucide-react";
import Image from "next/image";

interface ShopifyProductCardProps {
  product: ShopifyKnowledgeProduct;
  storeDomain: string;
  onOpen: (product: ShopifyKnowledgeProduct) => void;
}

const STATUS_LABELS = {
  active: "Active",
  low_stock: "Supplier Flag",
  sold_out: "Unavailable",
} as const;

export function ShopifyProductCard({
  product,
  storeDomain,
  onOpen,
}: ShopifyProductCardProps) {
  const stockStatus = getProductStockStatus(product);
  const storefrontUrl = getStorefrontProductUrl(storeDomain, product.handle);
  const adminUrl = getShopifyAdminProductUrl(storeDomain, product.id);

  return (
    <article className="shopify-product-card">
      <button
        type="button"
        className="shopify-product-card-preview"
        onClick={() => onOpen(product)}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            className="shopify-product-card-image"
            sizes="(max-width: 768px) 100vw, 280px"
            unoptimized
          />
        ) : (
          <div className="shopify-product-card-no-image">No image</div>
        )}
        <span
          className={cn(
            "shopify-product-status",
            `shopify-product-status-${stockStatus}`,
          )}
        >
          {STATUS_LABELS[stockStatus]}
        </span>
      </button>

      <div className="shopify-product-card-body">
        <button
          type="button"
          className="shopify-product-card-title"
          onClick={() => onOpen(product)}
        >
          {product.title}
        </button>

        <div className="shopify-product-card-meta">
          <span className="shopify-product-price">
            {formatPrice(product.price, product.currency)}
          </span>
          <span className="shopify-product-inventory">{product.inventory} units</span>
        </div>

        <div className="shopify-product-card-tags">
          <span className="shopify-product-type">{product.productType}</span>
          {product.collections[0] ? (
            <span className="shopify-product-collection">{product.collections[0]}</span>
          ) : null}
        </div>

        {product.tags.length > 0 ? (
          <div className="shopify-product-tag-row">
            {product.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="shopify-product-tag">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="shopify-product-card-actions">
          <button
            type="button"
            className="shopify-product-action shopify-product-action-primary"
            onClick={() => onOpen(product)}
          >
            Open Product
          </button>
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shopify-product-action"
          >
            <ExternalLink className="size-3" />
            Shopify
          </a>
          <a
            href={adminUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shopify-product-action"
            title="Admin"
          >
            Admin
          </a>
          <button
            type="button"
            className="shopify-product-action"
            onClick={() => onOpen(product)}
          >
            <Sparkles className="size-3" />
            AI Insights
          </button>
        </div>
      </div>
    </article>
  );
}
