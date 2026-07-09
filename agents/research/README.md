# Research Agent

Das strategische Gehirn von Milaene — sammelt echte Commerce-Daten, analysiert Trends und Wettbewerber, und leitet Design Briefs für Design Studio ab.

## Intelligence Pipeline

```
External Connectors (Google, Reddit, Pinterest, TikTok, Etsy, Amazon)
         +
Commerce (Shopify, MarketPrint, Sales)
         +
Competitor Scanner
         ↓
   signalAggregator
   (Social · Trend · Commerce · Competitor · Consumer)
         ↓
   Research Brain
         ↓
   Opportunity Engine (6-dimension scoring)
         ↓
   Design Brief Engine
         ↓
   Design Studio
```

## External Connectors (`services/connectors/`)

| Connector | Status | Env Key |
|-----------|--------|---------|
| Google Trends | ready | `GOOGLE_TRENDS_API_KEY` (SerpAPI) |
| Reddit | ready | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` |
| Pinterest | ready | `PINTEREST_ACCESS_TOKEN` |
| TikTok | ready | `TIKTOK_API_KEY` |
| Etsy | ready | `ETSY_API_KEY` |
| Amazon | ready | `AMAZON_API_KEY` |

Without API keys, connectors run in `simulated` mode with Milaene-relevant streetwear intelligence.

## Opportunity Scoring

Each opportunity includes:
- **Demand Score** — Google Trends + Commerce + Consumer
- **Social Score** — Reddit, Pinterest, TikTok
- **Trend Score** — Trend engine + DNA alignment
- **Competition Score** — Competitor watchlist inverse
- **DNA Match** — Milaene brand DNA alignment
- **Estimated Potential** — Weighted composite

Plus **decisions**: products, colors, audience, collection, designs, priority.

## Intelligence Services

| Service | Datenquelle |
|---------|-------------|
| `researchEngine` | Orchestrator — Shopify, MarketPrint, Brain |
| `productAnalyzer` | Bestseller, Schwächen, Chancen, POD |
| `trendScanner` + `trendIntelligence` | Farben, Silhouetten, Materialien, Saisons |
| `competitorScanner` | Corteiz, Represent, FoG, Essentials, Cole Buxton |
| `opportunityEngine` | Ranked capsules mit Confidence |
| `designBriefEngine` | Research → Design Studio Handoff |
| `knowledgeEngine` | Brain Reports & Insights |

## Design Studio Handoff

- Jeder Report enthält `designBrief` in `researchSections`
- Tag: `design-brief-handoff`
- API: `GET /api/research/design-brief`
- Design Agent lädt Brief automatisch via `retrieveDesignKnowledge()`
- Design Studio prefilled Brief on load

## APIs

- `POST /api/research/run` — Report + Design Brief generieren
- `GET /api/research/intelligence` — Live Intelligence Snapshot
- `GET /api/research/design-brief` — Latest Design Brief für Studio
