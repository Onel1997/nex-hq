# Facility HQ — Full Replacement Implementation Plan

> **Directive:** Do not improve the existing dashboard. **Replace it entirely.**  
> **Route:** `/` becomes a full-screen AI Research Facility — not a SaaS admin panel.

---

## 0. What Gets Deleted vs. Replaced

### DELETE from `/` (stop rendering)

| File | Reason |
|------|--------|
| `components/dashboard/command-hero.tsx` | Marketing hero — not facility |
| `components/dashboard/ai-command-interface.tsx` | Chat card — becomes Command Dock |
| `components/dashboard/ai-team-live.tsx` | Agent card grid — becomes Lab Nodes |
| `components/dashboard/intelligence-feed.tsx` | List feed — becomes Event Stream + Review Queue |
| `components/dashboard/brain-visualization.tsx` | Stat grid — becomes Brain Core node |
| `lib/mock/command-center.ts` usage on `/` | Static data — replaced by live API |

### KEEP (reuse behind the facility)

| Asset | Role in facility |
|-------|------------------|
| `lib/tasks/ceo-dashboard.ts` | Data aggregation |
| `lib/reports/goal-synthesis.ts` | Goal progress |
| `GET /api/ceo/dashboard` | Phase 1 data source → later `/api/facility` |
| `components/reports/report-review-actions.tsx` | Review queue actions |
| `AGENT_CATALOG` | Lab metadata |
| Brain event types | Live activity stream |

### NEW (the entire `/` experience)

Everything under `components/facility/` + `lib/facility/` — see component tree below.

---

## 1. Visual Target

### Reference aesthetic

```
Iron Man HUD  +  Stark Tower ops floor  +  neural network diagram
─────────────────────────────────────────────────────────────────
NOT: Notion dashboard / Linear / HubSpot CRM / Jira board
```

### Non-negotiable visual rules

1. **Full viewport** — scene fills `100vh − header` (or `100vh` in facility-fullscreen mode)
2. **Dark-first** — deep anthracite base (`oklch(0.10–0.14)`), champagne gold accents
3. **Spatial** — nodes float in space; no card grids, no stat rows
4. **Glow = state** — executing amber, review purple, error red, idle dim
5. **Connections = data flow** — SVG arcs with animated dash offset
6. **Typography** — `font-display` for labels; mono for telemetry numbers
7. **No borders-as-cards** — nodes are orbs/hex pods with halo shadows, not shadcn cards

---

## 2. Wireframe — Desktop (primary, 1440×900)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ NEXHQ · FACILITY OPS          ● LIVE    3 EXEC   2 REVIEW   0 FAIL   14:32  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                                               ┃
┃   ┌─────────────┐                                              ┌───────────┐   ┃
┃   │ REVIEW      │                                              │  EVENT    │   ┃
┃   │ QUEUE       │         ╭─────────────────╮                  │  STREAM   │   ┃
┃   │             │         │   👔 CEO CORE   │                  │           │   ┃
┃   │ ● Marketing │         │  orchestrating  │                  │ research  │   ┃
┃   │   campaign  │         ╰────────┬────────╯                  │ .exec…   │   ┃
┃   │ ● Design    │                  │                           │ design    │   ┃
┃   │   direction │    ╭─────────────┼─────────────╮           │ .approv… │   ┃
┃   │             │    │             │             │           │ ceo.final│   ┃
┃   │ [Approve]   │ ╭──┴──╮      ╔════╧════╗     ╭──┴──╮       │           │   ┃
┃   │ [Review →]  │ │RESEARCH│~~~~║  BRAIN  ║~~~~│IMAGE │       │           │   ┃
┃   └─────────────┘ │  LAB   │  ~~║  CORE   ║  ~~│ LAB  │       └───────────┘   ┃
┃                   ╰───┬────╯  ~~║ 847 syn ║  ~~╰──────╯                       ┃
┃                       │         ╚════╤════╝                                   ┃
┃                   ╭───┴───╮          │         ╭────────╮                     ┃
┃                   │SHOPIFY│          │         │DESIGN  │                      ┃
┃                   │  LAB  │     ╭────┴────╮    │  LAB   │╮                    ┃
┃                   ╰───────╯     │CONTENT  │    ╰───┬────╯│                    ┃
┃                                   │  LAB    │        │     │ MARKETING         ┃
┃                                   ╰─────────╯        ╰─────┤   LAB             ┃
┃                                                            ╰───────────────────╯┃
┃   ┌─────────────────────────────────────────────────────────────────────────┐ ┃
┃   │ GOAL ▸ SS26 Capsule Launch          ████████████░░░░  66%   R✓ D✓ M○   │ ┃
┃   └─────────────────────────────────────────────────────────────────────────┘ ┃
┃                                                                               ┃
┃   ┌─────────────────────────────────────────────────────────────────────────┐ ┃
┃   │  ◈  Deploy research and design for SS26 capsule…              ⏎ RUN   │ ┃
┃   └─────────────────────────────────────────────────────────────────────────┘ ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Legend:
  ~~~~  animated data-flow arc (active)
  ╔══╗  Brain Core — largest node, central anchor
  ●     live status dot on Review Queue items
