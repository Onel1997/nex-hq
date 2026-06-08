# NexHQ — Platform Evolution

## Overview

**NexHQ** is the multi-workspace AI operating system. Workspaces are tenant-scoped configurations; the active workspace is resolved from `NEXHQ_WORKSPACE_SLUG`. The platform provides shared infrastructure — Brain, CEO Agent model, task/report system — with industry-specific domain packs and modules per workspace.

```
NexHQ Platform
├── milaene      (fashion_hq)
├── nex-trends   (creator_hq)
├── nex-agency   (agency_hq)
└── future …
```

---

## Platform Architecture

### Shared Infrastructure

Every NexHQ workspace gets:

| Component | Description |
|-----------|-------------|
| **NexHQ Brain** | Multi-tenant memory layer with core + industry domains |
| **CEO Agent** | Goal decomposition, task routing, report synthesis |
| **Task System** | Delegation, status tracking, approval gates |
| **Report System** | Structured agent outputs for human review |
| **Integrations** | Typed hooks to external services |

### Industry Packs

Each workspace selects an industry pack that determines available domains and modules:

| Pack | Domains | Example slug |
|------|---------|--------------|
| Fashion HQ | brand_vision, design_memory, product_memory, … | `milaene` |
| Agency HQ | client_memory, campaign_memory, … | `nex-agency` |
| Creator HQ | audience_memory, content_memory, … | `nex-trends` |
| Ecommerce HQ | catalog_memory, storefront_memory, … | — |
| SaaS HQ | product_roadmap, customer_memory, … | — |

---

## Workspace Provisioning

```
1. Select industry pack
   ├── fashion_hq → e.g. milaene
   ├── agency_hq  → e.g. nex-agency
   └── creator_hq → e.g. nex-trends

2. Create workspace row
   ├── slug: "<workspace-slug>"
   ├── name: "<display name>"
   └── enabled_domains: core + industry

3. Seed workspace records
   ├── company_profile
   ├── brand_vision
   └── brand_rules (workspace-specific)
```

Workspace seed data lives in `brain/workspaces/<slug>/`. Platform code in `brain/seed/` is workspace-agnostic.

---

## Implementation Stages

### Stage 1: NexHQ Foundation (Now)

Multi-workspace architecture with env-driven active workspace. CEO Agent advisory mode, Brain persistence, workspace seeding.

### Stage 2: Multi-Workspace UI

Workspace switcher, per-workspace context in Command Center, workspace-scoped agent runs.

### Stage 3: Additional Workspaces

NexTrends and NexAgency seed data, industry-specific agent configurations.

### Stage 4: Self-Service Provisioning

API and UI for creating new workspaces without code changes.
