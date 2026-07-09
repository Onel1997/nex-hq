# Reports

Structured outputs that specialist agents submit after completing tasks.

## Flow

1. Agent completes assigned task
2. Agent submits a `AgentReport` with summary, artifacts, and confidence score
3. CEO Agent reviews and synthesizes
4. Human approves, rejects, or requests revision

## Artifact Types

- `text` / `markdown` — copy, briefs, analysis
- `image` — design concepts (URL reference)
- `json` — structured data (e.g., product fields for Shopify)

## Implementation Status

**Not implemented.** Types only. See `docs/roadmap.md` Phase 2.
