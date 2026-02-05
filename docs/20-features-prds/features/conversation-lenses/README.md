# Conversation Lenses Feature

Apply structured analytical frameworks to interview conversations for extracting specific insights.

## Documentation

| Document | Description |
|----------|-------------|
| [PRD.md](./PRD.md) | Product requirements, user flows, and acceptance criteria |
| [technical-design.md](./technical-design.md) | Architecture, BAML contracts, and implementation phases |
| [mvp-plan.md](./mvp-plan.md) | MVP scope and completion status |
| [status.md](./status.md) | Current implementation status and progress |

## Quick Links

- **Source Code**: `app/features/lenses/`
- **Database Schema**: `supabase/migrations/20251202140000_conversation_lenses.sql`
- **BAML Contracts**: `baml_src/apply_conversation_lens.baml`, `baml_src/synthesize_cross_lens.baml`
- **Trigger Tasks**: `src/trigger/lens/applyLens.ts`, `src/trigger/lens/synthesizeCrossLens.ts`

## Status: Analysis Page Live

The lens system includes per-interview analysis and a project-wide Analysis page:

- 6 system lens templates (Project Research, Customer Discovery, Sales BANT, etc.)
- Auto-application after interview finalization
- **Analysis page** (`/lenses`) with three tabs: Overview, By Person, By Lens
- **Cross-lens synthesis** — AI-generated executive briefing combining all lens results
- Per-person consolidated results with drill-down sheets
- Template management via settings dialog
- Inline editing of text fields
- Evidence timestamp badges with media navigation
- Generic rendering from template definitions
