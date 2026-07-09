# NexHQ Command Center V1 — Architecture & UI Design

> **Status:** Design only — no implementation yet  
> **Sprint:** NEXHQ COMMAND CENTER V1  
> **Goal:** Replace traditional dashboards with a Jarvis / Stark Industries Mission Control experience

---

## 1. Executive Summary

NexHQ Command Center V1 transforms `/` from a marketing-style dashboard with static mock data into a **live neural operations map** — a spatial AI Research Facility where the Brain Core sits at center, specialist Labs orbit around it, and animated connections show how intelligence flows from Research → Design → Marketing → Content → Image, all converging on CEO.

The backend orchestration loop already exists (delegation → auto-execution → review → final report). V1 is primarily a **unification and visualization layer** that wires live Brain/task/report data into a new spatial UI system, replacing fragmented surfaces (`/agents/ceo`, `/tasks`, `/reports`) with a single command experience while preserving deep-link drill-downs.

---

## 2. Design Principles

| Principle | Meaning |
|-----------|---------|
| **Facility, not dashboard** | Spatial topology over card grids. You are inside a research facility, not browsing a SaaS app. |
| **Live nervous system** | Every glow, pulse, and connection animation maps to a real Brain event or task state change. |
| **Glanceable ops** | Founder sees goal progress, agent activity, and blockers in &lt;3 seconds without reading paragraphs. |
| **Drill, don't duplicate** | Command Center summarizes; `/agents/*`, `/reports`, `/tasks` remain detail workspaces. |
| **Luxury sci-fi** | Extend existing `luxury-surface`, `font-display`, oklch gold accents — not cyberpunk neon clutter. |

### Anti-patterns (explicitly avoided)

- Kanban boards on the home page
- Static stat cards with hardcoded values
- Sidebar-first project management layouts
- Generic "team member" avatars with no operational meaning

---

## 3. Spatial Concept

### 3.1 Topology

```
                    ┌─────────────┐
                    │  CEO Core   │  ← orchestration, final reports, delegation
                    └──────┬──────┘
                           │ (all labs report up)
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────▼────┐      ┌─────▼─────┐     ┌────▼────┐
    │Research │─────▶│  Design   │────▶│Marketing│
    │   Lab   │      │    Lab    │     │   Lab   │
    └─────────┘      └─────┬─────┘     └────┬────┘
                           │                │
                      ┌────▼────┐      ┌────▼────┐
                      │ Content │─────▶│  Image  │
                      │   Lab   │      │   Lab   │
                      └────┬────┘      └─────────┘
                           │
                      ┌────▼────┐
                      │ Shopify │  (parallel commerce lane)
                      │   Lab   │
                      └─────────┘

              ╔═══════════════════════╗
              ║     🧠 BRAIN CORE     ║  ← center, always visible
              ║  knowledge · sync ·   ║
              ║  context assembly     ║
              ╚═══════════════════════╝
```

### 3.2 Information hierarchy (z-order)

1. **Brain Core** — persistent center anchor; highest visual weight
2. **Active Lab** — enlarged on hover/focus; shows expanded telemetry
3. **Connection arcs** — show data flow between labs
4. **CEO Core** — elevated ring above specialists (not center — Brain owns center)
5. **Ambient layer** — grid, radial glow, subtle particle field
6. **Command input** — bottom or overlay dock (Jarvis prompt bar)
7. **Telemetry strip** — top status pulses (live counts, not mock)

---

## 4. UI Architecture

### 4.1 Layer model

