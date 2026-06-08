# Milaene HQ — Roadmap

## Phase 0 — Foundation ✅ (current)

**Goal:** Establish project structure, documentation, and tooling before any business logic.

- [x] Next.js 15 + TypeScript + Tailwind + Shadcn UI
- [x] Supabase and OpenAI client scaffolding
- [x] LangGraph dependency (orchestration-ready, not wired)
- [x] Directory structure: `agents/`, `brain/`, `tasks/`, `reports/`
- [x] Architecture and agent documentation
- [x] Command center UI shell (no agent logic)
- [ ] Supabase project provisioning and schema migrations
- [ ] Environment setup guide for team onboarding

---

## Phase 1 — Milaene Brain

**Goal:** Single source of truth for brand context.

- [ ] Supabase schema: brand profile, products, drops, campaigns
- [ ] Brain read/write interface (`brain/`)
- [ ] RLS policies for team access
- [ ] Seed data for Milaene brand identity
- [ ] Admin UI to view and edit Brain entries

**Exit criteria:** Any module can query and persist brand context through the Brain API.

---

## Phase 2 — Task & Report System

**Goal:** Structured work units and agent outputs.

- [ ] Task schema: status, assignee, priority, payload, parent task
- [ ] Report schema: agent ID, task ID, summary, artifacts, confidence
- [ ] Task queue UI in command center
- [ ] Report review UI with approve / reject / revise flows

**Exit criteria:** Humans can create tasks manually; agents can submit reports (stubbed).

---

## Phase 3 — CEO Agent

**Goal:** Master orchestrator that delegates and synthesizes.

- [ ] CEO Agent LangGraph graph (plan → delegate → synthesize)
- [ ] Task creation from natural-language goals
- [ ] Specialist routing logic (which agent handles which task type)
- [ ] CEO dashboard: active goals, pending reports, escalations

**Exit criteria:** CEO Agent decomposes a human goal into tasks and routes them (specialists can be stubs).

---

## Phase 4 — Specialist Agents (incremental)

**Goal:** Domain agents that execute real work.

| Agent | Key deliverable | Dependency |
|-------|-----------------|------------|
| Research | Trend brief from web/social signals | Brain, OpenAI |
| Content | Drop copy, product descriptions | Brain, brand voice |
| Designer | Concept boards and asset drafts | Brain, Storage |
| Marketing | Campaign plan and channel brief | Brain, Content |
| Shopify | Product listing drafts | Brain, Shopify API |

Each agent ships independently after CEO routing is live.

**Exit criteria:** At least one specialist produces a reviewable report end-to-end.

---

## Phase 5 — Approvals & Execution

**Goal:** Close the loop from draft to production.

- [ ] Human approval gates for high-impact actions
- [ ] Approved content → Brain → Shopify publish pipeline
- [ ] Audit log of all agent actions and approvals
- [ ] Rollback / revision workflows

**Exit criteria:** An approved drop copy flows from Content Agent to live Shopify listing.

---

## Phase 6 — Automation & Intelligence

**Goal:** Proactive, compounding brand operations.

- [ ] Scheduled agent runs (trend scans, inventory checks)
- [ ] Vector search over Brain for semantic context retrieval
- [ ] Realtime command center updates (Supabase Realtime)
- [ ] Performance analytics: agent output quality, time saved
- [ ] Multi-drop planning and scenario modeling

**Exit criteria:** Milaene HQ runs recurring workflows without manual task creation.

---

## Principles Across All Phases

1. **Ship vertical slices** — one agent end-to-end before building all agents in parallel
2. **Human approval by default** — automation earns trust over time
3. **Brain first** — never let agents bypass shared context
4. **Document as you build** — update `docs/` when architecture changes
5. **Test with real brand work** — validate against actual Milaene drops, not synthetic demos

---

## Open Questions

- Shopify API scope: read-only first, or write from day one?
- Design Agent output format: image generation API vs. structured briefs for human designers?
- Team size: single operator vs. multi-user roles (designer, marketer, founder)?
- Hosting for long-running LangGraph jobs: Edge Functions vs. dedicated worker?

These will be resolved before Phase 4.
