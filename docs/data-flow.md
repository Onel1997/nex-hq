# NexHQ — Data Flow

## Overview

This document describes how information moves through NexHQ — from human intent to agent execution, Brain persistence, report generation, and human review.

The system follows a strict unidirectional flow with the Brain as the central hub:

```
Human → CEO Agent → Specialist Agents → Brain → Reports → Human Review
```

No specialist agent communicates directly with another. All coordination passes through the CEO Agent and the Brain.

---

## End-to-End Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                              HUMAN                                    │
│  Sets goal in command center · Reviews reports · Approves outputs    │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                    Natural language goal
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           CEO AGENT                                   │
│  1. Read Brain context (company profile, brand, campaigns, tasks)    │
│  2. Decompose goal into structured tasks                             │
│  3. Assign tasks to specialist agents                                │
│  4. Write tasks to Brain + Tasks module                              │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                    Delegated tasks (one per specialist)
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌───────────────────┐ ┌───────────────┐ ┌───────────────┐
│  Research Agent   │ │ Content Agent │ │ Designer Agent│  ...
└────────┬──────────┘ └───────┬───────┘ └───────┬───────┘
         │                    │                  │
         │    Each specialist:                    │
         │    1. Read Brain context               │
         │    2. Execute domain work              │
         │    3. Write drafts to Brain            │
         │    4. Submit structured report         │
         │                    │                  │
         └────────────────────┼──────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         NEXHQ BRAIN                                   │
│  Stores: drafts, decisions, domain knowledge, task snapshots         │
│  Status: draft → pending_review → approved → archived                │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                    Reports linked to tasks
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           REPORTS                                     │
│  Structured agent outputs: summary, artifacts, confidence          │
│  Status: draft → submitted → approved / rejected                     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                    CEO synthesizes + surfaces for review
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         HUMAN REVIEW                                  │
│  Approve · Reject · Request revision                                 │
│  Approved outputs → Brain (approved) → External systems              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Human Sets Goal

### Trigger

A human operator enters a goal in the command center dashboard — for example:

> "Plan the Summer '26 drop — research trends, design the capsule direction, write copy, and prepare the Shopify listing."

### Data Created

| Artifact | Location | Status |
|----------|----------|--------|
| Goal (natural language) | Command center UI → API | Ephemeral (passed to CEO) |

### No Brain Write Yet

The goal itself is not persisted until the CEO Agent processes it.

---

## Phase 2: CEO Agent Orchestration

### Process

```
Goal received
    │
    ▼
BrainContextAssembler.assemble({
  workspaceId,
  agentId: "ceo",
  domains: [all enabled]
})
    │
    ▼
CEO reads: company_profile, brand_vision, marketing_memory,
           active tasks, recent decisions, competitor_intelligence
    │
    ▼
CEO decomposes goal into tasks:
  ├── Task 1: "Research streetwear trends for Summer '26" → research
  ├── Task 2: "Design capsule visual direction" → designer
  ├── Task 3: "Write drop copy for all channels" → content
  ├── Task 4: "Build campaign plan and launch sequence" → marketing
  └── Task 5: "Prepare Shopify product listings" → shopify
    │
    ▼
Write tasks to Brain (tasks domain) + Tasks module
Write decision record to Brain (decisions domain)
```

### Data Created

| Artifact | Domain / Module | Status |
|----------|----------------|--------|
| Task records (×5) | Brain `tasks` + Tasks module | `assigned` |
| Orchestration decision | Brain `decisions` | `approved` (CEO-authored) |
| Context assembly event | Brain `brain_events` | `context.assembled` |

---

## Phase 3: Specialist Agent Execution

Each specialist receives one task and follows the same pattern.

### Example: Content Agent

```
Task received: "Write drop copy for all channels"
    │
    ▼
BrainContextAssembler.assemble({
  workspaceId,
  agentId: "content",
  taskId,
  domains: [brand_vision, brand_rules, content_memory, product_memory]
})
    │
    ▼
Agent reads Brain context:
  - Brand voice tone: "Confident, minimal, culturally fluent"
  - Copy rules: "Short sentences. No exclamation spam."
  - Product details: Summer '26 capsule items
  - Previous drop copy templates
    │
    ▼
Agent executes (LLM + tools):
  - Product descriptions (site)
  - Drop announcement (IG, email)
  - Social captions (IG, TikTok)
    │
    ▼
Agent writes drafts to Brain:
  - content_memory record: "Summer '26 Drop Copy" (status: draft)
    │
    ▼
Agent submits report:
  - summary: "Drafted copy for 4 products across 3 channels"
  - artifacts: [site copy, IG captions, email draft]
  - confidence: 0.87
    │
    ▼
Write report to Brain (reports domain) + Reports module
```

### Parallel Execution

Independent tasks (research, design, content) can execute in parallel. Dependent tasks (Shopify listing after copy approval) are sequenced by the CEO Agent.

### Data Created (per agent)

| Artifact | Domain / Module | Status |
|----------|----------------|--------|
| Domain drafts | Industry domain (e.g. `content_memory`) | `draft` |
| Agent report | Brain `reports` + Reports module | `submitted` |
| Record created events | Brain `brain_events` | `record.created` |

---

## Phase 4: Brain Persistence

All agent outputs land in the Brain as records with full provenance:

