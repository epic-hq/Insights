# Project Chat – Project Setup via Agent

Project-scoped chat that walks users through the six core setup questions and saves answers directly into `project_sections` (same store as the Project Goals form). Use the chat or the form interchangeably.

## Overview

- Streams messages to a Mastra agent that collects the six setup items in order.
- Persists to `project_sections` using a dedicated server tool.
- Lives under the protected project scope: `/a/:accountId/:projectId/project-chat`.

## Files and Responsibilities

- `app/mastra/agents/project-setup-agent.ts`
  - Asks the six questions in order and stays concise.
  - Uses `save-project-sections-data` tool after each answer.
  - Memory schema holds `research_goal`, `decision_questions[]`, `assumptions[]`, `unknowns[]`, `target_orgs[]`, `target_roles[]`, `completed`.

- `app/mastra/tools/save-project-sections-data.ts`
  - Formats each section consistently with `/api/save-project-goals`:
    - `research_goal` (+ optional `research_goal_details`) → `# <goal>\n\n<details>`
    - Arrays (`decision_questions`, `assumptions`, `unknowns`, `target_orgs`, `target_roles`) → numbered or spaced lists, meta mirrors raw arrays.
  - Calls `upsertProjectSection` so RLS/constraints and default positions apply.

- `app/routes/api.chat.project-setup.tsx`
  - API endpoint that streams to the agent with `runtimeContext` set to `user_id`, `account_id`, and `project_id`.
  - Thread key: `projectSetupAgent-<userId>-<projectId>` for continuity.

- UI
  - `app/features/project-chat/pages/chat.tsx` – Assistant UI chat wired to `a/:accountId/:projectId/api/chat/project-setup`.
  - `app/features/project-chat/routes.ts` – Registers `project-chat` under the project.
  - `app/routes.ts` – Imports and spreads project-chat routes inside `a/:accountId/:projectId` tree.
  - Quick link from Project Status screen: `ProjectStatusScreen` “Setup Chat” button opens `/project-chat`.

## Questions and Keys

1) Business objective → `research_goal`
2) Key decisions → `decision_questions[]`
3) Current assumptions → `assumptions[]`
4) Unknowns to learn → `unknowns[]`
5) Ideal companies/organizations → `target_orgs[]`
6) Ideal target users/buyers → `target_roles[]`

All answers are saved to `project_sections` with the same `kind` name as the key above.

## Data Model & RLS

- Table: `project_sections` with unique `(project_id, kind)`.
- View: `project_sections_latest` for latest content.
- RLS: Project-scoped via user context; no explicit `account_id` filters needed.

## How to Call Programmatically

- Endpoint (POST JSON): `/a/:accountId/:projectId/api/chat/project-setup`
- Body: `{ messages, tools?, system? }` in AI SDK v5 format. The app’s page uses Assistant UI + AI SDK runtime to handle this.

## Test Plan

1) Open `/a/:accountId/:projectId/project-chat` and answer the six questions.
2) Verify `project_sections` rows exist for each kind with expected `meta`.
3) Refresh and confirm thread continuity and persisted answers.
4) Open Project Setup form and confirm fields are prefilled from `project_sections`.

## Notes

- Chat and form are interchangeable; both write to `project_sections` and share formatting.
- Keep responses short; agent suggests examples if user is uncertain.

