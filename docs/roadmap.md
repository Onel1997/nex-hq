# Milaene HQ — Roadmap

## Overview

This roadmap defines the implementation phases from foundation to HQ OS platform. Each phase builds on the previous one. Phases are designed to ship vertical slices — one complete capability at a time — rather than building all layers in parallel.

**Current position:** Phase 0 complete. Phase 1 in progress (Brain types defined, persistence not yet implemented).

---

## Phase 0 — Foundation ✅

**Goal:** Establish project structure, documentation, tooling, and UI shell.

### Deliverables

- [x] Next.js 15 + TypeScript + Tailwind CSS v4 + Shadcn UI
- [x] Supabase client scaffolding (browser, server, middleware)
- [x] OpenAI client initialization
- [x] LangGraph dependency installed (not wired)
- [x] Directory structure: `agents/`, `brain/`, `tasks/`, `reports/`
- [x] Brain type system — 18 domain schemas, registry, platform types
- [x] Agent catalog and shared contracts
- [x] Task and report type definitions
- [x] Command center UI shell (dashboard, agents, brain, tasks, reports, settings)
- [x] Mock data for UI development
- [x] Architecture documentation (`docs/`)

### Remaining

- [ ] Supabase project provisioning and environment setup guide
- [ ] Team onboarding documentation

### Exit Criteria

✅ A developer can clone the repo, understand the architecture from docs, and run the UI locally.

---

## Phase 1 — Brain

**Goal:** Single source of truth for brand context — persisted and queryable.

### Deliverables

- [ ] Supabase migrations: `brain_workspaces`, `brain_records`, `brain_embeddings`, `brain_events`
- [ ] pgvector extension and `match_brain_embeddings` function
- [ ] RLS policies for workspace-scoped access
- [ ] `BrainClient` implementation (read, write, update, search, archive)
- [ ] `BrainContextAssembler` implementation
- [ ] Seed data: Milaene company profile, brand vision, brand rules, design memory
- [ ] Brain API routes (`/api/brain/records`, `/api/brain/query`)
- [ ] Wire Brain UI to real data (replace mock)

### Exit Criteria

Any module can query and persist brand context through the Brain API. Brain UI shows live data.

---

## Phase 2 — Dashboard

**Goal:** Operational command center with task and report management.

### Deliverables

- [ ] Task schema migration and CRUD API
- [ ] Report schema migration and CRUD API
- [ ] Task queue UI — create, assign, filter, status transitions
- [ ] Report review UI — view artifacts, approve, reject, request revision
- [ ] Dashboard widgets wired to real task/report counts
- [ ] Command center AI interface (goal input → stored as task)
- [ ] Supabase Realtime subscriptions for live updates

### Exit Criteria

Humans can create tasks manually, view task status, and review reports. Dashboard reflects live operational data.

---

## Phase 3 — CEO Agent

**Goal:** Master orchestrator that decomposes goals and routes work.

### Deliverables

- [ ] CEO Agent LangGraph graph (plan → delegate → synthesize)
- [ ] Natural-language goal → structured task decomposition
- [ ] Specialist routing logic (task type → agent ID)
- [ ] Brain context loading at graph entry
- [ ] Task creation from CEO decomposition
- [ ] Report synthesis across specialist outputs
- [ ] Escalation detection and human surfacing
- [ ] CEO API route (`POST /api/agents/ceo/run`)
- [ ] CEO dashboard: active goals, pending reports, escalations

### Exit Criteria

CEO Agent decomposes a human goal into tasks, routes them to specialists (which can be stubs), and synthesizes results.

---

## Phase 4 — Research Agent

**Goal:** Market and culture intelligence for streetwear.

### Deliverables

- [ ] Research Agent LangGraph graph
- [ ] Trend scanning capability (web search tool)
- [ ] Competitor analysis from Brain context + external signals
- [ ] Trend brief report generation
- [ ] Brain write: `competitor_intelligence` drafts
- [ ] Research API route (`POST /api/agents/research/run`)

### Exit Criteria

Research Agent produces a reviewable trend brief end-to-end: task in → Brain read → report out → Brain write.

---

## Phase 5 — Designer Agent

**Goal:** Visual design support aligned to brand guidelines.

### Deliverables

- [ ] Designer Agent LangGraph graph
- [ ] Mood board and palette generation
- [ ] Design concept briefs from Brain design rules
- [ ] Asset reference management (Supabase Storage)
- [ ] Brain write: `design_memory` drafts
- [ ] Designer API route (`POST /api/agents/designer/run`)

### Exit Criteria

Designer Agent produces a reviewable design direction package grounded in Brain brand rules.

---

## Phase 6 — Content Agent

**Goal:** Brand voice copy across all channels.

### Deliverables

- [ ] Content Agent LangGraph graph
- [ ] Product description generation
- [ ] Drop announcement copy (multi-channel)
- [ ] Social caption variants
- [ ] Email and SMS draft generation
- [ ] Brand voice enforcement via Brain `brand_rules`
- [ ] Brain write: `content_memory` drafts
- [ ] Content API route (`POST /api/agents/content/run`)

