# UpSight Project - AI Context

## Core Rules

- **Verify fixes end-to-end.** Never claim something is fixed without testing it in the actual environment. Test output or it didn't happen.
- **Stay focused.** Do NOT expand scope beyond what was explicitly asked. If you notice adjacent issues, mention them briefly but do not fix them unless asked.
- **Stop and diagnose.** When a code change doesn't work on the first attempt, stop and re-examine the root cause before trying another fix. Explain your diagnosis before applying changes. Never apply more than 2 iterative fixes without pausing to reassess.
- **Check existing patterns first.** Before writing new code, check adjacent files and existing implementations. Extend what exists rather than replacing it.

---

## Tech Stack

- **TypeScript** — strict types, no `any`, use interfaces
- **React Router 7** — loaders, actions, middleware, `useFetcher`
- **Supabase** — Postgres, RLS, PostgREST, realtime
- **Tailwind CSS** + **shadcn/ui** — styling and components
- **Trigger.dev v4** — background tasks
- **BAML** — AI prompt definitions
- **Mastra** — AI agent orchestration
- **Vite** — build tooling

---

## Debugging Guidelines

### Test-Driven Bug Fixing

When fixing bugs, follow this exact process:

1. Read the relevant source files to understand the current behavior
2. Write a failing test that reproduces the bug (vitest for unit/integration, Playwright for E2E)
3. Run the test to confirm it fails for the right reason
4. Implement the minimal fix
5. Run the FULL test suite to catch regressions
6. Iterate until ALL tests pass
7. Only then present the changes

Do NOT claim something works without test output proving it.

---

## Project Overview

UpSight is a conversation-first, AI-native CRM/customer intelligence platform that turns customer conversations into **evidence you can verify** ("receipts") and insights your whole team can search, share, and act on.

Key capabilities:

- **Evidence ("receipts")**: AI-identified quotes/moments with attribution and timestamps
- **Conversation lenses**: Structured frameworks for extracting specific facets
- **Themes & insights**: Cluster evidence into patterns that remain queryable
- **People & personas**: Track participants and segment by role/persona
- **Connect to action**: Link downstream work back to proof

---

## Spec-Driven Workflow: BMad → Beads → Implement

### Before Starting Any Feature Work

1. **Check existing docs first**: Read `docs/_information_architecture.md`, `docs/_lens-based-architecture-v2.md`, and relevant feature docs in `docs/features/`
2. **Check existing beads**: Run `bv --robot-triage` to see if work already exists
3. **If new feature**: Use BMad to create spec (see below)

### BMad Spec Creation

For small features (1-3 days):

```
/bmad-quick-spec
```

For major features (run each in fresh session):

```
/bmad-create-prd           # → _bmad-output/PRD.md
/bmad-create-architecture  # → _bmad-output/architecture.md
/bmad-create-stories       # → _bmad-output/epics/*.md
```

**Always tell BMad about existing context:**

> Read docs/_information_architecture.md and docs/_lens-based-architecture-v2.md first.
> Then create spec for: [feature description]

### Finding Work (Beads)

```bash
bv --robot-triage          # Ranked recommendations with reasons
bv --robot-next            # Single top pick with claim command
bd ready                   # Simple list of unblocked work
```

**⚠️ Never run bare `bv`** — it launches an interactive TUI that blocks sessions.

### During Implementation

1. Claim the work: `bd update <id> --status in_progress`
2. Check the bead description for acceptance criteria
3. Check `_bmad-output/` for spec context if referenced
4. Implement following the patterns below
5. Write tests that verify acceptance criteria

### Completing Work

1. Run full test suite
2. Close the bead: `bd close <id> --reason "Implemented in <description>"`
3. Sync: `bd sync`
4. Push: `git push`

### Capturing Technical Lessons

When you discover a package quirk, workaround, or pattern:

1. **If critical** (affects many features): Add to the **Technical Lessons** section below in this file
2. **If detailed** (needs full write-up): Add to `docs/30-howtos/development/lessons-learned.md` with date, problem, solution, affected files
3. **If workflow-related** (how we do things): Note in `AGENTS.md` or create a bead for follow-up

---

## Quick Reference

| What | Where |
|------|-------|
| **Routes** | `app/routes.ts` + `app/features/*/routes.ts` |
| **Database types** | `app/database.types.ts` (generated) |
| **Background tasks** | `src/trigger/` |
| **AI prompts** | `baml_src/*.baml` |
| **AI agents** | `app/mastra/agents/` |
| **BMad specs** | `_bmad-output/` |
| **Work items** | `.beads/` (use `bv` to view) |
| **Lessons learned** | `docs/30-howtos/development/lessons-learned.md` |

---

## Essential How-To Guides

| Guide | Purpose |
|-------|---------|
| [Supabase Guide](docs/30-howtos/supabase-howto.md) | Database changes, migrations |
| [CRUD Patterns](docs/30-howtos/crud-pattern-howto.md) | Standard data operations |
| [Testing Guide](docs/30-howtos/testing-howto.md) | Unit and integration testing |
| [Trigger.dev Guide](docs/30-howtos/trigger-dev-guide.md) | Background tasks |

