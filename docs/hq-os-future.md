# HQ OS — Platform Future

## Overview

Milaene HQ is the **first implementation** of a larger platform called **HQ OS** — an AI-powered operating system for companies across multiple industries. HQ OS provides shared infrastructure (Brain, CEO Agent model, task/report system) with industry-specific domain packs and modules.

```
Today                          Future
┌──────────────┐         ┌──────────────────────────────┐
│  Milaene HQ  │   →     │          HQ OS Platform       │
│ (Fashion HQ) │         │  ┌────┐ ┌────┐ ┌────┐ ┌────┐│
│              │         │  │Fash│ │Agen│ │Crea│ │SaaS││
│  1 workspace │         │  │ ion│ │ cy │ │ tor│ │    ││
│  1 industry  │         │  └────┘ └────┘ └────┘ └────┘│
└──────────────┘         │       Shared Brain + Agents   │
                         └──────────────────────────────┘
```

---

## Platform Architecture

### Shared Infrastructure

Every HQ OS workspace gets:

| Component | Description |
|-----------|-------------|
| **Brain** | Multi-tenant memory layer with core + industry domains |
| **CEO Agent** | Goal decomposition, task routing, report synthesis |
| **Task System** | Work management and delegation |
| **Report System** | Agent output review and approval |
| **Command Center UI** | Dashboard, agents, brain, tasks, reports |
| **Integration Layer** | External API connections via Brain hooks |

### Variable Per Workspace

| Component | Configured At | Options |
|-----------|--------------|---------|
| Industry pack | Workspace provisioning | Fashion, Agency, Creator, Ecommerce, SaaS |
| Active modules | Company Profile | brain, agents, commerce, design_studio, etc. |
| Enabled domains | Auto-resolved from industry | Core + industry pack domains |
| Integrations | Company Profile | Shopify, OpenAI, social, email, etc. |
| Agent catalog | Industry-dependent | Fashion gets Designer + Shopify; SaaS gets none |

---

## Industry Packs

### Fashion HQ (Milaene — Reference Implementation)

**Target:** Apparel, streetwear, lifestyle brands.

**Domains:**
- `brand_vision` — positioning, cultural identity, audience
- `brand_rules` — voice, copy, naming guardrails
- `design_memory` — visual system, palettes, assets
- `product_memory` — products, drops, SKUs
- `content_memory` — copy templates, narratives
- `marketing_memory` — campaigns, calendars, KPIs
- `competitor_intelligence` — landscape, watchlist, signals

**Modules:** brain, agents, tasks, reports, integrations, commerce, design_studio, content_studio

**Agents:** CEO, Research, Designer, Content, Marketing, Shopify

**Use case:** Milaene streetwear — drop-led brand with visual identity, scarcity, and commerce operations.

---

### Agency HQ

**Target:** Creative agencies, marketing agencies, client-service firms.

**Domains:**
- `client_memory` — client profiles, contacts, scope, relationship history
- `campaign_memory` — campaign briefs, deliverables, budgets, timelines
- `content_memory` — shared copy and editorial assets
- `marketing_memory` — shared campaign and growth playbooks

**Modules:** brain, agents, tasks, reports, integrations, content_studio, analytics

**Agents:** CEO, Research, Content, Marketing (no Designer or Shopify)

**Use case:** An agency managing 10 clients — CEO Agent routes work per client, Client Memory keeps context isolated, Campaign Memory tracks deliverables and deadlines.

**Key difference from Fashion:** Work is organized around clients and campaigns, not products and drops. No commerce or design studio modules.

---

### Creator HQ

**Target:** Content creators, influencers, personal media brands.

**Domains:**
- `audience_memory` — audience segments, platforms, engagement profiles
- `content_memory` — shared copy and editorial assets
- `marketing_memory` — shared campaign and growth playbooks

**Modules:** brain, agents, tasks, reports, integrations, content_studio, analytics

**Agents:** CEO, Research, Content, Marketing

**Use case:** A creator planning content calendar — Audience Memory tracks platform demographics, Content Memory stores templates and past performance, Marketing Memory plans sponsorship and collaboration campaigns.

**Key difference from Fashion:** No product or design domains. Audience-centric rather than product-centric. Lighter domain set.

---

### Ecommerce HQ

**Target:** Direct-to-consumer brands, multi-channel retailers, marketplace sellers.