```

### Wireframe — Lab Node (expanded hover / selected)

```
              ╭────────────────────────╮
         ░░░░░│    ◉ ACTIVITY RING     │░░░░░  ← amber pulse when executing
        ░     │   ┌────────────────┐   │     ░
       ░      │   │   🔍  (icon)   │   │      ░
        ░     │   └────────────────┘   │     ░
         ░░░░░│      RESEARCH LAB      │░░░░░
              │  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
              │  Q2 competitor analysis │
              │  REPORT · pending review│
              │  ████████░░  EXECUTING  │
              ╰────────────────────────╯
                    ▼ glow halo
```

### Wireframe — Mobile (facility stack, <768px)

```
┌─────────────────────────┐
│ NEXHQ FACILITY    ● LIVE│
│ 3 exec · 2 review       │
├─────────────────────────┤
│   ╔═══════════════╗     │
│   ║  BRAIN CORE   ║     │
│   ║  847 · 94%    ║     │
│   ╚═══════════════╝     │
│   ┌─ CEO CORE ─────────┐│
│   │ SS26 orchestration ││
│   └────────────────────┘│
│ REVIEW QUEUE (2)        │
│ ┌─────────────────────┐ │
│ │ Marketing · Approve │ │
│ └─────────────────────┘ │
│ PIPELINE                │
│ Research → Design → …   │
│ ┌─ Research ─ EXEC ───┐ │
│ ┌─ Design ─ REVIEW ───┐ │
│ ┌─ Marketing ─ IDLE ─┐ │
│ …                       │
│ ┌─────────────────────┐ │
│ │ ◈ Delegate goal…    │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

---

## 3. Component Tree

```
app/(dashboard)/page.tsx                          REPLACE ENTIRELY
└── FacilityPage
    └── FacilityShell                             full-viewport, dark, minimal chrome
        ├── FacilityHud                             fixed overlay layer
        │   ├── FacilityStatusBar                 LIVE dot, telemetry chips, clock
        │   ├── ReviewQueuePanel                    left dock — pending_review reports
        │   └── EventStreamPanel                    right dock — Brain events ticker
        │
        ├── FacilityScene                           flex-1, relative, overflow hidden
        │   ├── FacilityBackdrop
        │   │   ├── GridPlane                       CSS perspective grid
        │   │   ├── RadialGlow                      center gold bloom
        │   │   └── ScanlineOverlay                 optional subtle scanlines
        │   │
        │   ├── NeuralGraph                         SVG absolute inset-0
        │   │   ├── SynapsePath × 12                static + animated arcs
        │   │   └── ParticleField                   CSS dots along active paths
        │   │
        │   ├── BrainCore                           center anchor (50%, 50%)
        │   │   ├── CoreOrb                         pulsing sphere
        │   │   ├── SyncGauge                       ring progress
        │   │   └── KnowledgeCount                  entry count
        │   │
        │   ├── CeoCore                             inner ring (50%, 22%)
        │   │   ├── CoreOrb [variant=ceo]
        │   │   ├── GoalLabel                       active ceo-goal title
        │   │   └── VerdictChip                     latest final report link
        │   │
        │   └── LabPod × 7                          orbital positions
        │       ├── research
        │       ├── designer
        │       ├── marketing
        │       ├── content
        │       ├── image
        │       ├── shopify
        │       └── [each LabPod contains:]
        │           ├── ActivityRing                  SVG stroke by execution %
        │           ├── LabIcon
        │           ├── LabName
        │           ├── TaskLabel                     truncated current task
        │           ├── ReportBadge                   status chip
        │           ├── OpsStateIndicator             IDLE|EXEC|REVIEW|…
        │           └── GlowHalo                      CSS box-shadow by state
        │
        ├── GoalProgressRail                        bottom overlay, above dock
        │   ├── GoalTitle
        │   ├── SynthesisBar                        R✓ D✓ M○ chips
        │   └── CompletionPercent
        │
        ├── CommandDock                             bottom fixed
        │   ├── DelegateInput                       POST /api/ceo/delegate
        │   ├── RunIndicator                        spinner when deploying
        │   └── KeyboardHint
        │
        └── LabInspector                            Sheet/Drawer on lab click
            ├── InspectorHeader
            ├── LiveTaskBlock                       from byAgent[id]
            ├── LiveReportBlock                     linked report + preview
            ├── ExecutionTimeline                   task event steps
            ├── ReviewActions                       report-review-actions
            └── DeepLinks                           /agents/{id}, /reports/{id}
```