### Exit Criteria

Content Agent produces on-brand copy for a product/drop that passes human review.

---

## Phase 7 — Marketing Agent

**Goal:** Campaign planning and growth strategy.

### Deliverables

- [ ] Marketing Agent LangGraph graph
- [ ] Campaign calendar generation
- [ ] Channel mix optimization
- [ ] Launch sequence planning
- [ ] Ad copy brief generation
- [ ] KPI definition per campaign
- [ ] Brain write: `marketing_memory` drafts
- [ ] Marketing API route (`POST /api/agents/marketing/run`)

### Exit Criteria

Marketing Agent produces a complete campaign plan for a drop, coordinated with research and content outputs.

---

## Phase 8 — Shopify Agent

**Goal:** Commerce operations and storefront sync.

### Deliverables

- [ ] Shopify Agent LangGraph graph
- [ ] Shopify API integration (Admin API)
- [ ] Product listing draft generation from approved Brain content
- [ ] Collection management
- [ ] Inventory sync (inbound to Brain)
- [ ] Storefront health monitoring
- [ ] Human-gated publish pipeline
- [ ] Brain write: `product_memory` drafts
- [ ] Shopify API route (`POST /api/agents/shopify/run`)

### Exit Criteria

An approved drop copy and product data flows from Brain to a live Shopify listing with human approval.

---

## Phase 9 — Automation

**Goal:** Proactive, compounding brand operations.

### Deliverables

- [ ] Scheduled agent runs (trend scans, inventory checks, KPI updates)
- [ ] Vector search over Brain for semantic context retrieval
- [ ] Background job infrastructure (Edge Functions or worker)
- [ ] Realtime command center (live agent status, task progress)
- [ ] Performance analytics: agent output quality, time saved
- [ ] Multi-drop planning and scenario modeling
- [ ] Automated escalation rules
- [ ] Integration sync scheduling (Shopify, social, email)

### Exit Criteria

Milaene HQ runs recurring workflows without manual task creation. Knowledge compounds across drops.

---

## Phase 10 — HQ OS

**Goal:** Multi-industry platform with shared Brain infrastructure.

### Deliverables

- [ ] Workspace provisioning API (create workspace, select industry pack)
- [ ] Industry pack domain loading (Agency, Creator, Ecommerce, SaaS)
- [ ] Multi-tenant RLS and workspace isolation
- [ ] Company Profile UI for workspace configuration
- [ ] Industry-specific agent catalogs (configurable per workspace)
- [ ] Module toggling (enable/disable commerce, design studio, etc.)
- [ ] Agency HQ: Client Memory, Campaign Memory domains live
- [ ] Creator HQ: Audience Memory domain live
- [ ] Ecommerce HQ: Catalog Memory, Storefront Memory domains live
- [ ] SaaS HQ: Product Roadmap, Customer Memory domains live
- [ ] White-label command center (workspace branding)
- [ ] Platform admin dashboard

### Exit Criteria

A new company can provision a workspace, select an industry, and operate with industry-appropriate Brain domains and agents.

---

## Phase Dependencies

```
Phase 0 (Foundation) ✅
    │
    ▼
Phase 1 (Brain) ──────────────────────────┐
    │                                      │
    ▼                                      │
Phase 2 (Dashboard)                        │
    │                                      │
    ▼                                      │
Phase 3 (CEO Agent)                        │
    │                                      │
    ├──→ Phase 4 (Research)                │
    ├──→ Phase 5 (Designer)                │
    ├──→ Phase 6 (Content)                 │
    ├──→ Phase 7 (Marketing)               │
    └──→ Phase 8 (Shopify)                  │
                │                          │
                ▼                          │
         Phase 9 (Automation) ←────────────┘
                │
                ▼
         Phase 10 (HQ OS)
```

Phases 4–8 can partially overlap after Phase 3 is complete. Each specialist agent ships independently.

---

## Principles Across All Phases

1. **Ship vertical slices** — one agent end-to-end before building all agents in parallel
2. **Human approval by default** — automation earns trust over time
3. **Brain first** — never let agents or integrations bypass shared context
4. **Document as you build** — update `docs/` when architecture changes
5. **Test with real brand work** — validate against actual Milaene drops, not synthetic demos
6. **Types before logic** — define contracts before implementations

---

## Open Questions

| Question | Impact | Resolve By |
|----------|--------|------------|
| Shopify API scope: read-only first or write from day one? | Phase 8 risk | Phase 7 |
| Design Agent output: image generation vs. structured briefs? | Phase 5 scope | Phase 4 |
| Team size: single operator vs. multi-user roles? | RLS design | Phase 1 |
| LangGraph hosting: Edge Functions vs. dedicated worker? | Phase 9 infra | Phase 3 |
| HQ OS pricing model: per workspace vs. per module? | Phase 10 business | Phase 9 |

---

## Related Documentation

- [Vision](./vision.md) — long-term product vision
- [Architecture](./architecture.md) — current system architecture
- [HQ OS Future](./hq-os-future.md) — platform evolution details
- [Brain](./brain.md) — Brain implementation reference
