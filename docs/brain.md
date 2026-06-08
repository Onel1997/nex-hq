# NexHQ Brain — Architecture

## Purpose

The Brain is the **permanent memory layer** of NexHQ — scoped per workspace, shared across all agents and integrations. It is the single source of truth that every agent, integration, and workflow reads from and writes back to.

The Brain is **not an agent**. It is the knowledge substrate beneath the agent layer.

```
┌─────────────────────────────────────────────────────────────┐
│              NexHQ Workspaces (multi-tenant)                 │
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

**Current status:** Types and contracts only. No client implementation, database migrations, or runtime logic.

---

## Modular Domain System

Domains are organized into two tiers:

| Tier | Loading | Scope |
|------|---------|-------|
| **Core** | Always on, every workspace | Universal across all industries |
| **Industry** | Loaded at workspace provisioning | Specific to an industry pack |

A workspace's **enabled domains** = core domains + its industry pack's domains.

### Core Domains

| Domain ID | Title | Responsibility |
|-----------|-------|----------------|
| `company_profile` | Company Profile | Workspace identity: company name, industry, business model, target audience, goals, KPIs, integrations, active modules |
| `decisions` | Decisions | Decision log with rationale, alternatives considered, owners, and outcomes |
| `tasks` | Tasks | Work unit memory — delegation history, status snapshots, task context |
| `reports` | Reports | Agent report archive linked to tasks — structured outputs for review |

### Industry Domains — Fashion HQ

| Domain ID | Title | Responsibility |
|-----------|-------|----------------|
| `brand_vision` | Brand Vision | North star, positioning, cultural identity, audience segments |
| `brand_rules` | Brand Rules | Voice, copy, naming, and compliance guardrails |
| `design_memory` | Design Memory | Visual system, palettes, typography, silhouettes, approved assets |
| `product_memory` | Product Memory | Products, drops, capsules, SKUs, commerce metadata |
| `content_memory` | Content Memory | Copy templates, narratives, channel formats, editorial assets |
| `marketing_memory` | Marketing Memory | Campaigns, calendars, channel mix, KPIs, growth playbooks |
| `competitor_intelligence` | Competitor Intelligence | Competitive landscape, watchlist, differentiation, market signals |

### Industry Domains — Agency HQ

| Domain ID | Title | Responsibility |
|-----------|-------|----------------|
| `client_memory` | Client Memory | Client profiles, contacts, scope of work, relationship history |
| `campaign_memory` | Campaign Memory | Agency campaign briefs, deliverables, budgets, timelines |
| `content_memory` | Content Memory | Shared — copy and editorial assets |
| `marketing_memory` | Marketing Memory | Shared — campaign and growth playbooks |

### Industry Domains — Creator HQ

| Domain ID | Title | Responsibility |
|-----------|-------|----------------|
| `audience_memory` | Audience Memory | Creator audience segments, platforms, engagement profiles |
| `content_memory` | Content Memory | Shared — copy and editorial assets |
| `marketing_memory` | Marketing Memory | Shared — campaign and growth playbooks |

### Industry Domains — Ecommerce HQ

| Domain ID | Title | Responsibility |
|-----------|-------|----------------|
| `catalog_memory` | Catalog Memory | Product catalog, variants, pricing, inventory metadata |
| `storefront_memory` | Storefront Memory | Store configuration, pages, theme, conversion health |
| `product_memory` | Product Memory | Shared — product and commerce metadata |
| `marketing_memory` | Marketing Memory | Shared — campaign and growth playbooks |
| `competitor_intelligence` | Competitor Intelligence | Shared — competitive landscape |

### Industry Domains — SaaS HQ

| Domain ID | Title | Responsibility |
|-----------|-------|----------------|
| `product_roadmap` | Product Roadmap | Feature roadmap, release cadence, prioritization |
| `customer_memory` | Customer Memory | Customer segments, ICP, health signals, feature requests |
| `marketing_memory` | Marketing Memory | Shared — campaign and growth playbooks |
| `competitor_intelligence` | Competitor Intelligence | Shared — competitive landscape |

Some domains (e.g. `content_memory`, `marketing_memory`, `competitor_intelligence`) are **shared across multiple industry packs**. The domain registry tracks which industries load each domain.

---

## Domain Responsibilities in Detail

### Company Profile

The workspace bootstrap record. Every HQ OS workspace has exactly one canonical company profile.

**Stores:**
- Company name
- Industry (`fashion_hq`, `agency_hq`, etc.)
- Business model
- Target audience
- Goals (array)
- KPIs (name, target, current, period)
- Integrations (id, name, status)
- Active modules (brain, agents, commerce, etc.)

**Primary writers:** Human, CEO Agent
**Vector search:** Disabled (structured config, not semantic content)

### Decisions

Institutional memory for strategic and operational choices.

**Stores:** Question, rationale, alternatives (with pros/cons), status, owner, outcome, links to related tasks and reports.

**Lifecycle:** `proposed` → `approved` / `rejected` / `deferred` → `superseded`

### Tasks

Snapshots of work units stored in Brain for orchestration context. Complements the operational `tasks/` module with memory-layer persistence.

**Stores:** Task ID, title, description, status, priority, assignee, creator, parent task, payload, context record IDs loaded at creation.

### Reports

Snapshots of agent reports archived in Brain for long-term retrieval and cross-agent context.

**Stores:** Report ID, task ID, agent ID, status, summary, artifacts, confidence, key findings.

### Fashion-Specific Domains

| Domain | Key Content Fields |
|--------|-------------------|
| Brand Vision | mission, vision, positioning, pillars, voiceTone, audienceSegments |
| Brand Rules | rules (category, severity, examples), globalConstraints |
| Design Memory | colorPalette, typography, silhouettes, graphicTreatment, assets |
| Product Memory | name, status, SKUs, drop info, Shopify IDs |
| Content Memory | format, channel, blocks, narrativeArc, copyRules |
| Marketing Memory | campaign name, status, channelMix, KPIs, launchSequence |
| Competitor Intelligence | competitor profiles, marketSignals, competitiveEdge |

---

## Read / Write Flows

### Read Flow

```
Consumer (agent, API, integration)
        │
        ▼