### Data hooks (lib layer)

```
lib/facility/
├── types.ts                 FacilitySnapshot, LabSnapshot, ReviewItem, SynapseEdge
├── layout.ts                FACILITY_POSITIONS per breakpoint
├── graph.ts                 SYNAPSE_EDGES (research→design, etc.)
├── derive-lab-state.ts      TaskListItem + Report → OpsState
├── derive-review-queue.ts   pending_review reports across labs
├── aggregate.ts             getFacilitySnapshot() — wraps getCeoDashboardData
└── use-facility-data.ts     SWR polling hook (Phase 1) → SSE (Phase 3)

app/api/facility/route.ts   GET → FacilitySnapshot
```

---

## 4. Layout System

### Full-screen shell

`FacilityShell` bypasses the SaaS content padding model:

```tsx
// Concept — not implemented yet
<div className="facility-shell fixed inset-0 z-0 flex flex-col bg-[oklch(0.11_0.012_55)]">
  <FacilityHud />           {/* h-12, glass bar */}
  <FacilityScene />         {/* flex-1 min-h-0 */}
  <GoalProgressRail />      {/* h-14 */}
  <CommandDock />           {/* h-16 */}
</div>
```

**Sidebar strategy:** Collapse to icon rail automatically on `/`, or hide entirely with `⌘B` toggle. Facility owns the viewport — sidebar is secondary navigation, not primary layout.

### Node positions (desktop, normalized %)

| Node | left | top | Size |
|------|------|-----|------|
| Brain Core | 50% | 50% | 160px |
| CEO Core | 50% | 20% | 100px |
| Research | 16% | 38% | 120px |
| Design | 32% | 72% | 120px |
| Marketing | 68% | 72% | 120px |
| Content | 50% | 82% | 120px |
| Image | 84% | 38% | 120px |
| Shopify | 10% | 68% | 120px |

Positions computed from center with `transform: translate(-50%, -50%)`.

### Synapse edges

| Edge | Type | Animates when |
|------|------|---------------|
| research → designer | pipeline | research EXECUTING or report approved |
| designer → marketing | pipeline | design active |
| marketing → content | pipeline | marketing active |
| content → image | pipeline | content active |
| * → ceo | report-up | any lab in REVIEW or report approved |
| * → brain | context | any lab EXECUTING (context assembly) |

---

## 5. Live Data Mapping

### FacilitySnapshot (API response)

```ts
interface FacilitySnapshot {
  workspace: { id: string; name: string };
  telemetry: {
    live: boolean;
    activeExecutions: number;
    pendingReview: number;
    failedTasks: number;
    brainEntries: number;
    brainSyncPct: number;
  };
  brain: { entries: number; syncPct: number; state: "steady" | "syncing" | "assembling" };
  ceo: {
    state: "standby" | "orchestrating" | "synthesizing";
    activeGoal: string | null;
    parentGoalTaskId: string | null;
    latestFinalReport: CeoFinalReportSummary | null;
  };
  labs: Record<LabId, LabSnapshot>;
  reviewQueue: ReviewQueueItem[];
  goals: GoalProgressItem[];
  events: FacilityEvent[];
  refreshedAt: string;
}

interface LabSnapshot {
  agentId: LabId;
  opsState: "idle" | "queued" | "executing" | "review" | "approved" | "manual" | "error";
  currentTask: { id: string; title: string; status: TaskStatus; priority: TaskPriority } | null;
  currentReport: { id: string; title: string; status: ReportStatus } | null;
  executionPct: number;  // 0-100 for ActivityRing
}

interface ReviewQueueItem {
  reportId: string;
  title: string;
  agentId: LabId;
  taskId: string;
  submittedAt: string;
}
```

