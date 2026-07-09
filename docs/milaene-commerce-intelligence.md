# Milaene Commerce Intelligence System

**Status:** Canonical baseline — permanent production UI  
**Route:** `/agents/shopify`  
**Component:** `ShopifyOperationsCommerce`

This document establishes the Shopify Operations experience as the official commerce intelligence baseline for NexHQ. This is not a temporary UI. It is the production brain of Milaene.

## What this system is

The Milaene Commerce Intelligence System is a **catalog-first operations surface** that combines live Shopify data, historical sales, supplier intelligence, and AI recommendations into one permanent workspace.

It must **never** be replaced by KPI dashboard shells (e.g. `ShopifyOperationsHq` / Department HQ metrics views).

## Required capabilities

| Capability | Component | Data source |
|------------|-----------|-------------|
| Product catalog cards | `ShopifyProductGrid` / `ShopifyProductCard` | Shopify Admin API |
| Product images | `ShopifyProductCard` | Shopify product media |
| Collection sidebar | `ShopifyFilterPanel` | Catalog collections |
| Category filters | `ShopifyFilterPanel` | Product types |
| AI Commerce panel | `ShopifyAiPanel` | `buildCommerceInsights()` |
| Activity feed | `ShopifyActivityFeed` | `buildActivityFeed()` |
| MarketPrint supplier intelligence | `ShopifyMarketPrintPanel` | `buildMarketPrintIntelligence()` |
| Commerce recommendations | `ShopifyAiPanel` insights | Operations + historical |
| Product tags | `ShopifyProductCard` / filters | Shopify tags |
| Historical sales integration | `ShopifyHistoricalPanel` | CSV import / orders API |
| Supplier signals | Product status badges + insights | POD supplier rules |
| Restock warnings | Commerce insights (`supplier` kind) | Inventory + supplier status |
| Campaign recommendations | MarketPrint + insights | Campaign-ready scoring |
| Bestseller analysis | Historical panel + insights | Order rollup / CSV |

## Architecture

```
Shopify Admin API + CSV history
         │
         ▼
loadMilaeneCommerceBaseline()     ← lib/commerce/milaene-commerce-baseline.ts
         │
         ├── /api/shopify/operations  → ShopifyOperationsCommerce UI
         ├── /api/commerce/intelligence  → Department consumption
         └── /api/commerce/lab  → Commerce Lab analytics
```

## Department integration

All future department work **consumes** this intelligence layer. It does not replace it.

| Department | Receives | Integration |
|------------|----------|-------------|
| **CEO Command** | Commerce signals, bestsellers, supplier checks | `formatCeoCommerceSignals()` in `agents/ceo/retrieve-context.ts` |
| **Design Studio** | Product intelligence, category gaps, MarketPrint fit | `formatDesignCommerceSignals()` + Design Studio API |
| **Marketing Center** | Campaign products, revenue leaders | `formatMarketingCommerceSignals()` in `agents/marketing/retrieve-context.ts` |
| **Image Studio** | Production info, embroidery targets, missing images | `formatImageCommerceSignals()` in `agents/image/retrieve-context.ts` |
| **Commerce Lab** | Sales and inventory signals | `formatCommerceLabSignals()` + `/api/commerce/lab` |

### API consumption

```http
GET /api/commerce/intelligence
GET /api/commerce/intelligence?department=ceo
GET /api/commerce/intelligence?department=design
GET /api/commerce/intelligence?department=marketing
GET /api/commerce/intelligence?department=image
GET /api/commerce/intelligence?department=commerce-lab
```

## Deprecated patterns

- **`ShopifyOperationsHq`** — KPI dashboard shell. Marked `@deprecated`. Do not mount as default.
- **Alternate catalog-only views** that bypass the operations intelligence stack.
- **Department HQ metric grids** as the primary commerce surface.

## Files of record

| File | Role |
|------|------|
| `components/shopify/shopify-operations-center.tsx` | Page shell |
| `components/shopify/shopify-operations-commerce.tsx` | Canonical UI layout |
| `lib/commerce/milaene-commerce-baseline.ts` | Server intelligence loader |
| `lib/commerce/department-signals.ts` | Department signal formatters |
| `lib/shopify/operations.ts` | Insights, activity, KPI builders |
| `app/shopify-operations.css` | Production styling |

## Governance

1. New commerce features extend `ShopifyOperationsCommerce` or the baseline loader.
2. Facility labs and inspector panels link **into** this system, not around it.
3. Agent pipelines pull commerce context via `loadMilaeneCommerceBaseline()` or department formatters.
4. Commerce Lab remains the analytics wing — it reads the same baseline, it does not replace the catalog UI.
