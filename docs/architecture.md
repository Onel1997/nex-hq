# Milaene HQ — Architecture

## System Overview

Milaene HQ is a **Next.js 15** application backed by **Supabase** (database, auth, storage, realtime) and powered by **OpenAI** models. Future agent orchestration will use **LangGraph** for stateful, multi-step workflows.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Milaene HQ (Next.js)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   App UI    │  │  API Routes  │  │  Server Actions / Jobs   │ │
│  └──────┬──────┘  └──────┬───────┘  └───────────┬────────────┘ │
└─────────┼────────────────┼──────────────────────┼───────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────┐ ┌─────────────┐    ┌──────────────────────────┐
│    Supabase     │ │   OpenAI    │    │   LangGraph (future)     │
│  DB · Auth ·    │ │   Models    │    │   Agent orchestration    │
│  Storage · RT   │ │             │    │                          │
└────────┬────────┘ └─────────────┘    └──────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Milaene Brain (shared)                     │
│         Brand · Products · Audience · History · Context         │
└─────────────────────────────────────────────────────────────────┘
         ▲
         │ read / write
┌────────┴────────────────────────────────────────────────────────┐
│                         Agent Layer                             │
│                    ┌──────────────┐                             │
│                    │  CEO Agent   │  ← master orchestrator      │
│                    └──────┬───────┘                             │
│         ┌─────────┬───────┼───────┬─────────┐                   │
│         ▼         ▼       ▼       ▼         ▼                   │
│    Research  Designer Content Marketing Shopify                   │
└─────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Presentation (`app/`, `components/`)

- Command center UI: dashboards, agent status, task queues, report review
- Human approval flows for agent outputs
- Real-time updates via Supabase Realtime (future)

### Application Core (`lib/`)

- Environment configuration and validation
- Supabase client factories (browser, server, middleware)
- OpenAI client initialization
- Shared utilities and constants

### Agent Layer (`agents/`)

- One directory per agent with isolated prompts, tools, and schemas
- CEO Agent coordinates delegation; specialists do domain work
- **Not implemented yet** — structure and types only

### Knowledge Layer (`brain/`)

- Shared brand context accessible to all agents
- Abstraction over Supabase tables and vector search (future)
- Single interface so agents never bypass the Brain

### Work Management (`tasks/`, `reports/`)

- **Tasks**: work units created by CEO or humans, assigned to agents
- **Reports**: structured outputs agents submit back to CEO and humans

## Data Flow

1. Human sets a goal in the command center UI
2. CEO Agent decomposes the goal into tasks
3. Tasks are assigned to specialist agents
4. Agents read context from Milaene Brain, execute work, write results
5. Agents submit reports; CEO Agent synthesizes and surfaces for approval
6. Approved outputs trigger downstream actions (e.g., Shopify publish)

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 15 (App Router) | Full-stack React, SSR, API routes |
| Language | TypeScript | Type safety across agents and UI |
| Styling | Tailwind CSS + Shadcn UI | Design system and components |
| Database | Supabase (Postgres) | Persistent storage, RLS |
| Auth | Supabase Auth | Team access to command center |
| AI | OpenAI | LLM inference for agents |
| Orchestration | LangGraph (planned) | Multi-agent state machines |
| Storage | Supabase Storage | Assets, designs, exports |

## Security Model

- **Row Level Security (RLS)** on all Supabase tables in exposed schemas
- **Service role key** server-only; never exposed to the browser
- **Publishable/anon keys** for client-side Supabase access only
- Agent API routes authenticate via session; no unauthenticated agent execution
- Secrets validated at startup via `lib/config/env.ts`

## Scalability Considerations

### Horizontal Agent Scaling

Each agent is a self-contained module. New agents add a directory under `agents/` and register in the agent catalog. LangGraph graphs can run agents in parallel where tasks are independent.

### Brain as Cache + Source of Truth

Hot context (active drop, current campaigns) lives in Postgres with optional vector embeddings for semantic retrieval. Agents query the Brain interface, not raw tables.

### Async Task Processing

Long-running agent work (research sweeps, batch content generation) will move to background jobs. Task status tracked in `tasks` tables; UI subscribes via Realtime.

### Multi-Environment

- `development` — local Supabase or dev project
- `staging` — preview deployments, test agents
- `production` — live brand operations

Environment variables drive all external service configuration. No hardcoded credentials.

## Directory Structure

```
milaene-hq/
├── app/                  # Next.js App Router pages and API routes
├── components/           # React components (ui/, layout/, domain/)
├── lib/                  # Shared utilities, clients, config
├── agents/               # Agent modules (one folder per agent)
│   ├── ceo/
│   ├── research/
│   ├── designer/
│   ├── content/
│   ├── marketing/
│   └── shopify/
├── brain/                # Milaene Brain — shared knowledge layer
├── tasks/                # Task definitions, schemas, handlers
├── reports/              # Report schemas and aggregation
└── docs/                 # Architecture and product documentation
```

## API Design (Future)

| Route | Purpose |
|-------|---------|
| `POST /api/agents/ceo/run` | Execute CEO orchestration cycle |
| `POST /api/agents/[id]/run` | Run a specific specialist agent |
| `GET /api/tasks` | List and filter tasks |
| `GET /api/reports` | Fetch agent reports |
| `POST /api/brain/query` | Semantic search over brand context |

All routes will validate input with Zod and return typed responses.

## Deployment Target

- **Frontend + API**: Vercel (or equivalent Next.js host)
- **Database + Auth**: Supabase hosted project
- **Background jobs**: Supabase Edge Functions or dedicated worker (TBD)