---

## Coding Conventions

### CRITICAL: Project Route Links

**Always use `useProjectRoutes` hook**:

```tsx
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

function MyComponent({ projectPath }: { projectPath: string }) {
  const routes = useProjectRoutes(projectPath)
  return <Link to={routes.evidence.detail(evidenceId)}>View</Link>
}
```

### Route Registration

Always register new API routes in `app/routes.ts` after creating them. Check existing route registration patterns before adding new endpoints.

### File Organization

- **Features**: `app/features/[feature]/` with `routes.ts`, `pages/`, `components/`, `api/`
- **Shared components**: `app/components/ui/` (shadcn), `app/components/` (app-specific)
- **Background jobs**: `src/trigger/[domain]/`

### Code Style

- **JSDoc** at top of files describing purpose
- **Path aliases**: Use `~/` for imports from `app/`
- **Logging**: Use `consola` (NOT console.log)
- **Icons**: Use `lucide-react`
- **Null handling**: Supabase returns `null`. Accept `string | null`, use `if (!value)`

### React Patterns

- **React Router 7**: `useLoaderData`, `useFetcher`, `Link`
- **Forms**: `useFetcher` + `@conform-to/zod`
- **Form IDs**: Use `useId()` hook
- **Styling**: Tailwind + `cn()` for conditional classes
- **Return data directly** from loaders (no `json()` wrapper)

### UI / Frontend

When making UI/layout changes, preserve existing component structure and reuse existing components rather than building new ones. Check the current implementation first and extend it rather than replacing it.

### Database & Server

- **Supabase client**: `~/lib/supabase/client.server`
- **Type safety**: Always use `app/database.types.ts`
- **After DB changes**: Run `pnpm db:types`
- **Migrations**: Always run against the CORRECT database (check env vars). Verify FK constraints are satisfied before inserting data.

### Mastra Tools (IMPORTANT)

No static `~/` imports in tools. Use dynamic imports inside `execute()`:

```typescript
execute: async (input) => {
  const { createSupabaseAdminClient } = await import("~/lib/supabase/client.server");
  const supabase = createSupabaseAdminClient();
}
```

### Trigger.dev Tasks

- Use v4 SDK (`@trigger.dev/sdk`)
- Check `result.ok` before accessing `result.output`

---

## Technical Lessons

> **Tier 1 (Critical)** — items here affect many features and must be known by every agent.
> For full write-ups, see [lessons-learned.md](docs/30-howtos/development/lessons-learned.md).

### Patterns That Work

- **Voice recording**: Use MediaRecorder with `audio/webm;codecs=opus`
- **Mastra agents**: Always set `maxRetries: 3` on tool calls
- **Debounced saves**: 1000ms debounce for DB writes from user interactions
- **External data**: Always post-process API responses to ensure unique IDs (`crypto.randomUUID()` fallback)
- **Dark mode**: Build in from the start with `dark:` variants — retrofitting is painful
- **Person resolution**: Use shared `resolveOrCreatePerson()` for all ingestion paths (desktop, BAML, import) — prevents duplicates
- **Idempotent creation**: Try-insert-catch-find pattern with constraint violation (code 23505) handling — safe for retries
- **Platform IDs**: Store in `contact_info` JSONB for cross-meeting identity — supports multiple platforms without migrations

### Patterns To Avoid

- **Never use `json()`** in loaders/actions — React Router 7 deprecated it, causes 500 errors
- **Never use `dangerouslySetInnerHTML`** for user content
- **Never call `supabase.auth.getUser()` in loaders** — use middleware context
- **Never use static `~/` imports** in Mastra tool files — use dynamic imports
- **Never run bare `bv`** — blocks the session with interactive TUI

### Package Quirks

- **Vite cache corruption**: If you see 504 errors for optimized deps, run `rm -rf node_modules/.vite && rm -rf .cache`
- **PostgREST**: `people_personas(count)` syntax not supported — use separate count queries
- **Conform/Zod**: Form validation requires `useId()` for SSR-safe form element IDs

---

## URL Architecture

Routes follow: `/a/:accountId/:projectId/...`

Auth middleware in `_ProtectedLayout.tsx` provides context to loaders:

```typescript
export async function loader({ context, params }: Route.LoaderArgs) {
  const ctx = context.get(userContext)
  // ctx.supabase is ready, scoped by accountId + projectId
}
```

**Key rules:**

- All queries must filter by `account_id` AND `project_id` for RLS
- Return data directly from loaders — never wrap in `json()`

---

## Session Completion (MANDATORY)

Work is **NOT complete** until `git push` succeeds:

```bash
bd close <id> --reason="..."
bd sync
git pull --rebase
git push
git status  # Must show "up to date with origin"
```

---

## Git Notes

- Use `--no-verify` for commits until lint cleanup pass