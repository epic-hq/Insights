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
- **BAML Contracts**: `baml_src/apply_conversation_lens.baml`
- **Trigger Tasks**: `src/trigger/lens/`

## Status: MVP Complete

The MVP implementation is complete with the following capabilities:

- 6 system lens templates (Project Research, Customer Discovery, Sales BANT, etc.)
- Auto-application after interview finalization
- Tabbed UI for viewing lens analyses
- Inline editing of text fields
- Evidence timestamp badges with media navigation
- Generic rendering from template definitions
