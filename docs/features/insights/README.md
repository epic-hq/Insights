# Insights (Themes) Feature

Insights are project-level thematic groupings derived from evidence extracted from interview transcripts. They represent patterns, pain points, and user needs discovered across conversations.

## Documentation

| Document | Description |
|----------|-------------|
| [PRD.md](./PRD.md) | Product requirements, user flows, and acceptance criteria |
| [technical-design.md](./technical-design.md) | Architecture, data flow, and implementation details |
| [status.md](./status.md) | Current implementation status and known issues |

## Quick Links

- **Source Code**: `app/features/insights/`
- **Themes Source**: `app/features/themes/`
- **Database Schema**: `supabase/schemas/33_themes.sql`
- **BAML Contracts**: `baml_src/auto_group_themes.baml`, `baml_src/extract_insights.baml`
- **Trigger Tasks**: `src/trigger/interview/v2/generateInsights.ts`, `src/trigger/enrich-themes.ts`

## Data Model Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Interview  │────▶│     Evidence     │────▶│   Themes    │
│             │     │  (verbatim quotes)│     │ (Insights)  │
└─────────────┘     └──────────────────┘     └─────────────┘
                            │                       │
                            └───────────────────────┘
                              theme_evidence junction
```

## Key Concepts

- **Themes** = **Insights**: These terms are used interchangeably. The database table is `themes`, but the UI often calls them "Insights"
- **Evidence**: Verbatim quotes extracted from interviews with timestamps
- **theme_evidence**: Junction table linking themes to their supporting evidence
- **Enrichment**: Adding metadata (pain, jtbd, category) to themes via AI
- **Consolidation**: Merging similar themes across interviews

## Status: Active Development

The insights system has two generation paths:
1. **Per-Interview**: Themes generated during interview processing (v2 orchestrator)
2. **Project-Wide Consolidation**: Merge similar themes across all interviews (AutoGroupThemes)
