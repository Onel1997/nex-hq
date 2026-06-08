# Milaene HQ — Agent System

## Overview

Milaene HQ operates as a **hierarchical multi-agent system**. Every specialist agent reports to the CEO Agent. Every agent — including the CEO — reads from and writes to the shared **Milaene Brain**.

Agents do **not** communicate directly with each other. All coordination flows through the CEO Agent and the Brain. This keeps the system auditable and prevents conflicting directives.

```
                    ┌─────────────┐
                    │  CEO Agent  │
                    │  (master)   │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           │               │               │
     ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
     │ Research  │   │ Designer  │   │  Content  │
     └───────────┘   └───────────┘   └───────────┘
           │               │               │
     ┌─────▼─────┐   ┌─────▼─────┐         │
     │ Marketing │   │  Shopify  │         │
     └───────────┘   └───────────┘         │
           │               │               │
           └───────────────┴───────────────┘
                           │
                    ┌──────▼──────┐
                    │Milaene Brain│
                    │  (shared)   │
                    └─────────────┘
```

**Current status:** Agent types and catalog are defined. No agent implementations exist. CEO Agent is marked `active` in the catalog (orchestration shell planned); all specialists are `planned`.

---

## Shared Agent Contract

Every agent implements the same interface defined in `agents/types.ts`:

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

### Standard Execution Pattern

1. Receive a `Task` with description and payload
2. Read pre-assembled `BrainAgentContext` (domain slices, prompt text)
3. Execute domain work using LLM + tools
4. Return an `AgentResult` with structured report (summary, artifacts, confidence)
5. Write outputs back to Brain as drafts
6. Submit report for CEO review

---

## Communication Model

| Pattern | Description |
|---------|-------------|
| **Delegation** | CEO creates a task → assigns to one specialist |
| **Report-back** | Specialist completes task → submits structured report to CEO |
| **Brain read** | Any agent queries Brain for context before acting |
| **Brain write** | Agent persists draft output to Brain for review |
| **Escalation** | Agent flags uncertainty → CEO surfaces to human |

---

## CEO Agent

| Property | Value |
|----------|-------|
| **ID** | `ceo` |
| **Role** | Master Orchestrator |
| **Reports to** | Human |
| **Status** | Active (shell — no runtime yet) |

### Responsibilities

- Receive goals from humans via the command center
- Decompose goals into discrete tasks for specialist agents
- Prioritize work based on brand calendar, inventory, and campaign deadlines
- Route tasks to the correct specialist based on task type
- Review and synthesize specialist reports
- Escalate decisions that require human approval
- Maintain cross-agent coherence (design aligns with marketing narrative)
- Write orchestration decisions to the Brain

### Inputs

| Input | Source |
|-------|--------|
| Human goal | Command center UI (natural language) |
| Task queue | Tasks module (pending, in-progress) |
| Specialist reports | Reports module (submitted, awaiting review) |
| Brain context | All domains — company profile, brand vision, active campaigns, recent decisions |

### Outputs

| Output | Destination |
|--------|-------------|
| Tasks | Tasks module + Brain `tasks` domain |
| Synthesized briefs | Brain `decisions` domain |
| Escalation flags | Command center UI |
| Approval recommendations | Reports module (approve/reject/revise) |

### Brain Interactions

| Operation | Domains |
|-----------|---------|
| **Read** | All enabled domains for the workspace |
| **Write** | `decisions`, `tasks`, `reports` |
| **Approve** | Can promote records from `pending_review` → `approved` |

---

## Research Agent

| Property | Value |
|----------|-------|
| **ID** | `research` |
| **Role** | Market Intelligence |
| **Reports to** | CEO Agent |
| **Status** | Planned |

### Responsibilities

- Monitor streetwear trends, competitor drops, and cultural signals
- Produce trend briefs and opportunity assessments
- Feed competitive intelligence into the Brain
- Support drop timing and positioning decisions
- Recommend actions based on market gaps

### Inputs