### Derivation rules

| UI element | Source |
|------------|--------|
| Lab `opsState` | `byAgent[id]` top task status + linked report status |
| Review Queue | All reports where `status === "pending_review"` |
| Goal rail | Parent tasks `payload.kind === "ceo-goal"` + `GoalSynthesisContext` |
| Event stream | Last 20 Brain events: `task.execution.*`, `report.*`, `ceo.final_report.*` |
| Brain sync | Domain record counts + freshness heuristic |
| LIVE dot | `activeExecutions > 0` or event in last 30s |

---

## 6. Visual States & Motion

### OpsState → Visual token

| State | Halo color | Ring | Arc |
|-------|------------|------|-----|
| idle | none | gray 20% | dim |
| queued | blue pulse 2s | blue | slow dash |
| executing | amber glow 1.2s | amber spin | fast flow |
| review | purple breathe 2.5s | purple | hold |
| approved | green flash 400ms | green | pulse once |
| manual | amber dotted | amber | dashed to CEO |
| error | red 1s | red | broken |

### Motion catalog (CSS/SVG only in V1)

| Animation | Element | Implementation |
|-----------|---------|----------------|
| `core-breathe` | Brain orb | `@keyframes scale+opacity` 4s |
| `core-sync` | Brain ring | SVG `stroke-dashoffset` |
| `lab-pulse` | Lab halo | `box-shadow` keyframes |
| `synapse-flow` | Arc | SVG `stroke-dasharray` animation |
| `live-blink` | LIVE dot | opacity toggle 1s |
| `queue-slide-in` | Review item | `translateX` on new item |
| `goal-fill` | Progress rail | width transition 600ms |

**`prefers-reduced-motion`:** static colors, no dash animation, no pulse.

---

## 7. Theme — Dark Futuristic

New CSS block in `globals.css` (facility-scoped):

```css
.facility-shell {
  --facility-bg: oklch(0.11 0.014 55);
  --facility-grid: oklch(0.82 0.055 85 / 0.04);
  --facility-glow-gold: oklch(0.82 0.08 85 / 0.35);
  --facility-glow-amber: oklch(0.75 0.14 75 / 0.40);
  --facility-glow-purple: oklch(0.62 0.16 300 / 0.35);
  --facility-glow-red: oklch(0.58 0.20 25 / 0.35);
  --facility-glass: oklch(0.18 0.012 55 / 0.72);
  --facility-text-dim: oklch(0.68 0.018 80);
  --facility-text-bright: oklch(0.96 0.012 90);
  background: var(--facility-bg);
  color: var(--facility-text-bright);
}
```

Force `.dark` on facility route or use `facility-shell` tokens independent of global theme toggle.

---

## 8. Implementation Phases

### Phase A — Scaffold & shell (Day 1–2)

**Goal:** `/` renders full-screen dark facility shell; old dashboard components removed.

- [ ] Create `components/facility/` tree (empty shells)
- [ ] Create `FacilityShell`, `FacilityScene`, `FacilityBackdrop`
- [ ] Replace `app/(dashboard)/page.tsx` — only `<FacilityPage />`
- [ ] Add facility CSS tokens to `globals.css`
- [ ] Sidebar collapse behavior on `/`

**Exit:** Blank facility viewport, no old dashboard visible.

### Phase B — Static neural graph (Day 3–4)

**Goal:** All nodes positioned; static arcs; placeholder labels.

- [ ] `BrainCore`, `CeoCore`, `LabPod × 7` with layout.ts positions
- [ ] `NeuralGraph` SVG with `SynapsePath` edges
- [ ] `FacilityStatusBar` with hardcoded telemetry (temporary)

**Exit:** Spatial facility visible; looks like mission control (static).

### Phase C — Live data (Day 5–6)

**Goal:** Real tasks, reports, review queue.

- [ ] `lib/facility/aggregate.ts` + `derive-lab-state.ts`
- [ ] `GET /api/facility/route.ts`
- [ ] Wire all nodes to `FacilitySnapshot`
- [ ] `ReviewQueuePanel` with live `pending_review` items
- [ ] `GoalProgressRail` from `goal-synthesis.ts`

