# Shopify Agent — Milaene Commerce Intelligence

**Reports to:** CEO Agent  
**Status:** Implemented — canonical production baseline  
**Route:** `/agents/shopify`

## Production UI

The Shopify Operations page is the **Milaene Commerce Intelligence System** — the permanent production brain for Milaene commerce. It is catalog-first: product cards, filters, AI commerce panel, MarketPrint intelligence, historical sales, and activity feed.

This UI must never be replaced by KPI dashboard shells. See [docs/milaene-commerce-intelligence.md](../../docs/milaene-commerce-intelligence.md).

## Pipeline

`retrieve-context` → OpenAI → `parse-output` / `enrich-output` → `save` → simulated `operations`

## Intelligence layer

| Layer | Module |
|-------|--------|
| Baseline loader | `lib/commerce/milaene-commerce-baseline.ts` |
| Operations API | `/api/shopify/operations` |
| Department API | `/api/commerce/intelligence` |
| Insights builder | `lib/shopify/operations.ts` |
| Historical sales | `lib/commerce/historical-intelligence.ts` |
| MarketPrint | `lib/marketprint/` |

## Department consumption

- **CEO Command** — commerce signals via `formatCeoCommerceSignals()`
- **Design Studio** — product intelligence via Design Studio API + baseline
- **Marketing Center** — campaign products via `formatMarketingCommerceSignals()`
- **Image Studio** — production info via `formatImageCommerceSignals()`
- **Commerce Lab** — sales/inventory via `/api/commerce/lab`

## Knowledge sources

- Design reports (required)
- Marketing reports (required)
- CEO reports
- Research reports
- Brand context + product/storefront memory
- Live Shopify catalog + historical order data

## Future integration

`operations.ts` exposes `createProductDraft()`, `updateCollection()`, `publishProduct()` — currently simulated.