| Input | Source |
|-------|--------|
| Task | CEO-delegated research brief (topic, scope, deadline) |
| Brain context | `brand_vision`, `competitor_intelligence`, `marketing_memory`, `company_profile` |
| External signals | Web, social platforms (future integrations) |

### Outputs

| Output | Destination |
|--------|-------------|
| Trend brief | Report artifact (markdown) |
| Competitor update | Brain `competitor_intelligence` domain (draft) |
| Market signals | Brain `competitor_intelligence` domain (draft) |
| Recommendations | Report summary with confidence score |

### Brain Interactions

| Operation | Domains |
|-----------|---------|
| **Read** | `brand_vision`, `competitor_intelligence`, `marketing_memory`, `company_profile` |
| **Write** | `competitor_intelligence`, `reports` |

---

## Designer Agent

| Property | Value |
|----------|-------|
| **ID** | `designer` |
| **Role** | Visual Design |
| **Reports to** | CEO Agent |
| **Status** | Planned |

### Responsibilities

- Generate design concepts aligned with Milaene brand guidelines
- Produce mood boards, color palettes, and layout directions
- Prepare assets for review before production
- Maintain design history in the Brain
- Enforce design rules from Brain on all outputs

### Inputs

| Input | Source |
|-------|--------|
| Task | CEO-delegated design brief (drop, capsule, asset type) |
| Brain context | `brand_vision`, `brand_rules`, `design_memory`, `product_memory` |
| Reference assets | Supabase Storage (future) |

### Outputs

| Output | Destination |
|--------|-------------|
| Design concept | Report artifact (image, moodboard, or structured brief) |
| Palette proposal | Brain `design_memory` domain (draft) |
| Asset direction | Brain `design_memory` domain (draft) |
| Design review package | Report with confidence score |

### Brain Interactions

| Operation | Domains |
|-----------|---------|
| **Read** | `brand_vision`, `brand_rules`, `design_memory`, `product_memory` |
| **Write** | `design_memory`, `reports` |

---

## Content Agent

| Property | Value |
|----------|-------|
| **ID** | `content` |
| **Role** | Copy & Storytelling |
| **Reports to** | CEO Agent |
| **Status** | Planned |

### Responsibilities

- Write product descriptions, drop announcements, and social copy
- Maintain brand voice consistency across channels
- Adapt messaging for different formats (email, IG, site, SMS)
- Store approved copy templates in the Brain
- Submit all copy for human approval before publish

### Inputs

| Input | Source |
|-------|--------|
| Task | CEO-delegated content brief (product, drop, channel) |
| Brain context | `brand_vision`, `brand_rules`, `content_memory`, `product_memory`, `marketing_memory` |
| Channel requirements | Task payload (format, character limits) |

### Outputs

| Output | Destination |
|--------|-------------|
| Product copy | Report artifact (text/markdown per channel) |
| Drop narrative | Brain `content_memory` domain (draft) |
| Social variants | Brain `content_memory` domain (draft) |
| Email drafts | Brain `content_memory` domain (draft) |

### Brain Interactions

| Operation | Domains |
|-----------|---------|
| **Read** | `brand_vision`, `brand_rules`, `content_memory`, `product_memory`, `marketing_memory` |
| **Write** | `content_memory`, `reports` |

---

## Marketing Agent

| Property | Value |
|----------|-------|
| **ID** | `marketing` |
| **Role** | Campaign Planning |
| **Reports to** | CEO Agent |
| **Status** | Planned |

### Responsibilities

- Plan campaign calendars and channel mix
- Draft ad copy, audience targeting briefs, and launch sequences
- Coordinate timing with Research and Content agents (via CEO)
- Track campaign metadata in the Brain
- Define KPIs and success metrics per campaign

### Inputs

| Input | Source |
|-------|--------|
| Task | CEO-delegated campaign brief (drop, launch, growth goal) |
| Brain context | `brand_vision`, `marketing_memory`, `content_memory`, `competitor_intelligence`, `product_memory` |
| Research insights | Brain `competitor_intelligence` (trend and competitor data) |

### Outputs

