# Milaene Brain

Shared knowledge layer for all Milaene HQ agents.

## Purpose

The Brain is the single source of truth for brand context. Every agent reads from it before acting and writes outputs back for review.

## Planned Contents

- Brand identity and voice guidelines
- Product catalog and drop history
- Audience segments and insights
- Campaign archive and content templates
- Agent-generated drafts pending approval

## Access Rules

1. Agents **read** via `BrainQuery` — never bypass this layer
2. Agents **write** drafts by default (`status: draft`)
3. Only humans or the CEO Agent (with approval) promote entries to `approved`
4. Approved entries may flow to external systems (e.g., Shopify)

## Implementation Status

**Not implemented.** Types and interface scaffold only. See `docs/roadmap.md` Phase 1.
