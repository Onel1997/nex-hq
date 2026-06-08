# Milaene HQ — Integrations

## Overview

Integrations connect Milaene HQ to external services. Every integration reads from and writes to the **Milaene Brain** through typed `BrainIntegrationHook` contracts — never directly to agent logic or raw database tables.

```
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  OpenAI · Supabase · Shopify · Social · Email · Analytics  │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │  BrainIntegrationHook   │
              │  syncInbound()          │
              │  syncOutbound()       │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │     Milaene Brain       │
              │  (approved records)     │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │   Agents · UI · API     │
              └─────────────────────────┘
```

### Integration Directions

| Direction | Flow | Example |
|-----------|------|---------|
| **Inbound** | External API → Brain write | Instagram engagement data → `marketing_memory` |
| **Outbound** | Approved Brain record → External API | Approved product copy → Shopify listing |
| **Bidirectional** | Both directions | Shopify ↔ `product_memory` sync |

---

## Current Integration Status

| Integration | State | Detail |
|-------------|-------|--------|
| Supabase | Connected (if env configured) | Database, auth, storage scaffolding |
| OpenAI | Connected (if env configured) | API key detected, client initialized |
| LangGraph | Planned | Dependency installed, wiring in Phase 3 |
| Shopify | Planned | Phase 8 |
| Instagram | Planned | Marketing agent activation |
| TikTok | Planned | Research and marketing signals |
| Email | Planned | Campaign deployment |
| Analytics | Planned | KPI and performance tracking |

Status is determined at runtime by `lib/config/integration-status.ts` based on environment variable presence.

---

## OpenAI

### Role

Primary LLM provider for all agent inference and embedding generation.

### Direction

Bidirectional — generates content (outbound from Brain context) and embeddings (inbound to Brain vector store).

### Brain Domains

| Domain | Usage |
|--------|-------|
| `brand_vision` | Brand context for system prompts |
| `brand_rules` | Guardrails injected into agent prompts |
| `design_memory` | Visual direction context |
| `content_memory` | Copy generation and template matching |
| `competitor_intelligence` | Research synthesis |

### Integration Points

| Function | Usage |
|----------|-------|
| Chat Completions | Agent `run()` inference |
| Embeddings API | `BrainVectorStore.embed()` for semantic search |
| Function Calling | Agent tools (web search, Brain queries) |

### Configuration

```
OPENAI_API_KEY=sk-...          # Server-only
```

Client initialized in `lib/openai/client.ts`. Never exposed to browser.

### Future Considerations

- Model selection per agent (GPT-4o for CEO, GPT-4o-mini for specialists)
- Token budget management via `BrainAgentContext.tokenEstimate`
- Structured output via JSON mode for report artifacts

---

## Supabase

### Role

Primary infrastructure provider: database, authentication, storage, and realtime.

### Direction

Bidirectional — persists all Brain data and serves it back to agents and UI.

### Brain Tables

| Table | Purpose |
|-------|---------|
| `brain_workspaces` | Multi-tenant workspace configuration |
| `brain_records` | All Brain knowledge records |
| `brain_embeddings` | pgvector embeddings for semantic search |
| `brain_events` | Audit log |

### Additional Tables (Future)

| Table | Purpose |
|-------|---------|
| `tasks` | Operational task queue |
| `reports` | Agent report storage |
| `users` / `workspace_members` | Team access control |

### Integration Points

| Feature | Usage |
|---------|-------|
| Postgres | Brain record persistence |
| pgvector | Semantic search via `match_brain_embeddings` |
| Auth | Team login, session management, RLS |
| Storage | Design assets, report artifacts, exports |
| Realtime | Live dashboard updates from `brain_events` |

### Configuration

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # Server-only
```

Clients in `lib/supabase/client.ts` (browser), `server.ts` (SSR), `middleware.ts` (session).

### Security

- RLS enabled on all tables
- Service role key never exposed to browser
- Workspace-scoped queries via `workspace_id` filter
- `UPDATE` requires matching `SELECT` policy

---

## Shopify

### Role

Commerce operations — product listings, collections, inventory, and storefront management.

### Direction

Bidirectional — syncs product state between Brain and Shopify storefront.

### Brain Domains

| Domain | Direction | Data |
|--------|-----------|------|
| `product_memory` | Bidirectional | Products, SKUs, pricing, inventory |
| `content_memory` | Outbound | Approved product descriptions |
| `design_memory` | Outbound | Product images and visual assets |

### Integration Points

| API | Usage |
|-----|-------|
| Admin API — Products | Create/update listings from approved Brain records |
| Admin API — Collections | Organize products by drop/capsule |
| Admin API — Inventory | Sync stock levels inbound to Brain |
| Storefront API | Read-only health checks |

### Sync Flow

```
Inbound (Shopify → Brain):
  Shopify product update webhook
    → BrainIntegrationHook.syncInbound()
    → Brain write to product_memory (provenance: integration/shopify)

Outbound (Brain → Shopify):
  Human approves product_memory + content_memory records
    → BrainIntegrationHook.syncOutbound(recordIds)
    → Shopify Admin API create/update product
    → brain_event: integration.synced