**Exit:** Node states match real task board; review queue shows actual reports.

### Phase D — Motion & activity (Day 7–8)

**Goal:** Glow, animated synapses, event stream.

- [ ] OpsState → glow/ring/arc animations
- [ ] `EventStreamPanel` from recent Brain events
- [ ] `CommandDock` → `POST /api/ceo/delegate`
- [ ] Delegation triggers scene update (poll or optimistic)

**Exit:** Executing lab glows; arcs animate; delegate from dock works.

### Phase E — Interaction & polish (Day 9–10)

**Goal:** Production-ready facility.

- [ ] `LabInspector` drawer with review actions
- [ ] Mobile facility stack layout
- [ ] `prefers-reduced-motion`
- [ ] i18n (`lib/i18n/locales/de/facility.ts`)
- [ ] Delete unused dashboard imports from `/`
- [ ] Polling → SSE for live updates (stretch)

**Exit:** Full replacement complete; old dashboard dead.

---

## 9. Build Order (strict sequence)

```
1.  globals.css facility tokens
2.  lib/facility/types.ts
3.  lib/facility/layout.ts + graph.ts
4.  components/facility/facility-shell.tsx
5.  components/facility/scene/facility-scene.tsx
6.  components/facility/scene/facility-backdrop.tsx
7.  components/facility/scene/neural-graph.tsx
8.  components/facility/nodes/{brain-core,ceo-core,lab-pod}.tsx
9.  components/facility/nodes/{activity-ring,glow-halo,ops-state}.tsx
10. app/(dashboard)/page.tsx → FacilityPage ONLY
11. lib/facility/derive-lab-state.ts
12. lib/facility/aggregate.ts
13. app/api/facility/route.ts
14. components/facility/hooks/use-facility-data.ts
15. Wire live data to nodes
16. components/facility/hud/{status-bar,review-queue,event-stream}.tsx
17. components/facility/hud/{goal-rail,command-dock}.tsx
18. Animation CSS + SVG dash animations
19. components/facility/inspector/lab-inspector.tsx
20. Responsive stack layout
21. i18n + cleanup
```

**Do not touch** `ceo-dashboard.tsx`, `task-board.tsx`, or `report-hub.tsx` except to import shared actions into `LabInspector`.

---

## 10. Success Criteria

| # | Requirement | Verification |
|---|-------------|--------------|
| 1 | Full-screen layout | No `max-w-7xl` content column; scene fills viewport |
| 2 | Brain Core center | Largest node at 50%/50% |
| 3 | Labs orbital | 7 labs positioned around core |
| 4 | Animated connections | SVG arcs animate on active pipeline |
| 5 | Live status | Telemetry from `getCeoDashboardData` |
| 6 | Activity visualization | Executing lab glows + ring progress |
| 7 | Review queue | Left panel lists `pending_review` with actions |
| 8 | Real data | Zero mock command-center imports on `/` |
| 9 | Dark futuristic | Facility tokens, not default card UI |
| 10 | Motion & glow | CSS/SVG animations on state change |

---

## 11. Mockup

Visual concept image: `docs/assets/facility-hq-mockup.png` (generated separately).

---

## 12. Files to Create (complete list)

```
components/facility/
  facility-page.tsx
  facility-shell.tsx
  scene/
    facility-scene.tsx
    facility-backdrop.tsx
    neural-graph.tsx
    synapse-path.tsx
    particle-field.tsx
  nodes/
    brain-core.tsx
    ceo-core.tsx
    lab-pod.tsx
    core-orb.tsx
    activity-ring.tsx
    glow-halo.tsx
    ops-state-indicator.tsx
  hud/
    facility-status-bar.tsx
    review-queue-panel.tsx
    event-stream-panel.tsx
    goal-progress-rail.tsx
    command-dock.tsx
  inspector/
    lab-inspector.tsx
    execution-timeline.tsx
  hooks/
    use-facility-data.ts
    use-facility-layout.ts

lib/facility/
  types.ts
  layout.ts
  graph.ts
  derive-lab-state.ts
  derive-review-queue.ts
  aggregate.ts

app/api/facility/route.ts

lib/i18n/locales/de/facility.ts
docs/assets/facility-hq-mockup.png
```

---

*Ready for implementation approval. Phase A begins with full replacement of `app/(dashboard)/page.tsx` — no incremental dashboard edits.*
