# Agents Planning Playbook

This file collects the actionable short list and planning signals that AI-enabled agents (CopilotKit, Mastra, etc.) should consult before taking on new work. Think of it as the `docs/_task-board.md` companion for automation: product-facing, but tuned for describing what the agents themselves can impact next.

## 1. Shortlist (near-term focus)
- [x] Finish the `themes`/insights migration: use `themes`, `insights_current`, and `insights_with_priority` as the canonical reads, keep `public.insights` read-only, and let the view drive dashboards.
- [x] Surface vote totals in the table view while keeping priority calculations separate (LLM scoring only).
- [x] Ensure annotation/vote APIs always run with `account_id`/`project_id` context (see `_CurrentProjectLayout.tsx`).
- [ ] Reconcile any UI still showing the legacy `insights` table or matrix links (only `Table` + `Cards` should remain in the Themes view).
- [ ] Finish the document vault: unify `docs/agents.md` with the new planning/implementation/vision folders so every agent starts with the same knowledge.
- [ ] Walk through `/insights`/cards data and confirm every request passes `account/project` context, even when triggered from non-theme pages.

## 2. Planning signals & readiness checks
1. **Data freshness**: Always read from `themes` and aggregate votes via `insights_with_priority` or the `votes` table (avoid direct writes to the legacy `public.insights`).
2. **Context completeness**: Validate `currentProjectContext` before firing any RPC or Supabase call. Missing `accountId` or `projectId` should abort early with a helpful message.
3. **Documentation sweep**: After each feature change, update `_task-board.md` (product decisions) and this planning document (`docs/agents/planning.md`) to note whether planning assumptions shifted.
4. **Agent-to-agent handoff**: Document any follow-up work (e.g., build evidence coverage dashboards) via new checklist items at the end of this file.

## 3. Where to look for more detail
- `_task-board.md` – product roadmap; guard rails for when automation touches UI features.
- `docs/_information_architecture.md` – explains why DQs/Research Questions map to evidence/themes; aligns your agents to the user's mental model.
- `docs/agents/implementation.md` – conventions for implementing features against `themes` and `insights_with_priority`.
