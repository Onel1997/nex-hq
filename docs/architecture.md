# NexHQ — System Architecture

## Overview

NexHQ is a **Next.js 15** full-stack application backed by **Supabase** (database, auth, storage, realtime) and powered by **OpenAI** models. Future agent orchestration will use **LangGraph** for stateful, multi-step workflows.

The system is organized into five architectural layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Presentation Layer                           │
│              app/ · components/ · hooks/                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     Application Core                             │
│         lib/ — config, clients, constants, utilities             │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Agent Layer  │  │  Brain Layer    │  │ Work Management │
│   agents/     │  │    brain/       │  │ tasks/ reports/ │
└───────┬───────┘  └────────┬────────┘  └────────┬────────┘
        │                   │                     │
        └───────────────────┼─────────────────────┘
                            ▼
              ┌─────────────────────────┐
              │    Infrastructure       │
              │ Supabase · OpenAI ·     │
              │ LangGraph (future)      │
              └─────────────────────────┘
```

**Current implementation status:** UI shell, type system, and client scaffolding are in place. Agent logic, Brain persistence, and API routes are not yet implemented.

---

## Frontend Architecture

### Framework and Routing

| Technology | Role |
|------------|------|
| Next.js 15 (App Router) | Full-stack React, SSR, file-based routing |
| TypeScript | Type safety across UI and backend contracts |
| Tailwind CSS v4 | Utility-first styling |
| Shadcn UI + Base UI | Component primitives (buttons, cards, sidebar, etc.) |
| Lucide React | Icon system |

### Route Structure

```
app/
├── layout.tsx                    # Root layout
└── (dashboard)/
    ├── layout.tsx                # Dashboard shell (sidebar, header)
    ├── page.tsx                  # Command center dashboard
    ├── agents/page.tsx           # Agent team overview
    ├── brain/page.tsx            # Brain knowledge browser
    ├── tasks/page.tsx            # Task board
    ├── reports/page.tsx          # Report hub
    └── settings/page.tsx         # Integration and workspace settings
```

### Component Organization

```
components/
├── layout/           # App sidebar, dashboard shell, header
├── dashboard/        # Command center widgets (hero, AI team, intelligence feed)
├── agents/           # Agent cards and overview
├── brain/            # Brain knowledge system UI
├── tasks/            # Task board
├── reports/          # Report hub
├── settings/         # Settings panels
├── shared/           # Reusable panels, stat cards, empty states
└── ui/               # Shadcn primitives
```

### UI Data Strategy (Current)

The dashboard currently uses **mock data** from `lib/mock/` for development. Mock modules include:

- `dashboard.ts` — command center stats and activity
- `brain-knowledge.ts` — Brain section browser (UI-only, not wired to `brain/` types yet)
- `tasks.ts`, `reports.ts`, `command-center.ts` — work management previews

When Brain persistence is implemented, UI components will consume data through API routes or server actions that call `BrainClient`.

### Design Patterns

- **OsPanel** — shared panel component for consistent dashboard surfaces
- **PageHeader / SectionHeading** — standardized page chrome
- **AgentStatusBadge** — visual agent state indicators
- **EmptyState** — placeholder states for unimplemented features

---

## Brain Architecture

The Brain is the permanent memory layer. It is defined entirely in `brain/` as TypeScript types and contracts.

### Module Structure

```
brain/
├── types.ts              # Core record, query, write, search types
├── constants.ts          # Schema version, registry re-exports
├── platform/             # HQ OS — industries, modules, workspaces
├── registry/             # Domain tiers, full domain registry
├── domains/              # 18 typed content schemas
├── interfaces/           # BrainClient, VectorStore, Integration hooks
├── context/              # Agent context assembly, LangGraph state
├── events/               # Audit event types
└── schema/               # Supabase table type definitions
```

### Key Contracts

| Contract | Purpose |
|----------|---------|
| `BrainClient` | Single read/write interface for all consumers |
| `BrainContextAssembler` | Builds `BrainAgentContext` for agent execution |
| `BrainVectorStore` | Embedding generation and semantic search |
| `BrainIntegrationHook` | Inbound/outbound sync with external APIs |
| `BrainEventBus` | Audit trail and Realtime subscriptions |

### Domain Tiers

- **Core domains** — always on: `company_profile`, `decisions`, `tasks`, `reports`
- **Industry domains** — loaded per workspace industry pack (Fashion, Agency, Creator, Ecommerce, SaaS)

See [brain.md](./brain.md) for complete Brain documentation.

---

## Agent Architecture

Agents live in `agents/` with a shared type contract and per-agent directories (scaffolded, not implemented).

### Hierarchy

```
                    ┌─────────────┐
                    │  CEO Agent  │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │ Research │   │ Designer │   │ Content  │
     └──────────┘   └──────────┘   └──────────┘
           ▼               ▼
     ┌──────────┐   ┌──────────┐
     │Marketing │   │ Shopify  │
     └──────────┘   └──────────┘
```

### Agent Contract

Every agent implements the `Agent` interface:

```typescript
interface Agent {
  id: AgentId;
  name: string;
  run(context: AgentContext): Promise<AgentResult>;
}

interface AgentContext {
  task: Task;
  brainContext: BrainAgentContext;
}

