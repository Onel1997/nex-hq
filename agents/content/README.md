# Content Agent

Publish-ready copy for Milaene — landing pages, product descriptions, email, social and SMS.

**Reports to:** CEO Agent

**Status:** Implemented

## Pipeline

`retrieve-context` → OpenAI → `parse-output` / `enrich-output` → `save` → simulated `operations`

## Knowledge sources (all required)

- CEO reports
- Design reports
- Marketing reports
- Shopify reports
- Brand context + content memory

## Future integration

`operations.ts` exposes `publishToShopify()`, `publishToKlaviyo()`, `publishToInstagram()` — currently simulated.
