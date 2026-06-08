# NexHQ — Vision

## Mission

NexHQ is an AI-powered operating system for multi-workspace companies. It unifies research, design, content, marketing, and commerce into a single platform — giving small teams the strategic reach of a full creative and growth organization.

NexHQ is not a chatbot. It is a **command center**: a persistent intelligence layer where humans set direction, specialized AI agents execute domain work, and a shared Brain keeps every decision coherent across workspaces.

---

## What We Are Building Today

### NexHQ Platform — Multi-Workspace by Design

NexHQ is the platform. Workspaces (Milaene, NexTrends, NexAgency, and future tenants) are tenant-scoped configurations with industry packs and seed data. The platform resolves the active workspace from environment configuration — it never assumes a specific tenant.

Today, NexHQ includes:

- A **Next.js command center UI** — dashboard, agents, Brain, tasks, reports, and settings
- A **typed architecture layer** — Brain, agents, tasks, and reports defined in TypeScript
- **Client scaffolding** for Supabase, OpenAI, and LangGraph
- **Mock data** for UI development while backend systems are built

No agent logic or Brain persistence is live yet. The foundation — types, contracts, documentation, and UI shell — is in place.

### Multi-Workspace Architecture

NexHQ supports multiple workspaces, each with its own industry pack and seed configuration:

```
NexHQ
├── milaene      (fashion_hq)
├── nex-trends   (creator_hq)
├── nex-agency   (agency_hq)
└── future …
```

Each workspace provisions:

- A scoped **NexHQ Brain** memory layer
- A **CEO Agent** orchestration model
- **Industry-specific domain packs** (Fashion, Agency, Creator, Ecommerce, SaaS)
- **Toggleable modules** (agents, commerce, design studio, analytics, etc.)

```
┌─────────────────────────────────────────────────────────────┐
│                         NexHQ Platform                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Fashion  │ │  Agency  │ │ Creator  │ │Ecommerce │  ...  │
│  │    HQ    │ │    HQ    │ │    HQ    │ │    HQ    │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       └────────────┴────────────┴────────────┘              │
│                         │                                    │
│              ┌──────────▼──────────┐                          │
│              │    Shared Brain     │                          │
│              │  (multi-tenant)     │                          │
│              └─────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. One Brain, Many Agents

All agents and integrations share the **NexHQ Brain** — the permanent memory layer, scoped per workspace. The Brain stores company identity, domain knowledge, agent outputs, decisions, and operational context. Every consumer reads from and writes back to the Brain through typed interfaces. No agent bypasses it.

### 2. CEO-Led Hierarchy

The **CEO Agent** is the master orchestrator. It receives goals from humans, decomposes them into tasks, routes work to specialist agents, synthesizes their reports, and escalates when human judgment is required. Specialist agents do not coordinate directly with each other.

### 3. Human-in-the-Loop by Design

Automation accelerates work; humans approve what matters. High-stakes outputs — product launches, paid campaigns, inventory changes, external publishes — require explicit approval before execution.

### 4. Industry-Native Intelligence

Each workspace selects an industry pack that shapes its domains and modules — Fashion HQ for streetwear (drop cadence, scarcity, visual identity), Agency HQ for client and campaign memory, Creator HQ for audience and content intelligence, and more.

### 5. Compounding Knowledge

Every agent run, human decision, and integration sync adds to the Brain. Context compounds over time. Season two should be faster and more coherent than season one.

---

## Shared Brain Architecture

The Brain is not an agent. It is the **knowledge substrate** beneath every agent, integration, and workflow.

| Property | Description |
|----------|-------------|
| **Single source of truth** | All context lives in one system |
| **Multi-tenant** | Each workspace (company) has isolated records |
| **Modular domains** | Core domains (universal) + industry domains (per pack) |
| **Typed content** | Every domain has a defined content schema |
| **Provenance** | Every write tracks who created it and why |
| **Lifecycle** | Draft → review → approved → archived |
| **Vector-ready** | Semantic search via pgvector + OpenAI embeddings |

See [brain.md](./brain.md) for full Brain documentation.

---

## CEO Agent Model

The CEO Agent is the strategic layer between humans and specialists.

```
Human Goal
    │
    ▼
┌─────────────┐
│  CEO Agent  │  ← decompose, prioritize, route, synthesize
└──────┬──────┘
       │
   ┌───┴───┬───────┬───────┬───────┐
   ▼       ▼       ▼       ▼       ▼
Research Designer Content Marketing Shopify
   │       │       │       │       │
   └───────┴───────┴───────┴───────┘
                   │
            ┌──────▼──────┐
            │ NexHQ Brain │
            └─────────────┘
```

The CEO Agent:

- Translates natural-language goals into structured tasks
- Selects the right specialist for each task
- Reads Brain context to maintain brand coherence
- Reviews specialist reports and surfaces them for human approval
- Writes decisions and orchestration state back to the Brain

---

## Industry-Specific HQ Modules

HQ OS supports multiple industry packs. Each pack loads a distinct set of Brain domains and available platform modules.

| Industry Pack | Primary Use Case | Key Domains |
|---------------|------------------|-------------|
| **Fashion HQ** | Apparel, streetwear, lifestyle | Design Memory, Product Memory, Brand Vision |
| **Agency HQ** | Creative and marketing agencies | Client Memory, Campaign Memory |
| **Creator HQ** | Influencers, personal brands | Audience Memory, Content Memory |
| **Ecommerce HQ** | DTC and multi-channel retail | Catalog Memory, Storefront Memory |
| **SaaS HQ** | Software and subscription products | Product Roadmap, Customer Memory |

Core domains (Company Profile, Decisions, Tasks, Reports) are shared across all industries.

See [hq-os-future.md](./hq-os-future.md) for the full platform evolution plan.

---

## Success Metrics

| Horizon | Target |
|---------|--------|
| **Near-term** | Agents produce usable drafts (briefs, copy, designs) that reduce manual work by 50%+ |
| **Mid-term** | End-to-end drop workflows — from trend signal to Shopify listing — run with minimal human touchpoints |
| **Long-term** | NexHQ workspaces operate as persistent brand intelligence layers that compound knowledge every season |
| **Platform** | HQ OS supports multiple industries with shared Brain infrastructure and industry-specific domain packs |

---

## Non-Goals (Current Phase)

- Fully autonomous brand operation without human oversight
- Replacing creative judgment with generated output
- Building agent runtime logic before Brain persistence is live
- Supporting multiple industries in the UI before Fashion HQ is complete

---

## North Star

> *Run a world-class streetwear brand with the clarity of a command center and the speed of an AI-native team — then extend that model to every industry that runs on knowledge, decisions, and execution.*