```
┌──────────────────────────────────────────────────────────────┐
│  Shell Layer          layout/dashboard-shell, sidebar        │
├──────────────────────────────────────────────────────────────┤
│  Command Center Page  app/(dashboard)/page.tsx               │
├──────────────────────────────────────────────────────────────┤
│  Scene Layer          CommandCenterScene (spatial canvas)    │
│    ├── BrainCoreNode                                           │
│    ├── LabNode × 7                                             │
│    ├── ConnectionLayer (SVG/canvas arcs)                       │
│    └── ActivityPulseOverlay                                    │
├──────────────────────────────────────────────────────────────┤
│  HUD Layer            fixed overlays, non-scene UI             │
│    ├── StatusTelemetryBar                                      │
│    ├── CommandDock (CEO prompt / delegate)                     │
│    ├── GoalTrackerPanel (collapsible)                          │
│    └── IntelligenceTicker (live Brain events)                  │
├──────────────────────────────────────────────────────────────┤
│  Detail Layer         sheets / drawers on lab click            │
│    ├── LabDetailDrawer                                         │
│    ├── ReportPreviewSheet                                      │
│    └── ReviewActionBar (reuse report-review-actions)           │
├──────────────────────────────────────────────────────────────┤
│  Data Layer           hooks + API aggregate                    │
│    ├── useCommandCenterData()                                  │
│    ├── useBrainEventStream()                                   │
│    └── command-center-store (Zustand, optional)              │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Route strategy

| Route | Role in V1 |
|-------|------------|
| `/` | **Primary Command Center** — spatial scene + HUD |
| `/agents/ceo` | Deep CEO workspace (delegation form, briefing, full dashboard) |
| `/agents/{lab}` | Specialist detail UI (existing interfaces) |
| `/reports` | Full report browser + review |
| `/tasks` | Full task board |
| `/brain` | Knowledge browser |

Command Center **does not replace** specialist pages — it links into them via lab nodes.

---

## 5. Component Hierarchy

```
CommandCenterPage
└── CommandSurface [variant="facility"]
    ├── StatusTelemetryBar
    │   ├── TelemetryPulse × N        (active, review, failed, brain sync)
    │   └── WorkspaceBadge
    │
    ├── CommandCenterScene            [client, responsive canvas]
    │   ├── FacilityBackdrop          (grid, radial glow, noise)
    │   ├── ConnectionLayer
    │   │   └── DataFlowArc × 6       (research→design, design→marketing, …)
    │   ├── BrainCoreNode
    │   │   ├── BrainCoreGlow
    │   │   ├── BrainSyncRing
    │   │   └── BrainKnowledgeStats
    │   ├── CeoCoreNode               (ring position, not center)
    │   │   ├── CeoGoalBadge
    │   │   ├── FinalReportChip
    │   │   └── DelegationStatus
    │   └── LabNode × 7
    │       ├── LabNodeShell          (icon, label, status ring)
    │       ├── LabTelemetry          (task, report, execution, review)
    │       └── LabActivityGlow
    │
    ├── GoalTrackerPanel              (active ceo-goal tasks + synthesis %)
    │
    ├── IntelligenceTicker            (recent Brain events → feed items)
    │
    ├── CommandDock
    │   ├── DelegateInput             (goal → POST /api/ceo/delegate)
    │   ├── SuggestedActionChips
    │   └── QuickReviewCTA
    │
    └── LabDetailDrawer               (on lab select)
        ├── LabHeader
        ├── CurrentTaskCard
        ├── CurrentReportCard
        ├── ExecutionTimeline
        └── LabDeepLinkActions
