# UpSight Project - AI Context

## Project Overview

UpSight is a conversation-first, AI-native CRM/customer intelligence platform that turns customer conversations into **evidence you can verify** ("receipts") and insights your whole team can search, share, and act on. It supports multi-channel inputs (interviews, meetings, notes/docs, surveys, and AI chat/voice) that flow through the same pipeline: **capture → evidence → themes/insights → action**.

Key capabilities include:

- **Evidence ("receipts")**: AI-identified quotes/moments with attribution and timestamps
- **Conversation lenses**: Structured frameworks (e.g. BANT, empathy maps) for extracting specific facets
- **Themes & insights**: Cluster evidence into patterns and findings that remain queryable over time
- **People & personas**: Track participants/mentions and segment patterns by role/persona
- **Connect to action**: Keep downstream work (tasks/opportunities/next steps) linked back to proof

## Quick Reference

| What | Where |
|------|-------|
| **Routes** | `app/routes.ts` (config) + `app/features/*/routes.ts` |
| **Database types** | `app/database.types.ts` (generated) |
| **Background tasks** | `src/trigger/` |
| **AI prompts** | `baml_src/*.baml` |
| **AI agents** | `app/mastra/agents/` |
| **Project structure** | `docs/ai-context/project-structure.md` |

## Essential How-To Guides

| Guide | Purpose |
|-------|---------|
| [Supabase Guide](docs/supabase-howto.md) | Database changes, declarative schemas, migrations |
| [CRUD Patterns](docs/crud-pattern-howto.md) | Standard patterns for data operations |
| [Deploy Guide](docs/deploy-howto.md) | Deployment to Fly.io |
| [Trigger.dev Deploy](docs/trigger-dev-deployment.md) | Background task deployment |
| [Testing Guide](docs/testing-howto.md) | Unit and integration testing |
| [Storybook Guide](docs/storybook-guide.md) | Component development |

## Coding Conventions

### CRITICAL: Project Route Links

**Always use `useProjectRoutes` hook** for links to project-scoped resources:

```tsx
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

function MyComponent({ projectPath }: { projectPath: string }) {
  const routes = useProjectRoutes(projectPath)

  // ✅ CORRECT: Use routes helper
  return <Link to={routes.evidence.detail(evidenceId)}>View Evidence</Link>
}

// ❌ WRONG: Manual path construction breaks!
// <Link to={`/projects/${projectPath}/insights/${id}`}>
```

**Available route helpers**: `routes.evidence.detail()`, `routes.insights.detail()`, `routes.interviews.detail()`, `routes.people.detail()`, `routes.opportunities.detail()`

### File Organization
- **Features**: Domain-organized in `app/features/[feature]/` with `routes.ts`, `pages/`, `components/`, `api/`
- **Shared components**: `app/components/ui/` (shadcn primitives), `app/components/` (app-specific)
- **Background jobs**: `src/trigger/[domain]/` using Trigger.dev v4

### Code Style
- **JSDoc comments** at the top of files describing purpose
- **Type definitions** before main exports in the same file
- **Path aliases**: Use `~/` for imports from `app/` (e.g., `~/components/ui/button`)
- **Logging**: Use `consola` (NOT console.log) - `import consola from "consola"`
- **Icons**: Use `lucide-react` for all icons
- **Null handling**: Supabase returns `null` for nullable columns. Accept `string | null` in functions, use `if (!value)` to handle both null/undefined

### React Patterns
- **React Router 7**: Use `useLoaderData`, `useFetcher`, `Link` from `react-router`
- **State**: Prefer local state, use Zustand for cross-component state
- **Forms**: Use `useFetcher` for mutations, `@conform-to/zod` for validation
- **Form IDs**: Use `useId()` hook for form element IDs instead of hardcoded strings (SSR-safe, prevents collisions)
- **Styling**: Tailwind CSS with `cn()` utility for conditional classes
- **Return data directly** from loaders - don't wrap in `json()` or Response

### Database & Server
- **Supabase client**: Import from `~/lib/supabase/client.server`
- **Type safety**: Always use generated types from `app/database.types.ts`
- **Schema changes**: Use declarative schemas in `supabase/schemas/`, then generate migrations
  - See [docs/@supabase/howto/declarative-schemas.md](docs/@supabase/howto/declarative-schemas.md)
- **After DB changes**: Run `pnpm db:types` to regenerate types

### AI/LLM Integration
- **BAML**: Define prompts in `baml_src/`, run `pnpm baml-generate` after changes
- **Mastra**: Complex agent workflows in `app/mastra/`
- **Streaming**: Use Vercel AI SDK patterns with `useChat`

### Mastra Tools (IMPORTANT)
- **No static `~/` imports**: Mastra's bundler doesn't resolve path aliases at top level
- **Use dynamic imports** inside `execute()` function:
  ```typescript
  // ❌ WRONG - breaks Mastra bundling
  import { supabaseAdmin } from "~/lib/supabase/client.server";

  // ✅ CORRECT - use dynamic import inside execute()
  execute: async (input, context?) => {
    const { createSupabaseAdminClient } = await import("~/lib/supabase/client.server");
    const supabase = createSupabaseAdminClient();
  }
  ```
- External packages (`@mastra/core`, `zod`, `consola`) can use static imports
- Relative imports within `app/mastra/` are fine (e.g., `./context-utils`)

### Trigger.dev Tasks
- **Always use v4 SDK** (`@trigger.dev/sdk`), never v2 patterns
- **Schema validation**: Use `schemaTask` with Zod for type-safe payloads
- **Error handling**: Check `result.ok` before accessing `result.output`
- See detailed patterns below

## Key Documentation

### Architecture & Design
- [Information Architecture](docs/_information_architecture.md) - System-wide IA
- [Interview Processing](docs/interview-processing-explained.md) - Core pipeline
- [Lens Architecture](docs/_lens-based-architecture-v2.md) - Conversation lenses design

### Feature PRDs
- [Conversation Lenses PRD](docs/features/conversation-lenses/PRD.md)
- [Task System Design](docs/features/task-system-technical-design.md)
- [Onboarding Flow](docs/features/onboarding-flow.md)

### Current Tasks
See `agents.md` (root) for current todos and recent implementations

---

## Background Tasks (Trigger.dev)

For comprehensive Trigger.dev v4 patterns, see **[Trigger.dev Guide](docs/30-howtos/trigger-dev-guide.md)**.

**Quick reference:**
- Use `@trigger.dev/sdk` (v4), never `client.defineJob`
- Check `result.ok` before accessing `result.output` from `triggerAndWait()`
- Tasks in `src/trigger/` organized by domain
- See guide for: tasks, queues, retries, metadata, realtime monitoring

---

## Temporary Working Notes

### Git Commits
- **Use `--no-verify`** for all commits until lint cleanup pass is complete
- Pre-commit hooks have unrelated failures that will be fixed in a dedicated cleanup pass