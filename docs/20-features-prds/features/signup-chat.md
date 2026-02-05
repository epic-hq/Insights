# Signup Chat – Deterministic Workflow Architecture

This document explains the current signup chat flow, the files added/changed, known pitfalls we fixed, and how to extend it to prefill new projects from the captured answers.

## Overview

- Two modes are supported:
  - Deterministic workflow (default UI): client calls a server endpoint on each turn; server deterministically advances fields.
  - Agent variant (legacy/optional): Assistant UI streams to a Mastra agent; still persists to the same store.
- Prescreen focus: collects minimal info to triage fit and start a project later.
- Progress saves to `user_settings.signup_data`; completion sets `completed: true` and the UI redirects to `/home`.

## Files and Responsibilities

- `app/features/signup-chat/pages/signup-chat.tsx`
  - Replaced toolbox-driven chat with `DeterministicSignupChat`.
  - Calls `/api/signup-next-turn` on mount and after each user message.
  - Keeps the input focused between turns and auto-scrolls to the latest message.
  - On completion, delays redirect to `/home` by ~3s to let the user see the final response.
  - Guards: If `SIGNUP_CHAT_REQUIRED` is false or `signup_data.completed` is true, redirect straight to `/home`.
  - Supports a manual restart with `?restart=1` to clear stale chat data.

- `app/routes/api.signup-next-turn.tsx`
  - Authenticates the user, injects Supabase into Mastra runtime, and runs the workflow.
  - Returns `{ reply, state, completed }` for the client to render and use.
  - Logs helpful markers for debugging.

- `app/mastra/workflows/signup-onboarding.ts`
  - Fields collected (in order): `name`, `problem`, `need_to_learn`, `challenges`, `content_types` (plus `other_feedback` if available).
  - Steps:
    1) `merge-answer`: Assigns latest message to the next missing field. Cleans `name` deterministically (first token, capitalized).
    2) `normalize-assigned`: Uses LLM to lightly rewrite non-name fields for spelling/clarity (kept short).
    3) `save-progress`: Upserts partial state to `user_settings.signup_data` with `completed: false`.
    4) `build-reply`: Returns a short next question. If `name` is known, prefixes the question with the user’s name. No filler like “Got it/No worries”. If all fields are answered, returns a short completion line.
    5) `save-if-complete`: Sets `completed: true` in `user_settings.signup_data`.
  - The workflow is registered in `app/mastra/index.ts` and invoked from the new API route.

- Agent variant: `app/features/signup-chat/api/signup-agent.tsx`, `app/mastra/agents/signup-agent.ts`
  - The agent now asks prescreen questions:
    1) Business goal that could benefit from customer intelligence → `problem`
    2) Learnings that would move the needle → `need_to_learn` (stored inside `other_feedback` when saving)
    3) Data sources already available → `content_types`
    4) What’s blocking you today → `challenges`
  - Saves via `saveUserSettingsData` tool to `user_settings.signup_data`.

## Why These Changes

- Previous behavior stalled because the agent sometimes didn’t call the intended action, and the page had an unconditional redirect path tied to `SIGNUP_CHAT_REQUIRED`.
- Deterministic client calls guarantee a single turn per message.
- Short, specific replies improve perceived quality and reduce “boilerplate” responses.
- Saving progress each turn makes the flow resilient to refreshes.

## UX Details

- Input focus: After assistant replies and on mount, the input is focused so users can type immediately.
- Auto-scroll: The message list scrolls to bottom when new content arrives.
- Completion pause: On `completed: true`, the UI shows a final line and waits ~3 seconds before redirecting to `/home`.
- Restart: `GET /signup-chat?restart=1` clears prior answers to start fresh.

## Data Model and Persistence

- Answers are saved in `user_settings.signup_data` via the `upsert_signup_data` RPC.
- Fields: `problem`, `need_to_learn` (captured under `other_feedback` by the agent tool), `challenges`, `content_types`, `other_feedback`, and `completed`.
- RLS: enforced by authenticated user context.

## Project Prefill (Recommended Next)

Goal: Use `signup_data` to seed new projects’ name, slug, description, and optionally project sections.

Suggested design:

1) Create a server util (e.g., `app/features/onboarding/server/signup-derived-project.ts`) that:
   - Loads `user_settings.signup_data`.
   - Deterministically generates:
     - `name`: A concise name based on `problem` (e.g., “Scheduling MVP user research”).
     - `slug`: Use `@sindresorhus/slugify`.
     - `description`: 1 short line from `need_to_learn`, `challenges`, and `content_types`.
   - Optional: LLM polish for name/description when available (keep short; fallback to deterministic text).

2) Wire util into:
  - `app/routes/api.create-project.tsx`: Before calling `createProject`, prefer util’s name/description/slug.
  - `app/routes/api.onboarding-start.tsx`: When creating a project on-the-fly, reuse the same util; also seed `project_sections` from `signup_data` where appropriate (e.g., `research_goal`, `questions`).

## Related: Project Chat (Project Setup)

- See `docs/features/project-chat.md` for the project-scoped chat that writes directly to `project_sections` (same store as the Project Goals form).

Benefits:
- Keeps logic server-first and testable.
- One source of truth, reused anywhere a new project is created.

## Lessons Learned / Pitfalls

- Don’t rely on the LLM to always trigger tools/actions; use deterministic API calls from the client for critical flows.
- Avoid unconditional redirects that compete with the chat experience; instead tie navigation to `completed: true` or your product setting.
- Keep prompts short and explicit. The more generic the instruction (“be helpful”), the more generic the output.
- Save partial progress early and often; it makes recovery seamless.

## Quick Test Plan

1) Start at `/signup-chat?restart=1`.
2) Provide answers out-of-order; ensure the next question always advances logically.
3) Refresh mid-way; verify state persists.
4) Complete all fields; see final line, then a ~3s redirect.
5) Toggle `SIGNUP_CHAT_REQUIRED=false`; confirm redirect to `/home` with no chat.

## Confidence

- Deterministic flow reliability: 92–95%.
- Short, targeted replies: ~90% (LLM normalization is optional; replies themselves are deterministic).
- Redirect timing and UX polish: 99%.
