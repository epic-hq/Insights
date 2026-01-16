# Mastra Project Agents (Project Status + Project Setup)

This document explains how the two core Mastra agents work in this repo:

- `projectStatusAgent` (Uppy) - project-wide status, insights, CRM actions
- `projectSetupAgent` - guided setup to collect project goals and generate research structure

It covers the conceptual architecture, how each agent runs in practice, and the established patterns we rely on when extending them.

## Conceptual Architecture

- **Mastra as the runtime**: `app/mastra/index.ts` registers agents, workflows, storage, and server chat routes.
- **Request-scoped context**: `RequestContext` carries `user_id`, `account_id`, `project_id`, and optional `user_timezone`. Tools resolve the correct account using `resolveAccountIdFromProject` or `resolveProjectContext`.
- **Memory as continuity**: Agents use `@mastra/memory` with Postgres storage. Threads are keyed by `resourceId` that includes agent, user, and project.
- **Streaming UI**: API routes stream Mastra output via the AI SDK (`toAISdkStream` + `createUIMessageStreamResponse`).
- **Tool status events**: Tools are wrapped with `wrapToolsWithStatusEvents` to stream progress states to the UI.
- **Safety on account scope**: Account IDs are resolved from project records, not from URL params or session, to avoid cross-account writes.

## Project Status Agent (projectStatusAgent)

### What it does

- Synthesizes project evidence, themes, interviews, surveys, and CRM data.
- Recommends next actions with suggestion widgets (no "Next steps" text block).
- Creates and updates CRM entities (people, opportunities, tasks).
- Handles web research only after internal evidence search.
- Routes users to the setup agent when the project is missing goals.

### Where it lives

- Agent definition: `app/mastra/agents/project-status-agent.ts`
- API endpoint: `app/routes/api.chat.project-status.tsx`
- History endpoint: `app/routes/api.chat.project-status.history.tsx`
- UI integration: `app/components/chat/ProjectStatusAgentChat.tsx`

### Runtime behavior

- **Thread key**: `projectStatusAgent-<userId>-<projectId>`.
- **Message handling**: only the newest user turn is passed to Mastra; history is pulled from memory.
- **RequestContext**: `user_id`, `account_id`, `project_id`, `user_timezone` are set in the API route.
- **Memory**: Postgres-backed with working memory enabled (schema: `ProjectStatusMemoryState`).
- **Token cap**: `TokenLimiterProcessor(100_000)` to prevent overflow.
- **Observability**: Langfuse trace is logged on `onFinish`.

### Tooling patterns

- **Internal search first**: `semanticSearchEvidence` is required before any `webResearch`.
- **Survey data**: use `searchSurveyResponses` for survey/ask-link responses.
- **Links are mandatory**: use `generateProjectRoutes` and tool-provided URLs for every referenced record.
- **Tables vs docs**: use `saveTableToAssets` for tabular data, `manageDocuments` for prose.
- **Destructive actions**: follow multi-step confirmation (list -> dry run -> confirm -> delete).
- **Switching agents**: use `switchAgent` to route to `project-setup`.

## Project Setup Agent (projectSetupAgent)

### What it does

- Guides users through setup questions (project goals and context).
- Saves each answer to `project_sections`.
- Generates research structure when setup is complete.

### Where it lives

- Agent definition: `app/mastra/agents/project-setup-agent.ts`
- API endpoint: `app/routes/api.chat.project-setup.tsx`
- UI page: `app/features/project-chat/pages/chat.tsx`
- Feature doc: `docs/20-features-prds/features/project-chat.md`

### Runtime behavior

- **Thread key**: `projectSetupAgent-<userId>-<projectId>`.
- **Message handling**: only new messages are sent to the agent to avoid duplication.
- **Account context**: pulls account-level company context to skip redundant questions.
- **Project sections**: reads existing `project_sections` to skip already-answered fields.
- **Research structure generation**:
  - The agent is instructed to call `generateResearchStructure` after completion.
  - The API route also checks working memory and triggers structure generation if marked complete.
- **Token cap**: `TokenLimiterProcessor(100_000)`.
- **Observability**: Langfuse trace is logged on `onFinish`.

### Tooling patterns

- **One question at a time**: short prompts, no summaries.
- **Save immediately**: use `saveProjectSectionsData` after every answer.
- **Company context first**: if missing, use `researchCompanyWebsite` then `saveAccountCompanyContext`.
- **Suggestions**: call `suggestNextSteps` with examples that match the question asked.

## Established Working Patterns (Both Agents)

- **Account resolution**: always derive `account_id` from the project record.
- **Thread reuse**: list threads by `resourceId`, reuse the latest, or create a new thread if missing.
- **Tool progress**: wrap tools with `wrapToolsWithStatusEvents` for UI feedback.
- **Streaming**: use `toAISdkStream` with `sendReasoning` and `sendSources` for UI.
- **Minimal message payloads**: only send new turns, rely on memory for history.
- **Prompt discipline**: behavior rules live in the agent instructions and are enforced by tools.

## Adding or Updating Agent Behavior

1. **Create or update a tool** in `app/mastra/tools`.
2. **Use context helpers** (`resolveProjectContext`, `resolveAccountIdFromProject`) for account safety.
3. **Register the tool** on the agent with `wrapToolsWithStatusEvents`.
4. **Update instructions** in the agent file to cover the new capability.
5. **Add or update docs** in `docs/` (this file and any feature PRDs).

## Related References

- `docs/20-features-prds/features/project-chat.md` (project setup workflow)
- `docs/10-architecture/api/mobile-api-reference.md` (project status agent API)
- `docs/architecture/agentic-system-strategy.md` (system-level strategy)
- `docs/architecture/agentic-system-planning-guide.md` (production planning guide)
- `docs/00-foundation/agents/evaluation-checklist.md` (pre-ship checklist)
- `docs/30-howtos/mastra-tools/tool-contracts.md` (tool contract standard)
- `app/mastra/tools/context-utils.ts` (account safety)
- `app/mastra/tools/tool-status-events.ts` (status streaming)
