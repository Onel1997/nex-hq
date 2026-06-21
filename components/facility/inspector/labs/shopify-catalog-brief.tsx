"use client";

import {
  mapShopifyCatalogIntelligence,
  type ShopifyIntelligence,
} from "@/lib/facility/lab-intelligence";
import { memo, useMemo } from "react";
import { IntelList, IntelSubsection } from "./intel-primitives";
import { useShopifyCatalog } from "./use-shopify-catalog";

export type ShopifyCatalogBriefVariant =
  | "shopify"
  | "ceo"
  | "designer"
  | "marketing";

interface ShopifyCatalogBriefProps {
  open: boolean;
  variant: ShopifyCatalogBriefVariant;
}

function renderShopifyOverview(intel: ShopifyIntelligence) {
  return (
    <>
      <div className="facility-intel-highlight">
        <span className="facility-intel-highlight-label">Live Catalog</span>
        <span className="facility-intel-highlight-value">
          {intel.productCount} products · {intel.categories.length} categories ·{" "}
          {intel.collections.length} collections
        </span>
      </div>

      <IntelSubsection label="Inventory">
        <p className="facility-inspector-text">
          Active: {intel.inventory.activeProducts} · In stock:{" "}
          {intel.inventory.inStock} · Out of stock: {intel.inventory.outOfStock} ·
          Low stock: {intel.inventory.lowStock} · Total units:{" "}
          {intel.inventory.totalInventory}
        </p>
      </IntelSubsection>

      {intel.priceBands.length > 0 ? (
        <IntelSubsection label="Price Ranges">
          <ul className="facility-intel-list">
            {intel.priceBands.map((band) => (
              <li key={band.label} className="facility-intel-list-item">
                {band.label}: {band.range}
                <span className="facility-inspector-meta">
                  {band.productCount} products
                </span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}

      {intel.categories.length > 0 ? (
        <IntelSubsection label="Categories">
          <IntelList items={intel.categories} />
        </IntelSubsection>
      ) : null}

      {intel.collections.length > 0 ? (
        <IntelSubsection label="Collections">
          <IntelList items={intel.collections} limit={8} />
        </IntelSubsection>
      ) : null}

      {intel.latestProducts.length > 0 ? (
        <IntelSubsection label="Latest Products">
          <ul className="facility-intel-list">
            {intel.latestProducts.map((product) => (
              <li key={product.title} className="facility-intel-list-item">
                {product.title}
                <span className="facility-inspector-meta">
                  {product.price} {product.currency} · {product.productType}
                </span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}
    </>
  );
}

function renderCeoOverview(intel: ShopifyIntelligence) {
  return (
    <>
      <div className="facility-intel-highlight">
        <span className="facility-intel-highlight-label">Business Overview</span>
        <span className="facility-intel-highlight-value">
          {intel.productCount} products across {intel.categories.length} categories
        </span>
      </div>

      {intel.collections.length > 0 ? (
        <IntelSubsection label="Collections">
          <IntelList items={intel.collections} limit={6} />
        </IntelSubsection>
      ) : null}

      {intel.categoryGaps.length > 0 ? (
        <IntelSubsection label="Catalog Gaps">
          <IntelList items={intel.categoryGaps} />
        </IntelSubsection>
      ) : null}

      {intel.bestsellerCandidates.length > 0 ? (
        <IntelSubsection label="Top Inventory">
          <ul className="facility-intel-list">
            {intel.bestsellerCandidates.slice(0, 5).map((product) => (
              <li key={product.title} className="facility-intel-list-item">
                {product.title}
                <span className="facility-inspector-meta">
                  {product.inventory} units
                </span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}
    </>
  );
}

function renderDesignerOverview(intel: ShopifyIntelligence) {
  return (
    <>
      {intel.colors.length > 0 ? (
        <IntelSubsection label="Available Colors">
          <IntelList items={intel.colors} />
        </IntelSubsection>
      ) : null}

      {intel.materials.length > 0 ? (
        <IntelSubsection label="Available Materials">
          <IntelList items={intel.materials} />
        </IntelSubsection>
      ) : null}

      {intel.categories.length > 0 ? (
        <IntelSubsection label="Product Categories">
          <IntelList items={intel.categories} />
        </IntelSubsection>
      ) : null}
    </>
  );
}

function renderMarketingOverview(intel: ShopifyIntelligence) {
  return (
    <>
      <div className="facility-intel-highlight">
        <span className="facility-intel-highlight-label">Catalog Focus</span>
        <span className="facility-intel-highlight-value">
          {intel.inventory.activeProducts} active · {intel.inventory.inStock} in
          stock
        </span>
      </div>

      {intel.bestsellerCandidates.length > 0 ? (
        <IntelSubsection label="Focus Products">
          <ul className="facility-intel-list">
            {intel.bestsellerCandidates.slice(0, 6).map((product) => (
              <li key={product.title} className="facility-intel-list-item">
                {product.title}
                <span className="facility-inspector-meta">
                  {product.collections.join(", ") || product.productType}
                </span>
              </li>
            ))}
          </ul>
        </IntelSubsection>
      ) : null}

      {intel.collections.length > 0 ? (
        <IntelSubsection label="Active Collections">
          <IntelList items={intel.collections} limit={6} />
        </IntelSubsection>
      ) : null}
    </>
  );
}

export const ShopifyCatalogBrief = memo(function ShopifyCatalogBrief({
  open,
  variant,
}: ShopifyCatalogBriefProps) {
  const { productKnowledge, loading, error } = useShopifyCatalog(open);

  const intel = useMemo(
    () => mapShopifyCatalogIntelligence(productKnowledge),
    [productKnowledge],
  );

  if (loading) {
    return <p className="facility-inspector-empty">Loading Shopify catalog…</p>;
  }

  if (error) {
    return <p className="facility-inspector-error">{error}</p>;
  }

  if (!intel) {
    return (
      <p className="facility-inspector-empty">
        No live Shopify catalog — configure store credentials to enable product
        knowledge.
      </p>
    );
  }

  return (
    <div className="facility-intel-panel facility-intel-panel-compact">
      {variant === "shopify" ? renderShopifyOverview(intel) : null}
      {variant === "ceo" ? renderCeoOverview(intel) : null}
      {variant === "designer" ? renderDesignerOverview(intel) : null}
      {variant === "marketing" ? renderMarketingOverview(intel) : null}
    </div>
  );
});
