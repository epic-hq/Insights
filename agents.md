
# Agents.md also for use by claude.ai (consider this claude.md)

## Code conventions

Tech stack includes ReactJS, typescript, vite, remix / react-router, supabase, zod, zustand, dotenvx for secrets. The production app is deployed to fly.io, cloudflare r2 storage for media. LivekitServer is hosted on fly.io as well providing rooms.

We leverage remix conventions like loaders and actions for apis, and store code in the app/feature directory, colocating components, pages, routes and db functions. APIs are ideally here as well, but many currently live in app/routes. We can migrate those later.

HTML/CSS we use tailwindcss, shadcnui and themes.

- supabase we use declarative schemas in supabase/schemas, and implement here first, then generate migrations. See `docs/supabase-howto.md` for the process, and be sure to generate types after changing db.
- React-router does not export JSON. and we don't need to wrap it in a response. we can just return the data and it will be serialized automatically.
- do not use console.log, use consola.log instead and `import consola from "consola"`
when making database changes, use the supabase declarative schema approach, and edit supabase/schemas/ file instead of creating a migration directly. Follow the process [here](`docs/@supabase/howto/declarative-schemas.md`)

When designing or architecting a new feature, or fixing a bug, consult relevant documents in `docs/` for additional context and best practices relevant to this repo.

## Plan (todos)

[ ] Persona Facet Summaries - summarize facet group takeaways atop an accordion

[ ] Implement livekit-agent and token generator in backend, and livekit-web agent in front end e.g. projectStatusAgent for when user wants to talk to agent.

## Recent Implementations

### Task System (Nov 2024) ✅ **Phase 2 Complete**
Unified task/feature management system for project prioritization and execution.

**Completed:**
- ✅ Database schema with 3 tables: `tasks`, `task_activity`, `agent_task_runs`
- ✅ Full CRUD operations in `app/features/tasks/db.ts`
- ✅ RESTful API at `/api/tasks` with filters and bulk operations
- ✅ Auto-seeding from mock data on first load
- ✅ Priorities page reads from database via loader with inline editing
- ✅ Inline editing for all task fields (status, priority, title, description, impact, stage, etc.)
- ✅ Remix action handlers for CRUD operations
- ✅ Optimistic UI updates for instant feedback
- ✅ Sort indicators on columns (priority, impact, feature)
- ✅ Cluster filtering and grouping with user-controlled expansion
- ✅ Free-form stage field (removed database constraint)
- ✅ **ProjectStatusAgent CRUD tools** - Agent can create, read, update, and delete tasks via voice/chat

**Agent Integration Complete:**
- `fetchTasks` - List/search tasks with filters
- `createTask` - Create new tasks with full field support
- `updateTask` - Modify existing tasks (status, priority, etc.)
- `deleteTask` - Archive tasks

**Next Steps:**
- Agent assignment and execution tracking (agent_task_runs integration)
- Task detail modal with full metadata and activity history
- Voice commands for bulk task operations
- Task dependencies and blocking relationships UI

See `docs/features/task-system-technical-design.md` for full implementation details.


## Refactoring

[ ] Refactor the monolithic processInterviewServer.ts into smaller src/trigger task files

[ ] Refactor out research_goal_details from rest of code, in favor of ad-hoc project_section kinds on demand.

[ ] Fully remove `research_goal_details` across app/routes, BAML schemas, onboarding flows, and project section loaders once higher-priority onboarding changes land.
[ ] Break `app/utils/processInterview.server.ts` into modular Trigger.dev tasks under `src/trigger/interviews/*` (see `docs/refactoring/interview-processing-optimization.md` and `docs/interview-processing-flows.md` for the staged plan) so we can share the pipeline with regeneration + batch jobs.