```typescript
{
  workspaceId: "<workspace-uuid>",
  domain: "content_memory",
  slug: "summer-26-drop-copy",
  title: "Summer '26 Drop Copy",
  content: { kind: "content_memory", format: "drop_announcement", blocks: [...] },
  status: "draft",
  provenance: {
    createdBy: { type: "agent", id: "content" },
    sourceTaskId: "task_abc123",
    confidence: 0.87
  }
}
```

### Record Lifecycle

```
draft ──→ pending_review ──→ approved ──→ (integration sync)
  │                              │
  └──→ archived              └──→ superseded (by newer version)
```

### Cross-Domain Relations

Agent outputs often reference other Brain records:

- Content copy `references` product_memory record
- Marketing campaign `derived_from` research brief
- Shopify listing `fulfills` content_memory copy task

---

## Phase 5: Report Generation

Each specialist submits a structured report:

```typescript
{
  taskId: "task_abc123",
  agentId: "content",
  summary: "Drafted copy for 4 products across 3 channels",
  artifacts: [
    { type: "markdown", label: "Site Copy", content: "..." },
    { type: "markdown", label: "IG Captions", content: "..." },
    { type: "markdown", label: "Email Draft", content: "..." }
  ],
  confidence: 0.87,
  status: "submitted"
}
```

Reports are stored in both the Reports module (operational) and the Brain `reports` domain (memory).

---

## Phase 6: CEO Synthesis

After specialists complete their tasks:

```
CEO Agent receives submitted reports
    │
    ▼
Reads all reports + Brain drafts for the goal
    │
    ▼
Synthesizes cross-agent summary:
  - Research: "Oversized silhouettes trending, earth tones rising"
  - Design: "Concrete grey palette, city texture graphics"
  - Content: "Copy drafted, on-brand, ready for review"
  - Marketing: "7-day tease → 48hr countdown → drop sequence"
  - Shopify: "Listings drafted, awaiting approved copy"
    │
    ▼
Surfaces synthesis to command center UI
Flags items needing human attention (low confidence, conflicts)
    │
    ▼
Write synthesis to Brain (decisions domain)
```

---

## Phase 7: Human Review

### Review Flow

```
Human opens Reports hub in command center
    │
    ▼
Reviews each agent report:
  - Read summary and artifacts
  - Compare against Brain drafts
  - Check confidence scores
    │
    ▼
Decision per report:
  ├── Approve → Brain record status: approved
  ├── Reject → Brain record status: archived, new task created
  └── Revise → Feedback attached, task reassigned to agent
    │
    ▼
Approved records become eligible for external publish
```

### Approval Gates

| Action | Requires Approval |
|--------|-------------------|
| Brain draft creation | No (automatic) |
| Report submission | No (automatic) |
| Promoting draft to approved | Yes (human or CEO) |
| Shopify publish | Yes (human) |
| Email campaign send | Yes (human) |
| Paid ad activation | Yes (human) |

---

## Phase 8: External Publish (Future)

After human approval:

```
Approved Brain records
    │
    ▼
BrainIntegrationHook.syncOutbound(recordIds)
    │
    ├── Shopify: product listings, collections
    ├── Email: campaign deployment
    ├── Instagram: scheduled posts (future)
    └── Analytics: conversion tracking setup
    │
    ▼
Integration sync event → brain_events
Inbound signals → Brain (marketing_memory, competitor_intelligence)
```

---

## Data Flow by System Component

| Step | Component | Reads From | Writes To |
|------|-----------|-----------|-----------|
| 1 | Command Center UI | — | API (goal) |
| 2 | CEO Agent | Brain (all domains) | Brain (tasks, decisions), Tasks module |
| 3 | Specialist Agent | Brain (domain-specific), Task | Brain (domain drafts, reports), Reports module |
| 4 | Brain | Postgres | Postgres, brain_events |
| 5 | Reports Module | Reports table | Reports table |
| 6 | CEO Agent | Reports, Brain | Brain (decisions), Command center |
| 7 | Human | Reports UI, Brain UI | Brain (approve/reject), Tasks (revise) |
| 8 | Integration | Brain (approved) | External API, Brain (inbound sync) |

---

## Error and Retry Flows

### Agent Failure

```
Agent.run() throws or returns low confidence
    │
    ▼
Task status → failed
Report status → submitted (with error notes)
    │
    ▼
CEO Agent notified → decides:
  ├── Retry with same agent (modified task)
  ├── Reassign to different agent
  └── Escalate to human
```

### Conflict Detection

```
CEO synthesis detects conflicting outputs
(e.g. design palette ≠ marketing campaign colors)
    │
    ▼
Write conflict to Brain (decisions domain, status: proposed)
Escalate to human with both artifacts attached
```

---

## Realtime Updates (Future)

When Supabase Realtime is wired:

```
brain_events table
    │
    ▼
Realtime subscription in command center UI
    │
    ▼
Live updates: task status, new reports, Brain record changes
```

---

## Related Documentation

- [Architecture](./architecture.md) — system layers and contracts
- [Brain](./brain.md) — Brain read/write flows and lifecycle
- [Agents](./agents.md) — per-agent inputs, outputs, and Brain interactions
- [Integrations](./integrations.md) — external publish and inbound sync