```

### 5.1 Shared primitives (new)

| Component | Purpose |
|-----------|---------|
| `FacilitySurface` | Extends `CommandSurface` with facility backdrop tokens |
| `NodeShell` | Base orb/hex node with glow states |
| `TelemetryChip` | Compact label + value + state color |
| `ActivityRing` | SVG ring progress for execution/review |
| `DataFlowArc` | Animated Bézier connection between two node anchors |
| `OpsStateBadge` | Maps task/report/execution state → visual token |

### 5.2 Reused from existing codebase

| Existing | Reuse in V1 |
|----------|-------------|
| `components/shared/command-surface.tsx` | Base page wrapper |
| `components/ceo/ceo-dashboard.tsx` | Data shapes + status color maps |
| `components/reports/report-review-actions.tsx` | Review actions in drawer |
| `components/shared/agent-status-badge.tsx` | Lab status badges |
| `lib/tasks/ceo-dashboard.ts` | Core aggregate logic |
| `lib/reports/goal-synthesis.ts` | Goal progress / synthesis readiness |
| `lib/i18n/data/*` | Labels, agent catalog |

---

## 6. Layout System

### 6.1 Coordinate system

The scene uses a **normalized coordinate space** (0–1) so node positions are resolution-independent:

```ts
// lib/command-center/layout.ts (future)
interface NodePosition {
  id: LabId | "brain" | "ceo";
  x: number;  // 0–1 relative to scene width
  y: number;  // 0–1 relative to scene height
  ring: "core" | "inner" | "outer";
}
```

**Default desktop layout (16:9 scene):**

| Node | x | y | Ring |
|------|---|---|------|
| Brain Core | 0.50 | 0.50 | core |
| CEO Core | 0.50 | 0.18 | inner |
| Research Lab | 0.18 | 0.38 | outer |
| Design Lab | 0.38 | 0.72 | outer |
| Marketing Lab | 0.62 | 0.72 | outer |
| Content Lab | 0.50 | 0.88 | outer |
| Image Lab | 0.82 | 0.38 | outer |
| Shopify Lab | 0.12 | 0.72 | outer |

### 6.2 HUD zones (fixed, non-scaling)

```
┌─────────────────────────────────────────────────────────────┐
│ TELEMETRY BAR                                    [workspace]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    SPATIAL SCENE                            │
│                  (aspect-ratio locked)                      │
│                                                             │
│  [Goal Panel]                                               │
│  collapsible                                                │
├─────────────────────────────────────────────────────────────┤
│ INTELLIGENCE TICKER (horizontal scroll)                     │
├─────────────────────────────────────────────────────────────┤
│ COMMAND DOCK — "What should we build next?"                 │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 CSS tokens (extend `globals.css`)

```css
/* Proposed tokens — design reference only */
--facility-grid-opacity: 0.04;
--facility-glow-primary: oklch(0.82 0.055 85 / 0.12);
--facility-glow-active: oklch(0.82 0.12 85 / 0.35);
--facility-glow-review: oklch(0.65 0.15 300 / 0.30);
--facility-glow-error: oklch(0.60 0.20 25 / 0.35);
--facility-node-idle: color-mix(in oklch, var(--card) 40%, transparent);
--facility-node-active: color-mix(in oklch, var(--primary) 8%, var(--card));
--facility-arc-speed: 2.4s;
--facility-pulse-speed: 1.8s;
```

### 6.4 Scene container rules

- **Desktop (≥1280px):** Scene min-height `70vh`, aspect-ratio `16/10`, nodes absolutely positioned
- **Tablet (768–1279px):** Scene becomes `12/10`, CEO moves to top-center, labs in 2×4 grid below Brain
- **Mobile (&lt;768px):** Scene collapses to **vertical facility stack** — Brain → CEO → lab cards (no arcs)

---

## 7. Data Model Mapping

### 7.1 Unified view model

```ts
/** Primary aggregate — served by GET /api/command-center */
interface CommandCenterData {
  workspace: { id: string; name: string };
  telemetry: CommandCenterTelemetry;
  brain: BrainCoreState;
  ceo: CeoCoreState;
  labs: Record<LabId, LabState>;
  connections: DataFlowEdge[];
  goals: GoalProgressState[];
  events: IntelligenceEvent[];   // last N Brain events
  refreshedAt: string;
}

