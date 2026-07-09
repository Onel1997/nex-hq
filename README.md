# NexHQ

AI-powered operating system for multi-workspace companies.

NexHQ is the platform. Each workspace (Milaene, NexTrends, NexAgency, and future tenants) gets its own industry pack, Brain scope, and seed configuration. The platform never hardcodes a specific workspace — the active tenant is resolved from environment configuration.

## Architecture

```
NexHQ Platform
├── Workspaces (tenant-scoped)
│   ├── milaene      (fashion_hq)
│   ├── nex-trends   (creator_hq)
│   ├── nex-agency   (agency_hq)
│   └── future …
└── Shared: Brain, CEO Agent, tasks, reports
```

## Stack

- **Next.js 15** — App Router, TypeScript
- **Tailwind CSS + Shadcn UI** — styling and components
- **Supabase** — database, auth, storage
- **OpenAI** — LLM inference
- **LangGraph** — future agent orchestration (dependency installed)

## Getting Started

```bash
cp .env.example .env.local
# Set NEXHQ_WORKSPACE_SLUG and NEXT_PUBLIC_NEXHQ_WORKSPACE_SLUG to your workspace slug
# Fill in Supabase and OpenAI credentials

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Workspace configuration

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXHQ_WORKSPACE_SLUG` | Server | Active workspace slug for API routes and seeding |
| `NEXT_PUBLIC_NEXHQ_WORKSPACE_SLUG` | Client | Active workspace slug for UI labels and context |

Available slugs: `milaene`, `nex-trends`, `nex-agency` (see `brain/workspaces/registry.ts`).

## Project Structure

```
app/           Next.js pages and API routes
components/    UI, layout, and domain components
lib/           Config, Supabase, OpenAI, i18n, workspace resolution
agents/        Agent modules (CEO + specialists)
brain/         NexHQ Brain — platform memory layer
  workspaces/  Per-workspace configs and seed data
tasks/         Task system types and handlers
reports/       Agent report types and aggregation
docs/          Vision, architecture, agents, roadmap
```

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/vision.md](docs/vision.md) | Mission and principles |
| [docs/architecture.md](docs/architecture.md) | System design and data flow |
| [docs/agents.md](docs/agents.md) | Agent hierarchy and responsibilities |
| [docs/brain.md](docs/brain.md) | Brain architecture and domains |
| [docs/roadmap.md](docs/roadmap.md) | Phased implementation plan |

## Status

**Phase 1 — Foundation.** CEO Agent advisory mode, Brain persistence, workspace-scoped seeding.