| Output | Destination |
|--------|-------------|
| Campaign plan | Report artifact (structured plan) |
| Channel mix | Brain `marketing_memory` domain (draft) |
| Launch sequence | Brain `marketing_memory` domain (draft) |
| Ad copy briefs | Report artifact for Content Agent (via CEO) |

### Brain Interactions

| Operation | Domains |
|-----------|---------|
| **Read** | `brand_vision`, `marketing_memory`, `content_memory`, `competitor_intelligence`, `product_memory` |
| **Write** | `marketing_memory`, `reports` |

---

## Shopify Agent

| Property | Value |
|----------|-------|
| **ID** | `shopify` |
| **Role** | Commerce Operations |
| **Reports to** | CEO Agent |
| **Status** | Planned |

### Responsibilities

- Prepare product listings, collections, and inventory updates
- Sync approved designs and copy to Shopify (with human approval)
- Monitor storefront health and flag anomalies
- Mirror product state in the Brain
- Execute publishes only after human approval

### Inputs

| Input | Source |
|-------|--------|
| Task | CEO-delegated commerce task (listing, collection, sync) |
| Brain context | `product_memory`, `content_memory`, `design_memory`, `brand_rules` |
| Approved content | Brain records with `status: "approved"` |
| Shopify API | Product data, inventory levels (future integration) |

### Outputs

| Output | Destination |
|--------|-------------|
| Listing draft | Report artifact (structured product listing) |
| Product state update | Brain `product_memory` domain (draft) |
| Storefront health report | Report with anomaly flags |
| Publish confirmation | Report artifact (post-approval only) |

### Brain Interactions

| Operation | Domains |
|-----------|---------|
| **Read** | `product_memory`, `content_memory`, `design_memory`, `brand_rules` |
| **Write** | `product_memory`, `reports` |
| **Publish** | Approved records → Shopify via integration hook (human-gated) |

---

## Agent ↔ Brain Matrix

| Agent | Primary Read Domains | Primary Write Domains |
|-------|---------------------|----------------------|
| CEO | All enabled | `decisions`, `tasks`, `reports` |
| Research | brand_vision, competitor_intelligence, marketing_memory | competitor_intelligence, reports |
| Designer | brand_vision, brand_rules, design_memory, product_memory | design_memory, reports |
| Content | brand_vision, brand_rules, content_memory, product_memory | content_memory, reports |
| Marketing | brand_vision, marketing_memory, content_memory, competitor_intelligence | marketing_memory, reports |
| Shopify | product_memory, content_memory, design_memory, brand_rules | product_memory, reports |

---

## Future: LangGraph Orchestration

Each agent will be implemented as a LangGraph graph:

### Graph Structure

```
START → load_brain_context → plan → execute → validate → submit_report → write_brain → END
```

### State Shape

Each graph merges `BrainGraphState`:

| Field | Purpose |
|-------|---------|
| `brainContext` | Pre-assembled context at graph entry |
| `pendingWrites` | Brain writes queued during execution |
| `queryLog` | Audit of reads performed |

### CEO Graph (Extended)

```
START → load_context → plan → create_tasks → delegate → wait
      → synthesize_reports → escalate → write_decisions → END
```

### Configuration

`BrainGraphConfig` per agent defines:
- `readDomains` — authorized read domains
- `writeDomains` — authorized write domains
- `autoFlushWrites` — flush pending writes on completion
- `defaultWriteStatus` — `draft` or `pending_review`

---

## Implementation Order

1. Brain schema and read/write interface
2. Task and report persistence
3. CEO Agent (orchestration shell)
4. Research Agent (lowest external dependency)
5. Content Agent
6. Designer Agent
7. Marketing Agent
8. Shopify Agent (highest external integration risk)

See [roadmap.md](./roadmap.md) for phase details.

---

## Related Documentation

- [Brain](./brain.md) — Brain domains and read/write contracts
- [Data Flow](./data-flow.md) — end-to-end agent flow
- [Architecture](./architecture.md) — system architecture
- [Integrations](./integrations.md) — external APIs agents will use
