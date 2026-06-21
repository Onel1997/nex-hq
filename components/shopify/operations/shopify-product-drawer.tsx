"use client";

import type { ProductAgentInsights } from "@/lib/shopify/operations";
import {
  formatPrice,
  getProductStockStatus,
  getStorefrontProductUrl,
  SUPPLIER_STATUS_LABELS,
} from "@/lib/shopify/operations";
import type { ShopifyProductDetail } from "@/lib/shopify/fetch-product-detail";
import type { ShopifyKnowledgeProduct } from "@/lib/shopify/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface ShopifyProductDrawerProps {
  product: ShopifyKnowledgeProduct | null;
  storeDomain: string;
  onClose: () => void;
}

interface DetailResponse {
  ok?: boolean;
  product?: ShopifyProductDetail;
  agentInsights?: ProductAgentInsights;
  error?: string;
}

export function ShopifyProductDrawer({
  product,
  storeDomain,
  onClose,
}: ShopifyProductDrawerProps) {
  const [detail, setDetail] = useState<ShopifyProductDetail | null>(null);
  const [insights, setInsights] = useState<ProductAgentInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!product) {
      setDetail(null);
      setInsights(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch(`/api/shopify/products/${encodeURIComponent(product.id)}`)
      .then(async (res) => {
        const body = (await res.json()) as DetailResponse;
        if (!res.ok || !body.ok || !body.product) {
          throw new Error(body.error ?? "Failed to load product");
        }
        if (!cancelled) {
          setDetail(body.product);
          setInsights(body.agentInsights ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load product");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [product]);

  const stockStatus = product ? getProductStockStatus(product) : null;

  return (
    <AnimatePresence>
      {product ? (
        <>
          <motion.button
            type="button"
            className="shopify-drawer-backdrop"
            aria-label="Close product"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="shopify-product-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <header className="shopify-drawer-header">
              <div>
                <p className="shopify-drawer-eyebrow">{product.productType}</p>
                <h2 className="shopify-drawer-title">{product.title}</h2>
              </div>
              <button type="button" className="shopify-drawer-close" onClick={onClose}>
                <X className="size-5" />
              </button>
            </header>

            <div className="shopify-drawer-body">
              {loading && !detail ? (
                <div className="shopify-drawer-loading">
                  <Loader2 className="size-5 animate-spin" />
                  <span>Loading product…</span>
                </div>
              ) : error ? (
                <p className="shopify-drawer-error">{error}</p>
              ) : detail ? (
                <>
                  <div className="shopify-drawer-gallery">
                    {detail.images.length > 0 ? (
                      detail.images.map((url) => (
                        <div key={url} className="shopify-drawer-gallery-item">
                          <Image
                            src={url}
                            alt={detail.title}
                            fill
                            className="object-cover"
                            sizes="200px"
                            unoptimized
                          />
                        </div>
                      ))
                    ) : (
                      <div className="shopify-drawer-gallery-empty">No images</div>
                    )}
                  </div>

                  <div className="shopify-drawer-stats">
                    <div>
                      <span className="shopify-drawer-stat-label">Price</span>
                      <span className="shopify-drawer-stat-value">
                        {formatPrice(detail.priceMin, detail.currency)}
                        {detail.priceMin !== detail.priceMax
                          ? ` – ${formatPrice(detail.priceMax, detail.currency)}`
                          : null}
                      </span>
                    </div>
                    <div>
                      <span className="shopify-drawer-stat-label">Catalog Signal</span>
                      <span className="shopify-drawer-stat-value">
                        {detail.totalInventory} virtual
                      </span>
                    </div>
                    <div>
                      <span className="shopify-drawer-stat-label">Availability</span>
                      <span
                        className={cn(
                          "shopify-product-status shopify-product-status-inline",
                          stockStatus && `shopify-product-status-${stockStatus}`,
                        )}
                      >
                        {stockStatus ? SUPPLIER_STATUS_LABELS[stockStatus] : detail.status}
                      </span>
                    </div>
                  </div>

                  {detail.collections.length > 0 ? (
                    <div className="shopify-drawer-block">
                      <p className="shopify-drawer-block-label">Collections</p>
                      <div className="shopify-drawer-chips">
                        {detail.collections.map((c) => (
                          <span key={c} className="shopify-drawer-chip">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {detail.tags.length > 0 ? (
                    <div className="shopify-drawer-block">
                      <p className="shopify-drawer-block-label">Tags</p>
                      <div className="shopify-drawer-chips">
                        {detail.tags.map((tag) => (
                          <span key={tag} className="shopify-drawer-chip shopify-drawer-chip-dim">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {detail.variants.length > 0 ? (
                    <div className="shopify-drawer-block">
                      <p className="shopify-drawer-block-label">
                        Variants ({detail.variants.length})
                      </p>
                      <ul className="shopify-drawer-variants">
                        {detail.variants.map((variant) => (
                          <li key={variant.id} className="shopify-drawer-variant">
                            <span>{variant.title}</span>
                            <span className="shopify-drawer-variant-meta">
                              {formatPrice(variant.price, variant.currency)} ·{" "}
                              {variant.inventory} virtual
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {insights ? (
                    <>
                      <AgentInsightBlock
                        title="Design Agent"
                        items={insights.design}
                        available={insights.connections.design}
                      />
                      <AgentInsightBlock
                        title="Image Agent"
                        items={insights.image}
                        available={insights.connections.image}
                      />
                      <AgentInsightBlock
                        title="Marketing"
                        items={insights.marketing}
                        available={insights.connections.marketing}
                      />
                      <AgentInsightBlock
                        title="Content"
                        items={insights.content}
                        available={insights.connections.content}
                      />
                      <AgentInsightBlock
                        title="CEO"
                        items={insights.ceo}
                        available={insights.connections.ceo}
                      />
                    </>
                  ) : null}

                  <a
                    href={getStorefrontProductUrl(storeDomain, detail.handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shopify-drawer-storefront-link"
                  >
                    <ExternalLink className="size-4" />
                    View on Shopify storefront
                  </a>
                </>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function AgentInsightBlock({
  title,
  items,
  available,
}: {
  title: string;
  items: string[];
  available: boolean;
}) {
  return (
    <div className="shopify-drawer-agent-block">
      <div className="shopify-drawer-agent-header">
        <p className="shopify-drawer-block-label">{title}</p>
        <span
          className={cn(
            "shopify-drawer-agent-status",
            available && "shopify-drawer-agent-status-active",
          )}
        >
          {available ? "✓ Connected" : "○ Pending"}
        </span>
      </div>
      <ul className="shopify-drawer-agent-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