BrainClient.read({ workspaceId, domains?, status?, tags?, limit? })
        │
        ▼
Postgres query on brain_records
  WHERE workspace_id = ?
  AND domain IN (?)
  AND status IN (?)
        │
        ▼
BrainReadResult { records[], total?, hasMore? }
```

### Context Assembly Flow (Agents)

```
Agent receives Task
        │
        ▼
BrainContextAssembler.assemble({
  workspaceId,
  agentId,
  taskId,
  domains?,        // defaults to agent's primary read domains
  focusQuery?,     // semantic relevance ranking
  maxTokens?
})
        │
        ▼
BrainAgentContext {
  slices[],         // per-domain record bundles
  promptContext,    // flat text for LLM injection
  tokenEstimate,
  sourceRecordIds
}
        │
        ▼
Injected into AgentContext.brainContext
```

### Write Flow

```
Agent or integration produces output
        │
        ▼
BrainClient.write({
  workspaceId,
  domain,
  title,
  content,          // typed domain content
  status: "draft",  // default for agent writes
  provenance: { createdBy: { type: "agent", id: "content" } }
})
        │
        ▼
Insert into brain_records
        │
        ▼
Publish brain_event: record.created
        │
        ▼
BrainWriteResult { record, eventId }
```

### Approval Flow

```
draft → pending_review → approved
                              │
                              ▼
              Integration syncOutbound(approved recordIds)
                              │
                              ▼
              External system (Shopify, email, etc.)
```

### Semantic Search Flow (Future)

```
BrainClient.search({ workspaceId, query, domains?, minScore? })
        │
        ▼
OpenAI embed(query) → vector
        │
        ▼
match_brain_embeddings(filter_workspace_id, query_embedding)
        │
        ▼