type LabId = Exclude<AgentId, "ceo">;
// Labs: research | designer | content | image | marketing | shopify
```

### 7.2 Source mapping

| View field | Source | Transform |
|------------|--------|-----------|
| `telemetry.activeExecutions` | `CeoDashboardData.summary.execution.activeExecutions` | direct |
| `telemetry.pendingReview` | `summary.execution.pendingReview` | direct |
| `telemetry.completedToday` | `summary.execution.completedToday` | direct |
| `telemetry.failedTasks` | `summary.execution.failedTasks` | direct |
| `brain.totalRecords` | Brain search / domain counts | new: `getBrainStats()` |
| `brain.syncScore` | Derived from domain freshness | new |
| `brain.assembling` | `context.assembled` event in last 30s | event-driven |
| `ceo.activeGoal` | Latest `ceo-goal` parent task | `goal-synthesis.ts` |
| `ceo.latestFinalReport` | `CeoDashboardData.latestFinalReport` | direct |
| `ceo.delegationInFlight` | Parent goal with any child `in_progress` | derived |
| `labs[id].agentStatus` | `AGENT_CATALOG[id].status` + live task presence | merge |
| `labs[id].currentTask` | `byAgent[id][0]` where status ∈ active | highest priority |
| `labs[id].currentReport` | `getReportsForTasks` for active task | linked |
| `labs[id].executionState` | Task status + execution events | see §7.3 |
| `labs[id].reviewState` | Report status if task in `review` | see §7.4 |
| `goals[]` | All parent `ceo-goal` tasks + `GoalSynthesisContext` | `goal-synthesis.ts` |
| `events[]` | Brain events: task.*, report.*, ceo.final_report.* | new stream endpoint |

### 7.3 Lab execution state machine

```
                    ┌──────────┐
               ┌───▶│   IDLE   │◀────────────────┐
               │    └────┬─────┘                 │
               │         │ task assigned         │ completed / failed
               │         ▼                       │
               │    ┌──────────┐                 │
               │    │  QUEUED  │ (pending/assigned)│
               │    └────┬─────┘                 │
               │         │ execution started     │
               │         ▼                       │
               │    ┌──────────┐   auto-exec      │
               │    │ EXECUTING│◀──research/design/marketing
               │    └────┬─────┘                 │
               │         │ report generated      │
               │         ▼                       │
               │    ┌──────────┐                 │
               │    │  REVIEW  │ (report pending_review)
               │    └────┬─────┘                 │
               │         │ human action          │
               │         ▼                       │
               │    ┌──────────┐                 │
               └───▶│ APPROVED │─────────────────┘
                    └──────────┘

     MANUAL_WAIT ── content/image/shopify when task assigned but no auto-exec
     ERROR ──────── task.failed or task.execution.failed
```

**Visual mapping:**

| State | Node glow | Ring | Connection |
|-------|-----------|------|------------|
| `IDLE` | dim | gray | static |
| `QUEUED` | soft pulse | blue | slow dash |
| `EXECUTING` | bright pulse | amber | animated flow → next lab |
| `REVIEW` | purple breathe | purple | hold at lab |
| `APPROVED` | green flash → fade | green | flow to downstream |
| `MANUAL_WAIT` | amber dotted | amber | dashed to CEO |
| `ERROR` | red strobe (subtle) | red | none |

### 7.4 Review state mapping

| Report status | Lab review chip | HUD effect |
|---------------|-----------------|------------|
| `draft` | "Draft" | none |
| `pending_review` | "Awaiting founder" | telemetry +1 review |
| `approved` | "Approved" | green arc tick |
| `rejected` | "Rejected" | red alert pulse |
| `revision_requested` | "Revision" | amber attention |

### 7.5 Connection edge model

```ts
interface DataFlowEdge {
  id: string;
  from: LabId | "brain";
  to: LabId | "ceo" | "brain";
  kind: "pipeline" | "report-up" | "context";
  active: boolean;          // true when upstream task in_progress
  payloadLabel?: string;    // e.g. "Trend brief → Design"
  lastActivityAt?: string;
}

// Pipeline edges (animate on activity):
// research → designer → marketing → content → image
// All labs → ceo (report-up)
// All labs ↔ brain (context)
```

### 7.6 API design (new)

```
GET  /api/command-center          → CommandCenterData (aggregate)
GET  /api/command-center/events   → SSE or WebSocket Brain event stream
POST /api/command-center/delegate → thin wrapper → /api/ceo/delegate
```

**Aggregate implementation:** Compose existing `getCeoDashboardData()` + `getBrainStats()` + `listRecentBrainEvents()` — no new persistence.

---

## 8. Visual States

### 8.1 Node visual anatomy

```
        ╭────────────────╮
        │   ActivityRing │  ← execution progress (SVG)
        │  ┌──────────┐  │
        │  │  Lab Icon │  │  ← Lucide icon from AGENT_CATALOG
        │  └──────────┘  │
        │   Lab Label    │
        │  ┌──────────┐  │
        │  │ Task chip │  │  ← truncated current task title
        │  │ Report    │  │  ← status badge
        │  └──────────┘  │
        ╰────────────────╯
              ▼ glow halo (CSS box-shadow + blur)