**Domains:**
- `catalog_memory` — product catalog, variants, pricing, inventory
- `storefront_memory` — store config, pages, theme, conversion health
- `product_memory` — shared product and commerce metadata
- `marketing_memory` — shared campaign and growth playbooks
- `competitor_intelligence` — shared competitive landscape

**Modules:** brain, agents, tasks, reports, integrations, commerce, analytics

**Agents:** CEO, Research, Content, Marketing, Shopify

**Use case:** A DTC skincare brand — Catalog Memory manages SKUs, Storefront Memory tracks conversion, Shopify Agent handles listings, no fashion-specific design or brand vision domains.

**Key difference from Fashion:** Commerce-first without fashion-specific brand/design domains. Broader retail, not streetwear-native.

---

### SaaS HQ

**Target:** Software companies, subscription products, B2B platforms.

**Domains:**
- `product_roadmap` — feature roadmap, release cadence, prioritization
- `customer_memory` — customer segments, ICP, health signals, feature requests
- `marketing_memory` — shared campaign and growth playbooks
- `competitor_intelligence` — shared competitive landscape

**Modules:** brain, agents, tasks, reports, integrations, analytics

**Agents:** CEO, Research, Content, Marketing

**Use case:** A project management SaaS — Product Roadmap tracks feature priorities, Customer Memory monitors churn signals and feature requests, Research Agent analyzes competitor product launches.

**Key difference from Fashion:** Product is software features, not physical goods. Customer health replaces inventory. No commerce or design modules.

---

## Core Domains (All Industries)

These four domains are loaded for every workspace regardless of industry:

| Domain | Purpose |
|--------|---------|
| `company_profile` | Workspace identity, industry, goals, KPIs, integrations, modules |
| `decisions` | Decision log with rationale and outcomes |
| `tasks` | Work unit memory and delegation history |
| `reports` | Agent report archive |

Company Profile is the **bootstrap record** — it defines which industry pack and modules are active, which drives everything else.

---

## Workspace Provisioning

### Flow

```
1. Admin creates workspace
   ├── slug: "milaene"
   ├── name: "Milaene"
   └── industryId: "fashion_hq"

2. System resolves enabled domains
   ├── Core: company_profile, decisions, tasks, reports
   └── Industry: brand_vision, brand_rules, design_memory, ...

3. System resolves available modules
   └── fashion_hq → brain, agents, tasks, reports, integrations,
                     commerce, design_studio, content_studio

4. Write company_profile record
   ├── companyName: "Milaene"
   ├── industry: "fashion_hq"
   ├── businessModel: "DTC streetwear, drop-led"
   ├── goals: ["4 major drops/year", "85%+ sell-through"]
   ├── kpis: [{ name: "Sell-through", target: ">85%" }]
   ├── integrations: [{ id: "shopify", status: "active" }]
   └── activeModules: ["brain", "agents", "commerce", ...]

5. Workspace ready — agents and UI scoped to enabled domains
```

### Multi-Tenancy

```
┌─────────────────────────────────────────────┐
│              HQ OS Platform                  │
│                                              │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ Workspace A │  │ Workspace B │           │
│  │ fashion_hq  │  │  agency_hq  │           │
│  │             │  │             │           │
│  │ brand_vision│  │client_memory│           │
│  │design_memory│  │campaign_mem.│           │
│  │product_mem. │  │content_mem. │           │
│  └─────────────┘  └─────────────┘           │
│                                              │
│  Shared: company_profile, decisions,         │
│          tasks, reports (per workspace)      │
└─────────────────────────────────────────────┘
```

Every Brain record carries `workspaceId`. RLS policies enforce isolation. No workspace can read another's data.

---

## Shared vs. Industry Domains

Some domains appear in multiple industry packs:

| Domain | Fashion | Agency | Creator | Ecommerce | SaaS |
|--------|---------|--------|---------|-----------|------|
| `content_memory` | ✓ | ✓ | ✓ | | |
| `marketing_memory` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `competitor_intelligence` | ✓ | | | ✓ | ✓ |
| `product_memory` | ✓ | | | ✓ | |

Shared domains use the **same content schema** across industries. The domain registry tracks which packs load each domain via `industryPacks[]`.