interface AgentResult {
  report: Omit<AgentReport, "id" | "createdAt" | "updatedAt" | "status">;
}
```

### Agent Catalog

Agent definitions are centralized in `lib/constants/agents.ts` (`AGENT_CATALOG`). The UI reads from this catalog for agent cards, capabilities, and status badges.

See [agents.md](./agents.md) for per-agent documentation.

---

## Data Architecture

### Storage (Planned — Supabase Postgres)

| Table | Purpose |
|-------|---------|
| `brain_workspaces` | Multi-tenant workspace config (industry, modules, enabled domains) |
| `brain_records` | All Brain knowledge records |
| `brain_embeddings` | pgvector embeddings for semantic search |
| `brain_events` | Audit log for reads, writes, searches, syncs |
| `tasks` | Work units (future migration) |
| `reports` | Agent outputs (future migration) |

### Record Model

Every Brain record follows a universal shape:

```
BrainRecord
├── id, workspaceId
├── domain, slug, title, summary
├── content (domain-specific typed JSON)
├── status (draft | pending_review | approved | archived | superseded)
├── tags, relations
├── provenance (createdBy, updatedBy, sourceTaskId, confidence)
├── embedding metadata
├── version, schemaVersion
└── validFrom, validUntil, createdAt, updatedAt
```

### Security

- **Row Level Security (RLS)** on all Supabase tables
- **Service role key** — server-only, never exposed to browser
- **Publishable/anon keys** — client-side Supabase access only
- **Workspace scoping** — all Brain operations require `workspaceId`
- Secrets validated at startup via `lib/config/env.ts`

### Schema Versioning

Brain records carry `schemaVersion` (currently `1.1.0`). Domain content schemas version independently through the `kind` discriminator field on each content type.

---

## Context Architecture

Context flows from the Brain to agents through a structured assembly pipeline:

```
BrainClient.read({ workspaceId, domains })
        │
        ▼
BrainContextAssembler.assemble({ workspaceId, agentId, taskId })
        │
        ▼
BrainAgentContext
├── slices[]        # Per-domain record bundles with relevance scores
├── promptContext   # Flat text for LLM system prompt injection
├── tokenEstimate   # Budget tracking
└── sourceRecordIds # Provenance for write-back
        │
        ▼
AgentContext { task, brainContext }
        │
        ▼
Agent.run() → AgentResult → Report → Brain write-back
```

### LangGraph State (Future)

Agent graphs will include a `BrainGraphState` slice:

| Field | Purpose |
|-------|---------|
| `brainContext` | Pre-assembled context at graph entry |
| `pendingWrites` | Queued Brain writes flushed on completion |
| `queryLog` | Audit of all reads during execution |

`BrainGraphConfig` defines per-graph read/write domain authorization.

---

## Future LangGraph Orchestration

LangGraph (`@langchain/langgraph`) is installed but not wired. The planned orchestration model:

### CEO Graph

```
START → load_brain_context → plan → delegate_tasks → wait_for_reports
      → synthesize → escalate_if_needed → write_brain → END
```

### Specialist Graph (per agent)

```
START → load_brain_context → plan → execute → validate → submit_report
      → write_brain → END
```

### Key Properties

- **Stateful** — graphs checkpoint progress for long-running work
- **Conditional edges** — route based on task type, confidence, and errors
- **Parallel execution** — independent tasks run concurrently
- **Brain integration** — every node reads/writes through typed Brain contracts
- **Human interrupts** — approval gates pause graphs before external publishes

---

## Tech Stack Summary

| Layer | Technology | Status |
|-------|------------|--------|
| Framework | Next.js 15 (App Router) | ✅ Active |
| Language | TypeScript | ✅ Active |
| Styling | Tailwind CSS + Shadcn UI | ✅ Active |
| Database | Supabase (Postgres) | 🔧 Scaffolded |
| Auth | Supabase Auth | 🔧 Scaffolded |
| AI | OpenAI | 🔧 Client ready |
| Orchestration | LangGraph | 📋 Dependency installed |
| Vector Search | pgvector + OpenAI embeddings | 📋 Types defined |
| Storage | Supabase Storage | 📋 Planned |

---

## Directory Structure

```
nexhq/
├── app/                  # Next.js App Router pages
├── components/           # React components
├── hooks/                # Custom React hooks
├── lib/                  # Config, clients, constants, mocks, utils
├── agents/               # Agent modules and types
├── brain/                # Brain type system and contracts
├── tasks/                # Task types
├── reports/              # Report types
├── docs/                 # Architecture documentation (this folder)
└── middleware.ts         # Supabase session middleware
```

---

## API Design (Future)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agents/ceo/run` | POST | Execute CEO orchestration cycle |
| `/api/agents/[id]/run` | POST | Run a specific specialist agent |
| `/api/tasks` | GET, POST | List and create tasks |
| `/api/reports` | GET, POST | Fetch and submit reports |
| `/api/brain/query` | POST | Semantic search over Brain context |
| `/api/brain/records` | GET, POST, PATCH | CRUD for Brain records |

All routes will validate input with Zod and return typed responses.

---

## Deployment Target

| Component | Target |
|-----------|--------|
| Frontend + API | Vercel (or equivalent Next.js host) |
| Database + Auth | Supabase hosted project |
| Background jobs | Supabase Edge Functions or dedicated worker (TBD) |
| File storage | Supabase Storage |

### Environments

| Environment | Purpose |
|-------------|---------|
| `development` | Local Supabase or dev project |
| `staging` | Preview deployments, test agents |
| `production` | Live brand operations |

Environment variables drive all external service configuration. No hardcoded credentials.

---

## Related Documentation

- [Vision](./vision.md) — product vision and HQ OS platform
- [Brain](./brain.md) — Brain domains, flows, and contracts
- [Agents](./agents.md) — agent responsibilities and Brain interactions
- [Data Flow](./data-flow.md) — end-to-end system flow
- [Integrations](./integrations.md) — external service connections
- [Roadmap](./roadmap.md) — implementation phases
- [HQ OS Future](./hq-os-future.md) — multi-industry platform evolution
