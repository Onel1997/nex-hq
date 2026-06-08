# Milaene HQ — Agent System

## Overview

Milaene HQ operates as a **hierarchical multi-agent system**. Every specialist agent reports to the CEO Agent. Every agent — including the CEO — reads from and writes to the shared **Milaene Brain**.

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

## CEO Agent

**Role:** Master orchestrator and strategic synthesizer.

**Responsibilities:**
- Receive goals from humans via the command center
- Decompose goals into discrete tasks for specialist agents
- Prioritize work based on brand calendar, inventory, and campaign deadlines
- Review and synthesize specialist reports
- Escalate decisions that require human approval
- Maintain cross-agent coherence (e.g., design aligns with marketing narrative)

**Reports to:** Humans

**Status:** Not implemented — directory scaffold only

---

## Research Agent

**Role:** Market and culture intelligence.

**Responsibilities:**
- Monitor streetwear trends, competitor drops, and cultural signals
- Produce trend briefs and opportunity assessments
- Feed insights into Milaene Brain for other agents to reference
- Support drop timing and positioning decisions

**Reports to:** CEO Agent

**Status:** Not implemented — directory scaffold only

---

## Designer Agent

**Role:** Visual and product design support.

**Responsibilities:**
- Generate design concepts aligned with Milaene brand guidelines
- Produce mood boards, color palettes, and layout directions
- Prepare assets for review before production
- Maintain design history in Milaene Brain

**Reports to:** CEO Agent

**Status:** Not implemented — directory scaffold only

---

## Content Agent

**Role:** Copy, storytelling, and editorial.

**Responsibilities:**
- Write product descriptions, drop announcements, and social copy
- Maintain brand voice consistency across channels
- Adapt messaging for different formats (email, IG, site, SMS)
- Store approved copy templates in Milaene Brain

**Reports to:** CEO Agent

**Status:** Not implemented — directory scaffold only

---

## Marketing Agent

**Role:** Campaign planning and growth.

**Responsibilities:**
- Plan campaign calendars and channel mix
- Draft ad copy, audience targeting briefs, and launch sequences
- Coordinate timing with Research and Content agents
- Track campaign metadata in Milaene Brain

**Reports to:** CEO Agent

**Status:** Not implemented — directory scaffold only

---

## Shopify Agent

**Role:** Commerce operations.

**Responsibilities:**
- Prepare product listings, collections, and inventory updates
- Sync approved designs and copy to Shopify (with human approval)
- Monitor storefront health and flag anomalies
- Mirror product state in Milaene Brain

**Reports to:** CEO Agent

**Status:** Not implemented — directory scaffold only

---

## Shared: Milaene Brain

All agents interact with the Brain through a single interface (`brain/`). The Brain is not an agent — it is the **shared knowledge substrate**.

**Contains (planned):**
- Brand identity and voice guidelines
- Product catalog and drop history
- Audience and customer segments
- Campaign and content archive
- Agent-generated artifacts pending approval

**Access pattern:**
- Agents **read** context before executing tasks
- Agents **write** outputs as drafts or reports (not live production by default)
- CEO Agent and humans **approve** before Brain state affects external systems

---

## Agent Communication Model

| Pattern | Description |
|---------|-------------|
| **Delegation** | CEO creates a task → assigns to one specialist |
| **Report-back** | Specialist completes task → submits structured report to CEO |
| **Brain read** | Any agent queries Brain for context before acting |
| **Brain write** | Agent persists draft output to Brain for review |
| **Escalation** | Agent flags uncertainty → CEO surfaces to human |

Agents do **not** communicate directly with each other. All coordination flows through the CEO Agent and the Brain. This keeps the system auditable and prevents conflicting directives.

---

## Future: LangGraph Orchestration

Each agent will be implemented as a LangGraph graph with:

- **State**: task input, Brain context, intermediate steps, final report
- **Nodes**: plan → execute → validate → report
- **Edges**: conditional routing based on task type and confidence
- **Checkpoints**: persisted state for long-running or resumable workflows

The CEO graph will spawn or invoke specialist subgraphs and aggregate results.

---

## Implementation Order (Recommended)

1. Milaene Brain schema and read/write interface
2. Task and report type system
3. CEO Agent (orchestration shell, no specialist logic yet)
4. Research Agent (lowest external dependency)
5. Content Agent
6. Designer Agent
7. Marketing Agent
8. Shopify Agent (highest external integration risk)