Adding a new industry means:
1. Define industry-specific domain content schemas
2. Add industry pack to `HQ_INDUSTRY_PACKS`
3. Register domains in `BRAIN_DOMAIN_REGISTRY`
4. Configure available modules and agents

No changes to core Brain infrastructure required.

---

## Module System

HQ OS modules are toggleable capabilities per workspace:

| Module | Description | Industries |
|--------|-------------|------------|
| `brain` | Central knowledge layer | All |
| `agents` | AI agent team | All |
| `tasks` | Work management | All |
| `reports` | Output review | All |
| `integrations` | External API connections | All |
| `analytics` | Performance dashboards | Agency, Creator, Ecommerce, SaaS |
| `commerce` | Storefront operations | Fashion, Ecommerce |
| `content_studio` | Copy and editorial tools | Fashion, Agency, Creator |
| `design_studio` | Visual design tools | Fashion |

Modules are stored in Company Profile `activeModules` and control UI visibility and agent availability.

---

## Evolution Path

### Stage 1: Milaene HQ (Now → Phase 9)

Single workspace, single industry (Fashion HQ). All development focuses on making Milaene's streetwear operations work end-to-end.

- One `workspaceId` (hardcoded or env-based)
- Fashion domain pack only
- All six agents built and tested with real drops

### Stage 2: Multi-Workspace (Phase 10 Early)

Platform supports multiple workspaces but only Fashion HQ industry pack.

- Workspace provisioning API
- Multi-tenant RLS
- Multiple fashion brands on one platform

### Stage 3: Multi-Industry (Phase 10)

Full industry pack support.

- Agency HQ, Creator HQ, Ecommerce HQ, SaaS HQ domain packs live
- Industry selection at provisioning
- Industry-specific agent catalogs
- Module toggling

### Stage 4: Platform (Post Phase 10)

HQ OS as a standalone product.

- White-label command centers
- Self-service workspace provisioning
- Marketplace for industry packs and agent templates
- Third-party integration ecosystem
- Platform admin and billing

---

## Technical Enablers (Already Built)

The following architecture decisions in the current codebase prepare for HQ OS:

| Decision | Location | HQ OS Benefit |
|----------|----------|---------------|
| Domain tiers (core vs. industry) | `brain/registry/tiers.ts` | Add industries without changing core |
| Industry pack registry | `brain/platform/industries.ts` | Declarative industry → domain mapping |
| Workspace scoping | `BrainRecord.workspaceId` | Multi-tenant isolation |
| Company Profile domain | `brain/domains/company-profile.ts` | Workspace bootstrap record |
| Module registry | `brain/platform/modules.ts` | Toggleable capabilities |
| Domain registry with `industryPacks[]` | `brain/registry/domain-registry.ts` | Shared domain tracking |
| Integration hooks | `brain/interfaces/integrations.ts` | Per-workspace integration config |
| Typed content per domain | `brain/domains/*.ts` | Industry-specific schemas |

---

## What Changes Per Industry

| Aspect | Shared (Platform) | Per Industry |
|--------|----------------|--------------|
| Brain infrastructure | ✓ | |
| Core domains | ✓ | |
| CEO Agent model | ✓ | |
| Task/Report system | ✓ | |
| Command center UI shell | ✓ | |
| Industry domains | | ✓ |
| Agent catalog | | ✓ (subset) |
| Available modules | | ✓ |
| Default integrations | | ✓ |
| UI domain browser sections | | ✓ |
| Seed data / templates | | ✓ |

---

## Adding a New Industry (Future Process)

1. **Define domains** — create content schemas in `brain/domains/`
2. **Register domains** — add to `BRAIN_INDUSTRY_DOMAINS` and `BRAIN_DOMAIN_REGISTRY`
3. **Create industry pack** — add to `HQ_INDUSTRY_PACKS` with domain list and modules
4. **Configure agents** — define which agents are available and their domain access
5. **Seed templates** — default company profile, sample records per domain
6. **UI adaptation** — Brain browser shows industry-appropriate sections
7. **Documentation** — industry-specific guide in `docs/`

No changes to BrainClient, BrainContextAssembler, or core infrastructure.

---

## Related Documentation

- [Vision](./vision.md) — product vision and north star
- [Brain](./brain.md) — Brain domain system and contracts
- [Architecture](./architecture.md) — current system architecture
- [Roadmap](./roadmap.md) — Phase 10 HQ OS deliverables