```

### 8.2 Brain Core states

| State | Trigger | Visual |
|-------|---------|--------|
| `steady` | Default | Slow radial breathe, gold |
| `syncing` | Record writes in last 10s | Faster pulse, sync ring animates |
| `assembling` | `context.assembled` event | Neural filament burst (short) |
| `rich` | &gt;N knowledge entries | Brighter core, denser particle field |

### 8.3 CEO Core states

| State | Trigger | Visual |
|-------|---------|--------|
| `standby` | No active goal | Crown icon dim |
| `orchestrating` | Delegation in flight | Ring pulse, connections to active labs |
| `synthesizing` | `ceo.final_report.started` | Core spin, all lab arcs converge |
| `verdict-ready` | Final report generated | Gold banner chip, expandable |

### 8.4 Telemetry bar pulses

Replace mock `STATUS_PULSES` with live data:

| Pulse | Live source |
|-------|-------------|
| Active Operations | `activeExecutions` |
| Pending Review | `pendingReview` |
| Completed Today | `completedToday` |
| System Health | derived: failedTasks === 0 ? nominal : attention |

---

## 9. Animation System

### 9.1 Philosophy

Animations are **semantic, not decorative**. Every motion maps to system state. Prefer CSS + SVG; reach for canvas/WebGL only in Phase 4+.

### 9.2 Animation catalog

| ID | Element | Technique | Duration | Trigger |
|----|---------|-----------|----------|---------|
| `node-glow-pulse` | Lab node halo | CSS `@keyframes` opacity + scale | 1.8s loop | `EXECUTING` |
| `node-breathe` | Brain core | CSS radial-gradient shift | 4s loop | always |
| `arc-flow` | Connection arc | SVG `stroke-dashoffset` | 2.4s loop | `edge.active` |
| `arc-spawn` | New connection | SVG path draw-on | 600ms once | task assigned |
| `approval-flash` | Lab node | CSS background flash | 400ms once | report approved |
| `delegate-ripple` | Brain core | Expanding ring | 800ms once | delegation POST success |
| `ticker-scroll` | Intelligence feed | CSS translateX | 30s loop | always |
| `drawer-slide` | Lab detail | CSS transform | 300ms | lab click |
| `telemetry-count` | Number change | CSS counter or FLIP | 200ms | data refresh |

### 9.3 Performance rules

- Use `will-change: transform, opacity` only on actively animating nodes
- Pause arc animations when `document.hidden` or `prefers-reduced-motion`
- Cap simultaneous glowing nodes at 3 (priority: executing &gt; review &gt; queued)
- Scene renders static SVG arcs; only `stroke-dashoffset` animates (GPU-friendly)
- Event stream batches UI updates at 500ms (avoid flicker on rapid events)

### 9.4 Reduced motion

```ts
// Respect prefers-reduced-motion:
// - Replace pulses with static border colors
// - Replace arc flow with solid highlighted stroke
// - Disable particle field
```

---

## 10. Responsive Strategy

### 10.1 Breakpoint modes

| Breakpoint | Layout mode | Scene | HUD |
|------------|-------------|-------|-----|
| ≥1440px | **Full Facility** | Spatial 16:10, all arcs | Full telemetry + side goal panel |
| 1280–1439px | **Compact Facility** | Spatial 16:10, shorter arcs | Goal panel collapses to chip |
| 768–1279px | **Orbital Grid** | Brain center, labs in ring grid | Ticker + dock stack |
| &lt;768px | **Facility Stack** | Vertical lab cards | Bottom dock, swipe goal sheet |

### 10.2 Mobile lab card (stack mode)

Each lab renders as a compact card (not spatial node):

```
┌─────────────────────────────────────┐
│ 🔍 Research Lab          ● Executing│
│ Task: Q2 competitor drop analysis     │
│ Report: Trend brief — pending review  │
│ ████████░░ 80%                        │
└─────────────────────────────────────┘
```

Connections become **chevron pipeline indicators** between cards:

`Research → Design → Marketing → Content → Image`

### 10.3 Touch interactions

- Tap lab → bottom sheet (not side drawer)
- Long-press lab → quick actions (run, view report, open agent page)
- Swipe ticker → pause scroll

---

## 11. Wireframe Concepts

### 11.1 Desktop — Full Facility (primary)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ NEXHQ COMMAND CENTER · Milaene    [3 Active] [2 Review] [0 Failed] [✓]  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                          ┌─────────────┐                                 │
│                          │  👔 CEO     │                                 │
│                          │  Core       │                                 │
│                          └──────┬──────┘                                 │
│                                 │                                        │
│     ┌──────────┐                │                ┌──────────┐          │
│     │ Research │~~~~~~~~~~~~~~~~│~~~~~~~~~~~~~~~~│  Image   │          │
│     │   Lab    │~              │              ~│   Lab    │          │
│     └────┬─────┘ ~             │             ~ └──────────┘          │
│          │       ~              │              ~                       │
│          │        ╔═════════════╧═════════════╗                        │
│          │        ║      🧠 BRAIN CORE         ║                        │
│          │        ║   847 entries · 94% sync    ║                        │
│          │        ╚═════════════╤═════════════╝                        │
│          │                      │                                       │
│     ┌────▼─────┐          ┌─────▼─────┐                                │
│     │ Shopify  │          │  Design   │──────┐                         │
│     │   Lab    │          │    Lab    │      │                         │
│     └──────────┘          └───────────┘      │                         │
│                          ┌───────────┐  ┌────▼─────┐                     │
│                          │ Marketing │  │ Content  │                     │
│                          │    Lab    │──│   Lab    │                     │
│                          └───────────┘  └──────────┘                     │
│                                                                          │
│  ┌─ Goal: SS26 Capsule Launch ────────────────────── 66% ─────────────┐  │
│  │  ✓ Research  ✓ Design  ○ Marketing  · Final report pending      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ◀ [Trend brief ready] [Design approved] [CEO synthesizing…] [Review] ▶ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  ⌘  Launch SS26 capsule research and design directions…    [Send]│  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Lab Detail Drawer (on click)

```
┌─ Design Lab ────────────────────────────────── ✕ ─┐
│  Status: EXECUTING                                │
│  ┌─────────────────────────────────────────────┐  │
│  │ Current Task                                │  │
│  │ Hero hoodie mood boards                     │  │
│  │ Priority: high · Assigned 12m ago           │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │ Current Report                              │  │
│  │ SS26 Design Direction — draft               │  │
│  │ [Preview]  [Open in Reports]                │  │
│  └─────────────────────────────────────────────┘  │
│  Execution Timeline                               │
│  ● assigned ── ● started ── ○ review ── ○ done   │
│                                                   │
│  [Open Agent Page]  [Trigger Run]                 │
└───────────────────────────────────────────────────┘
```

### 11.3 Delegation in progress

```
Brain Core: SYNCING (ripple)
CEO Core: ORCHESTRATING (bright)
Research Lab: EXECUTING (glow + arc to Design)
Design Lab: QUEUED (soft pulse)
Connection research→design: ANIMATED FLOW
Command Dock: disabled with "Deploying agents…"
```

### 11.4 Review moment

```
Marketing Lab: REVIEW (purple breathe)
Telemetry: [2 Review] pulse attention
Ticker: "Marketing campaign plan awaiting founder review"
Quick Review CTA appears in Command Dock
```

---

## 12. Future Expansion Path

### 12.1 V1.1 — Realtime

- Supabase Realtime subscription on Brain events table
- `useBrainEventStream()` → live node updates without polling
- Connection arcs react to events within &lt;1s

### 12.2 V1.2 — Multi-goal

- Multiple parent `ceo-goal` tasks visible as goal tabs
- Scene highlights labs relevant to selected goal only
- Goal switcher in HUD

### 12.3 V2 — 3D Facility

- WebGL/Three.js optional scene (toggle in settings)
- True orbital camera, depth parallax
- VR/ultrawide layout mode

### 12.4 V2 — Lab interiors

- Click lab → transition to full-screen "lab interior" (not just drawer)
- Each interior uses existing agent interface components
- Breadcrumb: Command Center → Design Lab → Task

### 12.5 V2 — Cross-workspace

- Workspace switcher updates entire scene topology
- Per-workspace lab enablement (e.g. Shopify only for commerce workspaces)

### 12.6 V3 — Autonomous mode

- CEO auto-delegates from scheduled goals
- Command Center shows autonomous loop indicator
- Human approval gates highlighted as "founder decision points"

### 12.7 Extensibility: adding a new lab

1. Add agent to `AGENT_CATALOG`
2. Add node position to `FACILITY_LAYOUT`
3. Add pipeline edge to `DATA_FLOW_GRAPH`
4. Add `LabState` mapping in aggregate API
5. Add lab card + drawer + i18n strings

No scene rewrite required — layout is data-driven.

---

## 13. Implementation Phases

### Phase 0 — Design & contracts (current)

- [x] Architecture document
- [x] Wireframe concepts
- [x] Data model mapping
- [ ] Design review with founder
- [ ] Type contracts in `lib/command-center/types.ts` (no UI yet)

### Phase 1 — Data foundation

**Goal:** Live data behind the facility, no spatial UI yet.

- Create `GET /api/command-center` aggregate endpoint
- Implement `getBrainStats()` helper
- Define `CommandCenterData` types
- Replace mock `STATUS_PULSES` / `AGENT_LIVE_STATUS` with live data in existing components (bridge step)
- Unit tests for state derivation (execution/review mapping)

**Exit criteria:** API returns correct lab states for a delegated goal; existing CEO dashboard data matches.

### Phase 2 — Static facility scene

**Goal:** Spatial layout with real data, minimal animation.

- `CommandCenterScene` with positioned nodes (CSS absolute)
- `BrainCoreNode`, `CeoCoreNode`, `LabNode` shells
- `ConnectionLayer` static SVG arcs
- `StatusTelemetryBar` wired to live telemetry
- `LabDetailDrawer` on click
- Replace `app/(dashboard)/page.tsx` composition

**Exit criteria:** `/` shows spatial facility with correct per-lab states; click opens drawer.

### Phase 3 — Activity & command layer

**Goal:** Jarvis feel — glow, flow, delegate.

- Animation catalog (§9.2) for executing/review/approval states
- `CommandDock` wired to `POST /api/ceo/delegate`
- `GoalTrackerPanel` with synthesis progress
- `IntelligenceTicker` from recent Brain events
- `SuggestedActionChips` wired to real counts
- `prefers-reduced-motion` support

**Exit criteria:** Delegating a goal from `/` animates nodes; approval updates scene within one refresh.

### Phase 4 — Realtime & polish

**Goal:** Mission control live ops.

- Brain event stream (SSE or Supabase Realtime)
- Debounced scene updates
- Mobile facility stack layout
- Performance audit (LCP, animation FPS)
- i18n strings (de + en)
- Remove deprecated mock command-center data

**Exit criteria:** Scene updates on task/report events without manual refresh; mobile usable.

### Phase 5 — Deprecation & unification

**Goal:** Single source of truth.

- CEO dashboard embedded view becomes "ops detail" link, not duplicate
- Deprecate `lib/mock/command-center.ts` static seeds
- Update `AGENT_CATALOG` statuses to reflect live agents
- Documentation update in `docs/architecture.md`

---

## 14. Recommended Build Order

Build vertically by **risk reduction** — data first, then structure, then motion.

```
Week 1 — Data & API
  1. lib/command-center/types.ts
  2. lib/command-center/state.ts        (derive LabState from tasks/reports)
  3. lib/command-center/aggregate.ts   (compose getCeoDashboardData + brain stats)
  4. app/api/command-center/route.ts
  5. Tests for state derivation

