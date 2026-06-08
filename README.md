# Milaene HQ

AI-powered command center for the Milaene streetwear brand.

## Stack

- **Next.js 15** — App Router, TypeScript
- **Tailwind CSS + Shadcn UI** — styling and components
- **Supabase** — database, auth, storage (scaffolded)
- **OpenAI** — LLM inference (scaffolded)
- **LangGraph** — future agent orchestration (dependency installed)

## Getting Started

```bash
cp .env.example .env.local
# Fill in Supabase and OpenAI credentials

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
app/           Next.js pages and API routes
components/    UI, layout, and domain components
lib/           Config, Supabase, OpenAI clients
agents/        Agent modules (CEO + specialists)
brain/         Shared Milaene Brain knowledge layer
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
| [docs/roadmap.md](docs/roadmap.md) | Phased implementation plan |

## Status

**Phase 0 — Foundation.** No agents or automation implemented yet.
