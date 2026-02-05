# Project Chat – Project Setup via Agent

Project-scoped chat that walks users through eight core setup questions, saves answers directly into `project_sections` (same store as the Project Goals form), and automatically generates the complete research structure (decision questions, research questions, and interview prompts). Use the chat or the form interchangeably.

## Overview

- Streams messages to a Mastra agent that collects eight setup items in order.
- Persists each answer to `project_sections` using a dedicated server tool.
- When all 8 questions are answered, automatically generates the complete research structure using BAML:
  - Decision questions (strategic business questions)
  - Research questions (tactical interview questions linked to decision questions)
  - Interview prompts (specific questions to ask during interviews)
- Lives under the protected project scope: `/a/:accountId/:projectId/project-chat`.

## Files and Responsibilities

- `app/mastra/agents/project-setup-agent.ts`
  - Asks eight questions in order and stays concise.
  - Uses `saveProjectSectionsData` tool after each answer.
  - Uses `generateResearchStructure` tool when all 8 questions are answered.
  - Memory schema holds `customer_problem`, `target_orgs[]`, `target_roles[]`, `offerings`, `competitors[]`, `research_goal`, `decision_questions[]`, `assumptions[]`, `unknowns[]`, `completed`.

- `app/mastra/tools/save-project-sections-data.ts`
  - Formats each section consistently with `/api/save-project-goals`:
    - `research_goal` (+ optional `research_goal_details`) → `# <goal>\n\n<details>`
    - Arrays (`decision_questions`, `assumptions`, `unknowns`, `target_orgs`, `target_roles`, `competitors`) → numbered or spaced lists, meta mirrors raw arrays.
    - Strings (`customer_problem`, `offerings`) → plain text with meta.
  - Calls `upsertProjectSection` so RLS/constraints and default positions apply.

- `app/mastra/tools/generate-research-structure.ts`
  - Fetches all project context from `project_sections` via `getProjectContextGeneric`.
  - Validates required fields (research_goal, target_roles) are present.
  - Checks if research structure already exists to avoid duplication.
  - Calls `/api/generate-research-structure` with all project data.
  - Returns generated decision questions, research questions, and interview prompts.
  - All data is saved to `decision_questions`, `research_questions`, and `interview_prompts` tables.

- `app/routes/api.chat.project-setup.tsx`
  - API endpoint that streams to the agent with `runtimeContext` set to `user_id`, `account_id`, and `project_id`.
  - Thread key: `projectSetupAgent-<userId>-<projectId>` for continuity.

- UI
  - `app/features/project-chat/pages/chat.tsx` – Assistant UI chat wired to `a/:accountId/:projectId/api/chat/project-setup`.
  - `app/features/project-chat/routes.ts` – Registers `project-chat` under the project.
  - `app/routes.ts` – Imports and spreads project-chat routes inside `a/:accountId/:projectId` tree.
  - Quick link from Project Status screen: `ProjectStatusScreen` “Setup Chat” button opens `/project-chat`.

## Questions and Keys

The agent asks these 8 questions in order:

1) Tell me about your business, what problem are you solving? → `customer_problem`
2) Who are your ideal customers, organizations and roles? → `target_orgs[]`, `target_roles[]`
3) What products and services do you offer? → `offerings`
4) What other products or solutions are your customers likely using or considering? → `competitors[]`
5) What goal are you trying to achieve with this research? → `research_goal`
6) What do you need to learn? → `unknowns[]`
7) What key decisions are you facing? → `decision_questions[]`
8) What are your riskiest assumptions? → `assumptions[]`

All answers are saved to `project_sections` with the same `kind` name as the key above.

After all 8 questions are answered, the agent automatically calls `generateResearchStructure` to create the complete research plan.

## Data Model & RLS

- Table: `project_sections` with unique `(project_id, kind)` - stores all 8 setup answers.
- View: `project_sections_latest` for latest content.
- Tables: `decision_questions`, `research_questions`, `interview_prompts`, `interview_prompt_research_questions` - populated by research structure generation.
- RLS: Project-scoped via user context; no explicit `account_id` filters needed.

## How to Call Programmatically

- Endpoint (POST JSON): `/a/:accountId/:projectId/api/chat/project-setup`
- Body: `{ messages, tools?, system? }` in AI SDK v5 format. The app’s page uses Assistant UI + AI SDK runtime to handle this.

## Test Plan

1) Open `/a/:accountId/:projectId/project-chat` and answer all eight questions.
2) Verify `project_sections` rows exist for each kind with expected `meta`.
3) Confirm research structure generation triggers automatically after question 8.
4) Verify `decision_questions`, `research_questions`, and `interview_prompts` tables are populated.
5) Check that interview prompts are linked to research questions via `interview_prompt_research_questions`.
6) Refresh and confirm thread continuity and persisted answers.
7) Open Project Setup form and confirm fields are prefilled from `project_sections`.
8) Navigate to Questions/Prompts sections and verify generated content is visible.

## Notes

- Chat and form are interchangeable; both write to `project_sections` and share formatting.
- Keep responses short; agent suggests examples if user is uncertain.
- Research structure generation only happens once - if structure already exists, it won't regenerate.
- The same BAML workflow (`GenerateResearchStructure`) is used by both the chat agent and the Project Goals form.

