# Milaene Brain

Permanent memory layer and single source of truth for Milaene HQ and HQ OS platforms.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              HQ OS Workspaces (multi-tenant)                 │
│   Fashion HQ · Agency HQ · Creator HQ · Ecommerce · SaaS    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Consumers (read / write)                  │
│   Agents · API Routes · Integrations · LangGraph Graphs     │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │      BrainClient        │  ← single interface
              │   BrainContextAssembler │
              │    BrainVectorStore     │
              └────────────┬────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │brain_records│  │brain_embed. │  │brain_events │
  │  (Supabase) │  │ (pgvector)  │  │ (audit log) │
  └─────────────┘  └─────────────┘  └─────────────┘
```

## Modular Domain System

Domains are split into two tiers:

| Tier | Loading | Purpose |
|------|---------|---------|
| **Core** | Always on | Universal across all industries |
| **Industry** | Per workspace | Loaded from industry pack at provisioning |

### Core Domains

| Domain | Purpose |
|--------|---------|
| `company_profile` | Company identity, industry, goals, KPIs, integrations, modules |
| `decisions` | Decision log with rationale |
| `tasks` | Work unit memory |
| `reports` | Agent report archive |

### Industry Packs

| Industry | Domains |
|----------|---------|
| **Fashion HQ** | brand_vision, brand_rules, design_memory, product_memory, content_memory, marketing_memory, competitor_intelligence |
| **Agency HQ** | client_memory, campaign_memory, content_memory, marketing_memory |
| **Creator HQ** | audience_memory, content_memory, marketing_memory |
| **Ecommerce HQ** | catalog_memory, storefront_memory, product_memory, marketing_memory, competitor_intelligence |
| **SaaS HQ** | product_roadmap, customer_memory, marketing_memory, competitor_intelligence |

Some domains (e.g. `content_memory`, `marketing_memory`) are shared across multiple industry packs.

## Workspace Provisioning

```
1. Create workspace with industryId (e.g. fashion_hq)
2. Resolve enabledDomains = core domains + industry pack domains
3. Write company_profile record with goals, KPIs, integrations, activeModules
4. Agents read/write scoped to workspaceId
```

## Access Rules

1. **Read** — agents call `BrainClient.read({ workspaceId })` or `BrainContextAssembler.assemble()`
2. **Write** — agents call `BrainClient.write()` with `status: draft` by default
3. **Approve** — humans or CEO promote records to `approved`
4. **Publish** — integrations pull only `approved` records via `BrainIntegrationHook`

## Module Layout

```
brain/
├── types.ts              # Core record, query, and write types
├── constants.ts          # Schema version, re-exports
├── platform/             # HQ OS — industries, modules, workspaces
├── registry/             # Domain tiers, registry, industry mapping
├── domains/              # Per-domain content schemas
├── interfaces/           # BrainClient, VectorStore, Integrations
├── context/              # Agent context assembly + LangGraph state
├── events/               # Audit event types
└── schema/               # Supabase table types (migrations deferred)
```

## Implementation Status

**Types and contracts only.** No client implementation, agent logic, or automation yet.
