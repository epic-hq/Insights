# Agents Implementation Guide

This document lays out the conventions, reporting dots, and Supabase practices that every automation or feature-implementation agent should follow when touching the discovery data stack.

## 1. Canonical data paths
1. **Themes first**: All reads/writes go through `public.themes` or the compatibility views (`insights_current`, `insights_with_priority`). Use `getInsights`, `getInsightById`, or the Mastra helpers (`fetchProjectStatusContext`, `fetchThemesTool`, etc.) rather than referencing `public.insights` directly.
2. **Votes & priority**:
   - Vote counts come from `votes` (or the mapped `vote_count` your loaders surface).
   - `priority` lives in `insights_with_priority` (derived from scored votes) and should *only* influence AI/LLM suggestions, not the UI sorting/filtering.
3. **Evidence & personas**: Link evidence → people via `evidence_people` → `people_personas`, and then map into persona coverage matrices for dashboards.

## 2. Context & tooling conventions
- Always seed `account_id`/`project_id` for Supabase calls. The layout middleware now populates `currentProjectContext`, so loaders/actions can call `context.get(currentProjectContext)` and safely run `supabase` queries without passing explicit params every time.
- Prefers helper functions (e.g., `getInsights`, `getProjectStatusData`) so telemetry/integration counts stay centralized.
- When adding new SQL logic, update `supabase-howto.md` with any non-standard manual migrations or `imperative.sql` steps before calling `supabase db diff`.

## 3. Deployment & rollout
1. After schema or view changes, consult `docs/deploy-howto.md` before running `supabase db push` (the doc explains how to sequence migrations, `imperative.sql`, and type regeneration).
2. Use `pnpm typecheck` and the `mastra` workflows to validate any automations that consume `projectStatusContext` or push annotations.
3. Update `_task-board.md` with the rollout status; automation updates should call out whether the UI and docs have been synced.

## 4. Helpful references
- `docs/supabase-howto.md` – best practices for migrations, manual SQL, and type generation.
- `docs/_information_architecture.md` – keep the evidence → themes → insights mental model when designing new agents.
- `docs/deploy-howto.md` – release checklist for schema/view changes so agents know when to re-run tests/rollouts.

Add further conventions at the end of this document whenever a new pattern solidifies.
