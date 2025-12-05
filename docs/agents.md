# Agents & Automation Manifest

This document is the landing pad for every AI agent, automation workflow, or CopilotKit action that touches discovery data. It now points at a subfolder structure that separates planning signals (`docs/agents/planning.md`), implementation conventions (`docs/agents/implementation.md`), and long-term vision (`docs/agents/vision.md`). The goal: one place to understand what is live, what is being built, and where to look for the deeper architectural rationale.

## 1. Vision & Pillars
- **Themes are the source of truth:** All agents read/write via `themes` plus the read-only views `insights_current` and `insights_with_priority`. Legacy `public.insights` is only available behind those views for reporting, never for edits.
- **Context completeness:** Every Supabase call must include both `account_id` and `project_id`, usually sourced from `currentProjectContext` (see `app/layouts/_CurrentProjectLayout.tsx`). If you hit missing context errors, revisit that middleware before touching the API again.
- **Documented deployments:** Manual SQL, grants, or non-declarative work should go through `docs/supabase-howto.md` (and `supabase/migrations/imperative.sql`). This ensures every agent knows when to re-run migrations/`db push` after making schema changes.
- **Unified references:** `_information_architecture.md` explains why Decision Questions → Research Questions → Themes must stay traceable. `deploy-howto.md` covers how to release new agents or schema changes without surprises. Treat these docs as the “pillars” your automation stands on.

## 2. Agent Catalog & Status
| Agent / Workflow | Purpose | Data Sources | Status | Next Step |
| --- | --- | --- | --- | --- |
| `projectStatusAgent` | Answers discovery progress questions, suggests next steps | `fetchProjectStatusContext` (themes, evidence, personas, votes) | ✅ Live | Keep syncing with the planning doc when themes/evidence scopes shift. |
| `insightsAgent` + `dailyBriefWorkflow` | Synthesizes insights, surfacing high-vote findings | `getInsights`, `insights_with_priority`, `votes` | ✅ Live | Track vote counts in `InsightsDataTable` and keep LLM priority separate. |
| `projectSetupAgent` | Onboarding journey: collects 8 setup questions, saves to `project_sections`, and auto-generates research structure (decision questions, research questions, interview prompts) via BAML | `saveProjectSectionsData`, `generateResearchStructure`, `navigateToPage`, `displayUserQuestions` | ✅ Live | Automatically generates complete research plan when all 8 questions are answered. |
| Legacy helpers (`signup-agent`, `old reporting`) | Historical workflows | Deprecated | 💤 Dormant | Archive in `agents-TEMP-SKIP.md` once downstream references are removed. |

## 3. Code Conventions

### URL Routing for Project-Scoped Resources
When generating URLs that link to project-scoped resources (evidence, interviews, insights, people, etc.), always use the project-scoped route helpers:

```tsx
// ✅ CORRECT: Use useProjectRoutes with project path from context
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

function MyComponent() {
  const { projectPath } = useCurrentProject()
  const routes = useProjectRoutes(projectPath)

  // This generates: /a/{accountId}/{projectId}/evidence/{id}?t=123
  const url = `${routes.evidence.detail(evidenceId)}?t=${timestamp}`
}

// ❌ WRONG: Using useProjectRoutes without projectPath
const routes = useProjectRoutes() // Missing projectPath - generates wrong URLs!
```

The `projectPath` is formatted as `/a/{accountId}/{projectId}` and must be passed to `useProjectRoutes()` to generate correctly scoped URLs.

## 4. Planning & Implementation Workspace
- **Planning signals** – Open `docs/agents/planning.md` for the short list, central task ledger cues, and readiness checks before any automation starts a new feature.
- **Implementation conventions** – `docs/agents/implementation.md` describes how to wire Supabase helpers, surface votes, and coordinate deployments (linking back to `docs/supabase-howto.md` and `deploy-howto.md`).
- **Vision anchor** – `docs/agents/vision.md` holds the long-term hypotheses (theme adoption coach, decision question concierge, etc.) and reminds agents how `_information_architecture.md` frames the overall discovery story.

## 5. Task Ledger (AI-editable)
- [x] Document the `themes` migration, priority views, and vote-count handling in this manifest.
- [x] Added project/theme/docs tooling that surfaces votes/priority as part of `fetchProjectStatusContext` and UI tables.
- [ ] Standardize instructions for any agents still referencing legacy routing (especially `projectSetupAgent`).
- [ ] Confirm the `/themes` page only shows the Table + Cards toggles, and remove old matrix/table links.
- [ ] Keep this checklist updated; when new automation ideas arise (e.g., priority audit, theme adoption coach), append them here so future LLMs can keep extending the ledger.

## 6. Reference Docs
- `_information_architecture.md` – explains the evidence → theme → insight motivators for every agent.
- `docs/supabase-howto.md` – declarative schema workflow, manual SQL notes, and migration expectations.
- `docs/deploy-howto.md` – release checklists for schema/view changes and automation deployments.
- `docs/agents/planning.md`, `docs/agents/implementation.md`, `docs/agents/vision.md` – the new subfolder that keeps planning, implementation, and vision separated but linked.
- `_task-board.md` – product roadmap; coordinate AI-added tasks here when they impact feature delivery.
