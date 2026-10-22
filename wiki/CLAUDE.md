# Wiki Schema — Backslash Graph Query Engine

How the wiki is structured and what to do during each operation. Read before touching any wiki file.

## Directory layout

```
wiki/
  raw/            # Source documents — immutable. Read, never write.
  pages/
    architecture/ # Stack, module layout, request flow
    domain/       # The graph data: nodes, edges, kinds, quirks
    api/          # Endpoints, filters, response shapes
    decisions/    # Decision records (assumptions, trade-offs)
  index.md        # Master index — update on every change
  log.md          # Append-only chronological log
  CLAUDE.md       # This file
```

## Page format

```yaml
---
title: <Human-readable title>
category: architecture | domain | api | decisions
tags: [tag1, tag2]
sources: [filename or URL]
updated: YYYY-MM-DD
---
```

- `##` for top-level sections. Cross-reference with `[[page-slug]]`.
- Factual and synthesized, not a dump.
- `> ⚠️ CONFLICT:` for contradictions, `> ❓ OPEN:` for open questions.

## Operations

### Ingest
1. Source goes into `wiki/raw/`. 2. Read it. 3. Write/update pages. 4. Update `index.md`. 5. Append to `log.md`:
`## [YYYY-MM-DD] ingest | <title>` + pages created/updated.

### Query
Read `index.md` → relevant pages → answer with `([[slug]])` citations. Offer to save substantial answers as a page.
Log as `## [YYYY-MM-DD] query | <summary>`.

### Task completion
After a plan task is done: update the affected pages (what was built, decisions, limitations), update `index.md`,
log `## [YYYY-MM-DD] update | <task>`.

### Lint
On request: contradictions, stale claims, orphan pages, missing pages/cross-refs. Report as a numbered list.

## Conventions

- Slugs: lowercase-hyphen. Index line: `- [Title](pages/category/slug.md) — hook`.
- Absolute dates only. Never modify `wiki/raw/`.

## Key facts

- Exercise: [[assignment]]. Data: [[graph-data]]. Language: TypeScript (preferred by assignment).