Week 2 — Scene skeleton
  6. lib/command-center/layout.ts     (node positions per breakpoint)
  7. components/command-center/facility-surface.tsx
  8. components/command-center/scene/command-center-scene.tsx
  9. components/command-center/nodes/{brain,ceo,lab}-node.tsx
  10. components/command-center/connections/data-flow-arc.tsx
  11. Wire page.tsx

Week 3 — HUD & interaction
  12. status-telemetry-bar.tsx
  13. goal-tracker-panel.tsx
  14. lab-detail-drawer.tsx
  15. command-dock.tsx (delegate)
  16. intelligence-ticker.tsx

Week 4 — Motion & realtime
  17. Animation hooks + reduced-motion
  18. Event stream endpoint + useCommandCenterStream()
  19. Responsive stack layout
  20. i18n + cleanup mocks
```

### Critical path dependencies

```
types → state derivation → API → scene layout → nodes → connections
                                              ↘ HUD components
                                              ↘ animations (after nodes)
                                              ↘ realtime (after API stable)
```

### Do NOT build yet (deferred)

- WebGL / Three.js scene
- Full lab interior transitions
- Multi-goal tabs
- Autonomous scheduling UI
- Custom particle engine

---

## 15. File Structure (planned)

```
lib/command-center/
  types.ts              # CommandCenterData, LabState, edges
  layout.ts             # Node positions per breakpoint
  state.ts              # Derive execution/review states
  aggregate.ts          # getCommandCenterData()
  connections.ts        # DATA_FLOW_GRAPH edges
  events.ts             # Map BrainEvent → IntelligenceEvent

