# NexHQ Brain

Permanent memory layer and single source of truth for all NexHQ workspaces.

Each workspace scopes Brain records by `workspace_id`. Platform code is workspace-agnostic; tenant-specific seed data lives in `brain/workspaces/`.

## Workspaces

| Slug | Name | Industry | Seed status |
|------|------|----------|-------------|
| `milaene` | Milaene | Fashion HQ | Seeded |
| `nex-trends` | NexTrends | Creator HQ | Pending |
| `nex-agency` | NexAgency | Agency HQ | Pending |

Register new workspaces in `brain/workspaces/registry.ts`.

## Seeding

Set `NEXHQ_WORKSPACE_SLUG` in `.env.local`, then:

```typescript
import { ensureWorkspaceBrainSeeded } from "@/brain/seed";
import { getActiveWorkspaceSlug } from "@/lib/workspace/active";

// Active workspace from environment
await ensureWorkspaceBrainSeeded();

// Specific workspace by slug
await ensureWorkspaceBrainSeeded("nex-trends");
```

HTTP: `POST /api/brain/seed` or `POST /api/brain/seed?slug=nex-trends`
