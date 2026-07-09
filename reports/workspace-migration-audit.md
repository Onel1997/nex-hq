# NexHQ Workspace-First Migration Audit

**Date:** 2026-06-08  
**Scope:** Full codebase audit for `Milaene`, `milaene`, `MILAENE`, and `fashion_hq`  
**Goal:** Separate platform identity (NexHQ) from workspace identity (Milaene, NexTrends, NexAgency)

---

## Migration Summary

| Category | Count | Action |
|----------|-------|--------|
| Intentional workspace data | 8 | Kept as-is |
| Platform industry pack (`fashion_hq`) | 12 | Kept as-is (not workspace identity) |
| Documentation only | 9 | Kept as-is |
| Platform bugs (fixed) | 5 | Resolved in this migration |
| Platform bugs (remaining) | 0 | — |

---

## Changes Applied

### CEO Agent prompt (`lib/i18n/locales/de/ceo.ts`)

**Before:**  
`Du bist der CEO-Agent für NexHQ — die strategische Intelligenzschicht, die den Gründer des Milaene-Workspaces berät.`

**After:**  
`Ich bin der CEO-Agent von NexHQ. Der aktuell aktive Workspace ist: {workspaceName}.`

Workspace name is injected at runtime from `ensureWorkspaceBrainSeeded()` → `runCeoChat({ workspaceName })`.

### UI copy (`lib/i18n/locales/de/dashboard.ts`, `platform.ts`, `common.ts`)

| Key | Before | After |
|-----|--------|-------|
| `dashboard.command.placeholder` | Stelle Fragen zu Unternehmen… | Stelle Fragen zum aktiven Workspace… |
| `dashboard.team.description` | …auf deine Marke ausgerichtet | …auf den aktiven Workspace ausgerichtet |
| `dashboard.brainViz.title` | Das Herz deiner Marke | Wissensspeicher von {workspace} |
| `dashboard.command.activeWorkspace` | — | Aktiver Workspace: {workspace} |
| `dashboard.command.ceoAgentForWorkspace` | — | CEO-Agent · {workspace} |

### Workspace awareness in UI

| Surface | Implementation |
|---------|----------------|
| Dashboard hero | `{workspace.name}` via `useWorkspace()` (existing) |
| Dashboard header (home) | `NexHQ · {workspace.name}` |
| Command Center | Active workspace label above chat input |
| CEO chat responses | Header shows `CEO-Agent · {workspace}` |
| Brain visualization | Title interpolates workspace name |
| Brain / Agents pages | `ActiveWorkspaceBadge` component |
| Sidebar | `{platform.name}` + `{workspace.name}-Workspace` (existing) |
| Settings | Workspace name from `useWorkspace()` (existing) |

---

## Remaining References — Classified

### Intentional workspace data (do not remove)

| File | Reference | Classification |
|------|-----------|----------------|
| `brain/workspaces/milaene/config.ts` | `WORKSPACE_NAME = "Milaene"`, `slug: "milaene"`, `MILAENE_WORKSPACE` | Intentional workspace data |
| `brain/workspaces/milaene/index.ts` | `export { MILAENE_WORKSPACE }` | Intentional workspace data |
| `brain/workspaces/milaene/seed-data.ts` | Fashion HQ seed content scoped via `{name}` param | Intentional workspace data |
| `brain/workspaces/registry.ts` | `MILAENE_WORKSPACE` registry entry | Intentional workspace data |

### Platform industry pack — not workspace identity

| File | Reference | Classification |
|------|-----------|----------------|
| `brain/platform/industries.ts` | `fashion_hq` industry pack definition | Platform industry taxonomy |
| `brain/registry/domain-registry.ts` | `industryPacks: ["fashion_hq", …]` | Platform domain-to-industry mapping |
| `brain/workspaces/milaene/config.ts` | `industryId: "fashion_hq"` | Workspace → industry pack link |
| `brain/workspaces/milaene/seed-data.ts` | `industry: "fashion_hq"` in company profile | Workspace seed metadata |

### Documentation only

| File | Reference | Classification |
|------|-----------|----------------|
| `README.md` | Milaene listed as example workspace | Documentation only |
| `brain/README.md` | Workspace registry table row for `milaene` | Documentation only |
| `docs/vision.md` | Architecture diagram with `milaene` | Documentation only |
| `docs/hq-os-future.md` | Multi-workspace architecture examples | Documentation only |
| `docs/brain.md` | `fashion_hq` industry enum example | Documentation only |

### Platform bugs — fixed in this migration

| File | Issue | Resolution |
|------|-------|------------|
| `lib/i18n/locales/de/ceo.ts` | CEO prompt implied fixed Milaene workspace | Dynamic `{workspaceName}` intro |
| `lib/i18n/locales/de/dashboard.ts` | Generic copy without workspace context | Workspace-aware placeholder and labels |
| `components/dashboard/ai-command-interface.tsx` | Command Center showed no active workspace | Added workspace label + CEO header |
| `components/layout/dashboard-header.tsx` | Home dashboard hid workspace name | Shows `NexHQ · {workspace}` |
| `components/dashboard/brain-visualization.tsx` | Static “deiner Marke” title | Interpolates `{workspace}` |

### Platform bugs — remaining

None identified. All runtime UI and agent paths resolve workspace from `NEXHQ_WORKSPACE_SLUG` / `NEXT_PUBLIC_NEXHQ_WORKSPACE_SLUG` via `getActiveWorkspace()`.

---

## Architecture Verification

```
Platform (NexHQ)
├── CEO Agent, Research Agent, agent catalog
├── Brain infrastructure, industry packs (fashion_hq, agency_hq, …)
└── Shared UI shell (sidebar, command center, i18n)

Workspace (resolved at runtime)
├── Milaene      → fashion_hq  (seeded)
├── NexTrends    → trend pack  (config only)
└── NexAgency    → agency pack (config only)
```

**Env vars:** `NEXHQ_WORKSPACE_SLUG` (server), `NEXT_PUBLIC_NEXHQ_WORKSPACE_SLUG` (client)

**Resolution chain:** `getActiveWorkspaceSlug()` → `getWorkspaceConfig()` → `WorkspaceDefinition.name`

---

## Mock / Demo Data Note

Dashboard mock content (`lib/i18n/locales/de/dashboard.ts` pulses, intelligence feed, suggested actions) contains fashion-industry demo copy (SS26, Capsule, Streetwear signals). This is **workspace-scoped demo content** for the Milaene fashion pack, not platform identity. Future work: load demo content from active workspace seed or industry pack instead of hardcoded locale strings.
