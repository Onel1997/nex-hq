# Shopify Agent

Commerce operations — converts Design and Marketing reports into Shopify storefront drafts.

**Reports to:** CEO Agent

**Status:** Implemented

## Pipeline

`retrieve-context` → OpenAI → `parse-output` / `enrich-output` → `save` → simulated `operations`

## Knowledge sources

- Design reports (required)
- Marketing reports (required)
- CEO reports
- Research reports
- Brand context + product/storefront memory

## Future integration

`operations.ts` exposes `createProductDraft()`, `updateCollection()`, `publishProduct()` — currently simulated.
