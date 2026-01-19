# Current Work

Tactical work tracking. For code conventions, see `CLAUDE.md`. For product roadmap, see `docs/plan.md`.

## Now

### Sidebar UX Improvements (Jan 2025)
See `docs/20-features-prds/features/onboarding/sidebar-ux-analysis.md`

- [x] **P0**: Fix disabled links - Collect/Learn no longer render as `<Link>` when disabled
- [x] **P1**: Suppress main nav during onboarding - show only Journey group until Plan complete
- [x] **P1**: Context-aware CTA - "Continue setup" during onboarding, "Add content" after
- [ ] **P2**: Add progress indicator ("Step 2 of 4") in Journey group
- [ ] **P2**: Group main nav by workflow (Input, Analysis, Action)

### Insights & Theme Consolidation
- [ ] Lower evidence linking threshold if too many themes get 0 links (currently 0.4)
- [ ] Add "Expand All / Collapse All" toggle for evidence accordions on insight detail

## Next

- [x] **Public Link Sharing** - Enable unauthenticated access via unique tokens ✅
- [x] **Custom Lenses v1** - User-created lenses ✅
- [x] LiveKit agent + token generator for projectStatusAgent voice ✅
- [ ] Persona Facet Summaries - summarize facet group takeaways atop an accordion

## Later / Refactoring

- [ ] Refactor `processInterviewServer.ts` into smaller `src/trigger/` task files
- [ ] Remove `research_goal_details` in favor of ad-hoc `project_section` kinds
- [ ] Ship R2 upload progress UI with percent + cancel support

## Recently Completed

### Research Links Chat Mode Fixes (Jan 2025) ✅
- Fixed tool signatures to use `execute: async (input)` pattern with responseId/slug as input params
- Created shared db functions in `app/features/research-links/db.ts` (saveResearchLinkAnswer, markResearchLinkComplete)
- Fixed agent repeating itself by sending full message history (no memory system)
- Added signup CTA in chat completion encouraging getupsight.com/sign-up
- Added "Review your answers" button on form completion stage

### Task System (Nov 2024) ✅
- Database schema: `tasks`, `task_activity`, `agent_task_runs`
- Full CRUD in `app/features/tasks/db.ts`
- RESTful API at `/api/tasks`
- ProjectStatusAgent CRUD tools (fetch, create, update, delete)

### Bidirectional Theme × Segment Queries (Dec 2024) ✅
- `getTopConcernsForSegment()`, `getUsersWithThemes()`
- `getOrphanedThemes()`, `deleteOrphanedThemes()`
- Query optimizations for `generatePainMatrix` and `generatePersonas`

### Insights Consolidation RCA (Dec 2024) ✅
- Fixed auto-consolidation function mismatch
- Auto-delete orphaned themes
- Settings modal + accordion UX fixes
