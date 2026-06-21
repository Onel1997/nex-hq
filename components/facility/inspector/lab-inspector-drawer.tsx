"use client";

import { ExecutionTimeline } from "@/components/facility/inspector/execution-timeline";
import type { AgentId } from "@/lib/constants/agents";
import type { LabInspectorData, LabSnapshot } from "@/lib/facility/types";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, FlaskConical, Loader2, X } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";

interface ShopifyLiveProduct {
  id: string;
  title: string;
  status: string;
  inventory: number;
  imageUrl: string | null;
  price: string;
  currency: string;
  productType: string;
  collections: string[];
}

interface LabInspectorDrawerProps {
  open: boolean;
  agentId: AgentId | null;
  lab: LabSnapshot | null;
  data: LabInspectorData | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export const LabInspectorDrawer = memo(function LabInspectorDrawer({
  open,
  agentId,
  lab,
  data,
  loading,
  error,
  onClose,
}: LabInspectorDrawerProps) {
  const displayName = data?.agentName ?? lab?.label ?? agentId;
  const latestReport = data?.reports[0] ?? null;
  const activeTasks =
    data?.taskQueue.filter((t) => t.status !== "completed" && t.status !== "failed") ??
    [];

  const [shopifyProducts, setShopifyProducts] = useState<ShopifyLiveProduct[]>(
    [],
  );
  const [shopifyProductsLoading, setShopifyProductsLoading] = useState(false);
  const [shopifyProductsError, setShopifyProductsError] = useState<
    string | null
  >(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    {},
  );

  const shopifyProductCategories = useMemo(() => {
    const grouped = shopifyProducts.reduce<
      Record<string, ShopifyLiveProduct[]>
    >((acc, product) => {
      const type = product.productType?.trim() || "Uncategorized";
      (acc[type] ??= []).push(product);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([type, products]) => ({ type, products }))
      .sort((a, b) => b.products.length - a.products.length);
  }, [shopifyProducts]);

  useEffect(() => {
    if (!open || agentId !== "shopify") {
      setShopifyProducts([]);
      setShopifyProductsLoading(false);
      setShopifyProductsError(null);
      setOpenCategories({});
      return;
    }

    let cancelled = false;

    setShopifyProductsLoading(true);
    setShopifyProductsError(null);

    void fetch("/api/shopify/products")
      .then(async (response) => {
        const body = (await response.json()) as {
          ok?: boolean;
          products?: ShopifyLiveProduct[];
          error?: string;
        };

        if (!response.ok || !body.ok) {
          throw new Error(body.error ?? "Failed to load Shopify products");
        }

        if (!cancelled) {
          setShopifyProducts(body.products ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setShopifyProducts([]);
          setShopifyProductsError(
            err instanceof Error ? err.message : "Failed to load Shopify products",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setShopifyProductsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, agentId]);

  useEffect(() => {
    if (shopifyProductCategories.length === 0) {
      setOpenCategories({});
      return;
    }

    const initial: Record<string, boolean> = {};
    shopifyProductCategories.forEach((category, index) => {
      initial[category.type] = index === 0;
    });
    setOpenCategories(initial);
  }, [shopifyProductCategories]);

  const toggleShopifyCategory = (type: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  return (
    <AnimatePresence>
      {open && agentId ? (
        <>
          <motion.button
            type="button"
            className="facility-inspector-backdrop"
            aria-label="Close laboratory"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="facility-inspector-drawer facility-lab-room"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="facility-lab-room-ambient" aria-hidden />

            <header className="facility-inspector-header facility-lab-room-header">
              <div className="facility-lab-room-title-block">
                <div className="facility-lab-room-badge">
                  <FlaskConical className="size-3.5" />
                  <span>Laboratory Chamber</span>
                </div>
                <h2 className="facility-inspector-title">{displayName}</h2>
                {data?.role ? (
                  <p className="facility-inspector-role">{data.role}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="facility-inspector-close"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="facility-inspector-body">
              {loading && !data ? (
                <div className="facility-inspector-loading">
                  <Loader2 className="size-5 animate-spin" />
                  <span>Opening laboratory…</span>
                </div>
              ) : error ? (
                <p className="facility-inspector-error">{error}</p>
              ) : data ? (
                <>
                  <div
                    className={cn(
                      "facility-lab-room-livebar",
                      `facility-lab-room-livebar-${data.opsState}`,
                    )}
                  >
                    <span className="facility-lab-room-livebar-pulse" aria-hidden />
                    <span className="facility-lab-room-livebar-label">
                      {data.opsState === "executing"
                        ? "Agent is working"
                        : data.opsState === "review"
                          ? "Awaiting review"
                          : data.opsState === "queued"
                            ? "Task queued"
                            : data.opsState === "approved"
                              ? "Mission complete"
                              : data.opsState === "error"
                                ? "Attention needed"
                                : "Standing by"}
                    </span>
                    {data.opsState === "executing" && (
                      <span className="facility-lab-room-livebar-dots" aria-hidden>
                        <i /><i /><i />
                      </span>
                    )}
                  </div>
                  {agentId === "shopify" ? (
                    <section className="facility-inspector-section facility-lab-room-section">
                      <h3 className="facility-inspector-section-title">
                        Live Products
                      </h3>
                      {shopifyProductsLoading ? (
                        <p className="facility-inspector-empty">Lade Produkte…</p>
                      ) : shopifyProductsError ? (
                        <p className="facility-inspector-error">
                          {shopifyProductsError}
                        </p>
                      ) : shopifyProducts.length === 0 ? (
                        <p className="facility-inspector-empty">
                          No products found
                        </p>
                      ) : (
                        <>
                          <p className="facility-shopify-summary">
                            {shopifyProducts.length} Produkte ·{" "}
                            {shopifyProductCategories.length} Kategorien
                          </p>
                          <div className="facility-shopify-product-list">
                            {shopifyProductCategories.map((category) => {
                              const isOpen = openCategories[category.type] ?? false;

                              return (
                                <div
                                  key={category.type}
                                  className="facility-shopify-category"
                                >
                                  <button
                                    type="button"
                                    className="facility-shopify-category-header"
                                    onClick={() =>
                                      toggleShopifyCategory(category.type)
                                    }
                                    aria-expanded={isOpen}
                                  >
                                    <span className="facility-shopify-category-name">
                                      {category.type}
                                      <span className="facility-shopify-category-count">
                                        {" "}
                                        ({category.products.length})
                                      </span>
                                    </span>
                                    <span
                                      className={cn(
                                        "facility-shopify-category-chevron",
                                        isOpen &&
                                          "facility-shopify-category-chevron-open",
                                      )}
                                      aria-hidden
                                    >
                                      {isOpen ? (
                                        <ChevronDown className="size-4" />
                                      ) : (
                                        <ChevronRight className="size-4" />
                                      )}
                                    </span>
                                  </button>
                                  {isOpen ? (
                                    <div className="facility-shopify-category-products">
                                      {category.products.map((product) => (
                                        <div
                                          key={product.id}
                                          className="facility-shopify-product-card"
                                        >
                                          {product.imageUrl ? (
                                            <img
                                              src={product.imageUrl}
                                              alt=""
                                              className="facility-shopify-product-image"
                                            />
                                          ) : (
                                            <div
                                              className="facility-shopify-product-image facility-shopify-product-image-empty"
                                              aria-hidden
                                            />
                                          )}
                                          <div className="facility-shopify-product-body">
                                            <p className="facility-shopify-product-title">
                                              {product.title}
                                            </p>
                                            <p className="facility-shopify-product-price">
                                              {product.price} {product.currency}
                                            </p>
                                            <span
                                              className="facility-inspector-meta"
                                              data-status={product.status}
                                            >
                                              {product.status}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </section>
                  ) : null}
                  <section className="facility-inspector-section facility-lab-room-section">
                    <h3 className="facility-inspector-section-title">
                      Current Mission
                    </h3>
                    <div className="facility-lab-room-card">
                      <p className="facility-inspector-text">
                        {data.currentTask?.title ?? "No active mission assigned"}
                      </p>
                      <div className="facility-inspector-status-row">
                        <span
                          className={cn(
                            "facility-inspector-status",
                            `facility-inspector-status-${data.opsState}`,
                          )}
                        >
                          {data.opsState}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="facility-inspector-section facility-lab-room-section">
                    <h3 className="facility-inspector-section-title">
                      Active Tasks
                    </h3>
                    {activeTasks.length === 0 ? (
                      <p className="facility-inspector-empty">No active tasks</p>
                    ) : (
                      <ul className="facility-inspector-list facility-lab-room-list">
                        {activeTasks.map((task) => (
                          <li
                            key={task.id}
                            className="facility-inspector-list-item facility-lab-room-list-item"
                          >
                            <span>{task.title}</span>
                            <span
                              className="facility-inspector-meta"
                              data-status={task.status}
                            >
                              {task.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="facility-inspector-section facility-lab-room-section">
                    <h3 className="facility-inspector-section-title">
                      Latest Report
                    </h3>
                    <div className="facility-lab-room-card">
                      {latestReport ? (
                        <>
                          <p className="facility-inspector-text">
                            {latestReport.title}
                          </p>
                          <span className="facility-inspector-meta">
                            {latestReport.status} ·{" "}
                            {Math.round(latestReport.confidence * 100)}%
                          </span>
                        </>
                      ) : (
                        <p className="facility-inspector-empty">
                          No reports submitted
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="facility-inspector-section facility-lab-room-section">
                    <h3 className="facility-inspector-section-title">
                      Confidence
                    </h3>
                    <div className="facility-lab-room-confidence">
                      {data.confidence != null ? (
                        <>
                          <span className="facility-lab-room-confidence-value">
                            {Math.round(data.confidence * 100)}%
                          </span>
                          <div className="facility-lab-room-confidence-bar">
                            <div
                              className="facility-lab-room-confidence-fill"
                              style={{
                                width: `${Math.round(data.confidence * 100)}%`,
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <p className="facility-inspector-empty">
                          Confidence not yet established
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="facility-inspector-section facility-lab-room-section">
                    <h3 className="facility-inspector-section-title">
                      Knowledge References
                    </h3>
                    {data.knowledgeRefs.length === 0 ? (
                      <p className="facility-inspector-empty">
                        No knowledge linked
                      </p>
                    ) : (
                      <ul className="facility-inspector-list facility-lab-room-list">
                        {data.knowledgeRefs.slice(0, 10).map((ref) => (
                          <li
                            key={`${ref.domain}-${ref.id}`}
                            className="facility-inspector-list-item facility-lab-room-list-item"
                          >
                            <span>{ref.title}</span>
                            <span className="facility-inspector-meta">
                              {ref.domain}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="facility-inspector-section facility-lab-room-section facility-lab-room-timeline">
                    <h3 className="facility-inspector-section-title">
                      Activity Timeline
                    </h3>
                    <ExecutionTimeline items={data.timeline} />
                  </section>
                </>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
});