BrainSearchResult[] { record, score, matchedChunk? }
```

---

## Versioning

### Record Versioning

Every Brain record carries:

| Field | Purpose |
|-------|---------|
| `version` | Incrementing integer, bumped on each update |
| `schemaVersion` | Brain-wide schema version (currently `1.1.0`) |
| `validFrom` / `validUntil` | Temporal validity for time-scoped knowledge |

Updates use optimistic versioning — the client checks `version` before applying patches.

### Content Schema Versioning

Each domain content type includes a `kind` discriminator (e.g. `kind: "brand_vision"`). Breaking content changes bump `schemaVersion` and may require migration scripts.

### Supersession

When a record is replaced by a newer version:
1. Old record status → `superseded`
2. New record includes a `supersedes` relation pointing to the old record
3. Both records remain in the database for audit

---

## Provenance

Every Brain write requires provenance metadata:

```typescript
interface BrainProvenance {
  createdBy: BrainActor;    // { type: "human" | "agent" | "integration" | "system", id }
  updatedBy: BrainActor;
  sourceTaskId?: string;      // task that triggered this write
  sourceReportId?: string;    // report that produced this content
  sourceIntegration?: string; // integration that synced this data
  confidence?: number;        // 0–1 for AI-generated content
}
```

### Actor Types

| Type | Example ID |
|------|-----------|
| `human` | User UUID |
| `agent` | `ceo`, `research`, `content`, etc. |
| `integration` | `shopify`, `instagram`, `openai` |
| `system` | `provisioning`, `migration`, `scheduler` |

Provenance enables:
- Accountability — who created or changed every record
- Lineage — trace agent outputs back to tasks and reports
- Confidence filtering — surface low-confidence AI outputs for review

---

## Audit Events

All Brain operations emit typed events to `brain_events`:

| Event Type | Trigger |
|------------|---------|
| `record.created` | New Brain record written |
| `record.updated` | Record patched |
| `record.archived` | Record soft-deleted |
| `record.superseded` | Record replaced by newer version |
| `record.embedded` | Vector embedding indexed |
| `context.assembled` | Agent context package built |
| `search.performed` | Semantic search executed |
| `integration.synced` | External system sync completed |

Events support:
- **Audit log** — full history of Brain mutations
- **Realtime UI** — Supabase Realtime subscriptions for live dashboard updates
- **Agent accountability** — query log tracks what context each agent read

The `BrainEventBus` contract defines `publish()` and `subscribe()` for event distribution.

---

## Vector Search Preparation

### Architecture

```
Brain record (text content)
        │
        ▼
BrainVectorStore.embed(text)  →  OpenAI text-embedding-3-small
        │
        ▼
brain_embeddings table  →  pgvector HNSW index
        │
        ▼
match_brain_embeddings(filter_workspace_id, query_embedding)
```

### Configuration

| Setting | Value |
|---------|-------|
| Default model | `text-embedding-3-small` |
| Dimensions | 1536 |
| Index type | HNSW (cosine similarity) |

### Eligible Domains

Vector search is enabled per domain in the registry. Disabled for structured config domains (`company_profile`, `tasks`). Enabled for knowledge-heavy domains (brand vision, content, competitors, etc.).

### Chunking

Large records may be split into chunks. Each chunk gets its own embedding row with `chunk_index` and `parent_record_id` for reassembly.

---

## Cross-Domain Relations

Records can link to other records across domains:

| Relation Type | Use Case |
|---------------|----------|
| `references` | General cross-reference |
| `derived_from` | Output derived from source material |
| `supersedes` | New version replaces old |
| `related_to` | Loosely associated records |
| `blocks` | Dependency blocker |
| `fulfills` | Task or requirement fulfillment |

---

## Access Rules

1. **Read** — all consumers call `BrainClient.read({ workspaceId })` or `BrainContextAssembler.assemble()`. Direct Supabase table access is forbidden outside Brain implementation.
2. **Write** — agent writes default to `status: "draft"`. Integrations write with `sourceIntegration` provenance.
3. **Approve** — humans or CEO Agent promote records to `approved`.
4. **Publish** — integrations pull only `approved` records via `BrainIntegrationHook.syncOutbound()`.
5. **Scope** — all operations require `workspaceId` for multi-tenant isolation.

---

## Module Layout

```
brain/
├── types.ts              # Core record, query, write, search types
├── constants.ts          # Schema version, registry re-exports
├── platform/
│   ├── industries.ts     # HQ industry packs and domain lists
│   ├── modules.ts        # Toggleable HQ OS modules
│   └── workspace.ts      # Multi-tenant workspace types
├── registry/
│   ├── tiers.ts          # BRAIN_CORE_DOMAINS, BRAIN_INDUSTRY_DOMAINS
│   └── domain-registry.ts # Full metadata per domain
├── domains/              # 18 typed content schema files
├── interfaces/
│   ├── client.ts         # BrainClient contract
│   ├── vector.ts         # BrainVectorStore contract
│   └── integrations.ts   # BrainIntegrationHook contract
├── context/
│   ├── assembly.ts       # BrainContextAssembler, BrainAgentContext
│   └── langgraph.ts      # BrainGraphState for LangGraph
├── events/
│   └── types.ts          # BrainEvent types and BrainEventBus
└── schema/
    └── database.ts       # Supabase table type definitions
```

---

## Related Documentation

- [Architecture](./architecture.md) — system-wide architecture
- [Agents](./agents.md) — how agents interact with the Brain
- [Data Flow](./data-flow.md) — end-to-end flow through the Brain
- [Integrations](./integrations.md) — external sync with Brain domains
- [HQ OS Future](./hq-os-future.md) — multi-industry Brain evolution
