"use client";

import { MILAENE_PROFILE } from "@/lib/business/business-profile";
import { getFacilitySupplierSections } from "@/lib/business/supplier-intelligence";
import { getFacilityMarketPrintSections } from "@/lib/marketprint/production-rules";
import type { AgentId } from "@/lib/constants/agents";
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
  | "marketing"
  | "image";

interface ShopifyCatalogBriefProps {
  open: boolean;
  variant: ShopifyCatalogBriefVariant;
}

const FACILITY_SUPPLIER_SECTIONS = getFacilitySupplierSections(MILAENE_PROFILE);
const FACILITY_MARKETPRINT_SECTIONS = getFacilityMarketPrintSections();

function renderMarketPrintSections(variant: ShopifyCatalogBriefVariant) {
  const agentId = variant as AgentId;
  const sections = FACILITY_MARKETPRINT_SECTIONS[agentId];
  if (!sections?.length) return null;

  return sections.map((section) => (
    <IntelSubsection key={section.title} label={section.title}>
      <ul className="facility-intel-list">
        {section.lines.map((line) => (
          <li key={line} className="facility-intel-list-item">
            {line}
          </li>
        ))}
      </ul>
    </IntelSubsection>
  ));
}

function renderSupplierSections(variant: ShopifyCatalogBriefVariant) {
  const sections = FACILITY_SUPPLIER_SECTIONS[variant];
  if (!sections?.length) return null;

  return sections.map((section) => (
    <IntelSubsection key={section.title} label={section.title}>
      <ul className="facility-intel-list">
        {section.lines.map((line) => (
          <li key={line} className="facility-intel-list-item">
            {line}
          </li>
        ))}
      </ul>
    </IntelSubsection>
  ));
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

      {renderSupplierSections("shopify")}
      {renderMarketPrintSections("shopify")}

      <IntelSubsection label="Supplier Availability">
        <p className="facility-inspector-text">
          Active: {intel.inventory.activeProducts} · Available:{" "}
          {intel.inventory.inStock} · Supplier Unavailable:{" "}
          {intel.inventory.outOfStock} · Supplier Status: {intel.inventory.lowStock}
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

      {renderSupplierSections("ceo")}
      {renderMarketPrintSections("ceo")}

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
        <IntelSubsection label="Top Performers">
          <ul className="facility-intel-list">
            {intel.bestsellerCandidates.slice(0, 5).map((product) => (
              <li key={product.title} className="facility-intel-list-item">
                {product.title}
                <span className="facility-inspector-meta">
                  {product.inventory} virtual units
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
      {renderMarketPrintSections("designer")}

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
      {renderSupplierSections("marketing")}
      {renderMarketPrintSections("marketing")}

      <div className="facility-intel-highlight">
        <span className="facility-intel-highlight-label">Catalog Focus</span>
        <span className="facility-intel-highlight-value">
          {intel.inventory.activeProducts} active · {intel.inventory.inStock} available
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

function renderImageOverview() {
  return <>{renderMarketPrintSections("image")}</>;
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

  if (!intel && variant !== "image") {
    return (
      <p className="facility-inspector-empty">
        No live Shopify catalog — configure store credentials to enable product
        knowledge.
      </p>
    );
  }

  return (
    <div className="facility-intel-panel facility-intel-panel-compact">
      {variant === "shopify" && intel ? renderShopifyOverview(intel) : null}
      {variant === "ceo" && intel ? renderCeoOverview(intel) : null}
      {variant === "designer" && intel ? renderDesignerOverview(intel) : null}
      {variant === "marketing" && intel ? renderMarketingOverview(intel) : null}
      {variant === "image" ? renderImageOverview() : null}
    </div>
  );
});