app/api/command-center/
  route.ts              # GET aggregate
  events/route.ts       # SSE stream (Phase 4)

components/command-center/
  facility-surface.tsx
  scene/
    command-center-scene.tsx
    facility-backdrop.tsx
    connection-layer.tsx
  nodes/
    brain-core-node.tsx
    ceo-core-node.tsx
    lab-node.tsx
    node-shell.tsx
    activity-ring.tsx
  hud/
    status-telemetry-bar.tsx
    goal-tracker-panel.tsx
    command-dock.tsx
    intelligence-ticker.tsx
  detail/
    lab-detail-drawer.tsx
    execution-timeline.tsx
  hooks/
    use-command-center-data.ts
    use-command-center-stream.ts

lib/i18n/locales/de/command-center.ts
```

---

## 16. Success Metrics

| Metric | Target |
|--------|--------|
| Time to first operational glance | &lt;3s on `/` |
| Data freshness | &lt;2s with realtime (Phase 4) |
| Delegation from Command Center | Goal → visible lab activity without navigation |
| Mock data remaining | 0 static pulses/feed items |
| Mobile usability | All lab states visible in stack mode |
| Performance | Scene LCP &lt;2.5s; no layout shift on event update |

---

## 17. Open Questions (for design review)

1. **CEO position:** Ring above Brain (recommended) vs. CEO at center with Brain as background?
2. **Shopify lane:** Parallel outer node or integrated into commerce flow from Content?
3. **Sound:** Subtle audio cues on delegation complete / review needed? (default: off)
4. **Dark-only:** Facility designed for dark mode first, or dual theme from day one?
5. **Founder approval:** Should review actions live in drawer, or always redirect to `/reports`?

---

## 18. Relationship to Existing Docs

| Doc | Relationship |
|-----|--------------|
| `docs/architecture.md` | Update Presentation Layer section after Phase 2 |
| `docs/hq-os-future.md` | Command Center V1 = Stage 1 visual realization |
| `docs/data-flow.md` | Connection edges visualize this flow |
| `docs/agents.md` | Labs map 1:1 to agent catalog |

---

*End of design document. Ready for founder review before Phase 1 implementation.*