```

### Configuration (Future)

```
SHOPIFY_STORE_DOMAIN=milaene.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=shpat_...    # Server-only
SHOPIFY_API_VERSION=2024-10
```

### Agent

Shopify Agent prepares listing drafts. Human approval required before any publish.

---

## Social Platforms

### Instagram

| Property | Value |
|----------|-------|
| Direction | Inbound (primary), Outbound (future) |
| Domains | `marketing_memory`, `competitor_intelligence`, `content_memory` |
| Data | Post performance, engagement rates, competitor activity |

**Inbound signals:** Save rate, reach, impressions → `marketing_memory` KPIs
**Future outbound:** Schedule approved `content_memory` posts

### TikTok

| Property | Value |
|----------|-------|
| Direction | Inbound |
| Domains | `marketing_memory`, `competitor_intelligence` |
| Data | Trend signals, culture movements, competitor content |

**Inbound signals:** Trending sounds, hashtags, competitor engagement → `competitor_intelligence` market signals

### Configuration (Future)

```
INSTAGRAM_ACCESS_TOKEN=...
TIKTOK_API_KEY=...
```

---

## Email Platforms

### Role

Deploy approved email campaigns to VIP lists and customer segments.

### Direction

Outbound — approved Brain content → email platform.

### Brain Domains

| Domain | Data |
|--------|------|
| `content_memory` | Email copy, subject lines, preview text |
| `marketing_memory` | Campaign timing, audience segments, send schedule |

### Integration Points

| Platform | Usage |
|----------|-------|
| Klaviyo / Mailchimp / Resend | Campaign deployment |
| Webhooks | Open/click rates inbound to `marketing_memory` KPIs |

### Sync Flow

```
Approved content_memory (email format) + marketing_memory (campaign)
    → BrainIntegrationHook.syncOutbound()
    → Email platform API create campaign
    → Schedule send per launch sequence
```

### Configuration (Future)

```
EMAIL_PROVIDER=klaviyo
EMAIL_API_KEY=...
```

---

## Analytics Platforms

### Role

Track KPIs, campaign performance, and commerce metrics. Feed results back to Brain.

### Direction

Inbound — analytics data → Brain KPI updates.

### Brain Domains

| Domain | Data |
|--------|------|
| `marketing_memory` | Campaign KPIs (open rate, CTR, ROAS) |
| `company_profile` | Company-level KPIs (revenue, sell-through) |
| `product_memory` | Product-level performance |
| `storefront_memory` | Conversion rates, page performance |

### Integration Points

| Platform | Usage |
|----------|-------|
| Google Analytics | Site traffic, conversion funnels |
| Shopify Analytics | Revenue, sell-through, cart data |
| Meta Ads Manager | Paid campaign performance |
| Custom dashboards | HQ OS analytics module |

### Configuration (Future)

```
GA_MEASUREMENT_ID=G-...
META_ADS_ACCESS_TOKEN=...
```

---

## Future APIs

The integration architecture is designed to accommodate additional services without changing core Brain contracts.

### Planned Integrations

| Integration | Direction | Domains | Purpose |
|-------------|-----------|---------|---------|
| Slack | Outbound | `reports`, `decisions` | Team notifications, approval requests |
| Linear | Bidirectional | `tasks`, `product_roadmap` | Issue tracking for SaaS HQ |
| Stripe | Inbound | `customer_memory`, `company_profile` | Revenue and subscription data |
| Google Drive | Bidirectional | `design_memory`, `content_memory` | Asset storage and collaboration |
| Notion | Inbound | `decisions`, `content_memory` | Import existing brand docs |
| Web scraping | Inbound | `competitor_intelligence` | Competitor monitoring for Research Agent |

### Adding a New Integration

1. Define `IntegrationId` in `brain/interfaces/integrations.ts`
2. Add entry to `BRAIN_INTEGRATION_REGISTRY` with direction and domains
3. Implement `BrainIntegrationHook` with `syncInbound()` and/or `syncOutbound()`
4. Register in Company Profile `integrations` array
5. Add environment variables to `lib/config/env.ts`
6. Wire to agent tools if needed

---

## Integration Registry

The Brain maintains a declarative registry of all integrations:

```typescript
BRAIN_INTEGRATION_REGISTRY = [
  { id: "openai",    direction: "bidirectional", domains: [...] },
  { id: "shopify",   direction: "bidirectional", domains: [...] },
  { id: "instagram", direction: "inbound",       domains: [...] },
  { id: "tiktok",    direction: "inbound",       domains: [...] },
  { id: "email",     direction: "outbound",      domains: [...] },
]
```

Company Profile stores which integrations are active per workspace:

```typescript
integrations: [
  { id: "shopify", name: "Shopify", status: "active" },
  { id: "openai", name: "OpenAI", status: "active" },
  { id: "instagram", name: "Instagram", status: "planned" },
]
```

---

## Security Principles

1. **API keys are server-only** — never in `NEXT_PUBLIC_` variables
2. **Outbound sync requires approved records** — no publishing drafts
3. **Inbound sync writes with integration provenance** — traceable to source
4. **Webhook endpoints authenticate** — verify signatures before Brain writes
5. **Rate limiting** — respect external API limits, queue sync operations
6. **Audit trail** — every sync emits `integration.synced` event

---

## Related Documentation

- [Brain](./brain.md) — Brain domains and integration hooks
- [Architecture](./architecture.md) — infrastructure layer
- [Data Flow](./data-flow.md) — how approved records reach external systems
- [Roadmap](./roadmap.md) — integration implementation phases
