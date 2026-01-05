# Langfuse Observability

This project uses Langfuse for lightweight tracing of API routes, workflows, and external calls. The goal is to see what was run, with which inputs, and what the model or function returned — without coupling feature code to any vendor‑specific SDKs.

## Setup

- Env vars (set via `.env` locally and `.env.production` in production; loaded with `dotenvx`):
  - `LANGFUSE_PUBLIC_KEY`
  - `LANGFUSE_SECRET_KEY`
  - `LANGFUSE_HOST` or `LANGFUSE_BASE_URL` (defaults to `https://cloud.langfuse.com`)

- Client factory: `app/lib/langfuse.ts`
  - Exposes `getLangfuseClient()` which lazily instantiates a singleton Langfuse client.
  - If keys are missing, it returns a no‑op mock so dev flows don’t crash.

- Early initialization: `app/server/index.ts`
  - First import is `~/lib/instrumentation` which calls `getLangfuseClient()` on boot to validate config and prime the client in server context.

## Patterns We Use

We keep the API surface minimal and optional to avoid tight coupling. Typical usage is:

```ts
const langfuse = getLangfuseClient()
const trace = (langfuse as any).trace?.({ name: "feature.area" })
const gen = trace?.generation?.({ name: "subtask-or-llm-call" })

try {
  const output = await doWork()
  gen?.update?.({ input: { important: "fields" }, output })
  return { success: true, data: output }
} catch (e) {
  gen?.end?.({ level: "ERROR", statusMessage: (e as Error).message })
  throw e
} finally {
  gen?.end?.()
  trace?.end?.()
}
```

Notes:
- Use `?.` optional chaining everywhere; the no‑op client implements the same shape but does nothing when keys are absent.
- Prefer one `trace` per request/action/loader, and one `generation` per distinct sub‑operation (e.g., a single BAML function call or fetch).
- Always `end()` both the generation and the trace in `finally` to close spans.

## Where It’s Already Used

- API routes
  - `app/routes/api.evaluate-question.tsx:6`: wraps a BAML call with a trace and generation.
  - `app/routes/api.improve-question.tsx:11`: similar pattern, with fallback generation on error.

- Workflows
  - `app/mastra/workflows/daily-brief.ts:113`: traces LLM steps inside the workflow.
  - `app/mastra/workflows/signup-onboarding.ts:131`: traces normalization logic.

- Fetch instrumentation
  - `app/lib/observedFetch.ts`: a drop‑in replacement for `fetch` that adds a `trace`/`generation` around network calls and records status + latency.

## Instrumenting New Feature Areas

1) Pick a stable name
- Trace name: feature and action, e.g., `"api.feature-x"`, `"ui.export"`, `"worker.digest"`.
- Generation name: the concrete subtask, e.g., `"baml.GenerateQuestionSet"`, `"fetch.GET /api/foo"`.

2) Wrap your server code
- For loaders/actions, create the Langfuse client at the top, start a trace, then nest generations around expensive or important steps (BAML/AI, DB joins, external APIs).
- Add `gen.update({ input, output })` with concise, serializable fields. Avoid logging secrets.
- On errors, call `gen.end({ level: "ERROR", statusMessage })` before rethrowing.
- Always `trace.end()` in `finally`.

3) Client utilities
- If you need front‑end network tracing, import and use `observedFetch()` instead of `fetch()` for pages/components where visibility helps.

## Evals & Quality Signals

Langfuse supports attaching structured data to traces/generations. In our codebase we:
- Store quick evaluation metadata alongside outputs via `gen.update({ output: { ...computedScores } })`.
- Optionally create a separate generation named `"eval"` to keep evaluation signals distinct from the main LLM call.

Guidelines:
- Keep scores and labels small and typed (numbers/strings/booleans). Avoid large blobs.
- Record the minimum needed to reproduce and compare — e.g., a numeric score, a pass/fail flag, and the rule or rubric name.

## Troubleshooting

- No keys found
  - You’ll see: `Langfuse API keys not found. Tracing will be disabled.` (safe no‑op)

- Wrong base URL or keys
  - Ensure `LANGFUSE_HOST` or `LANGFUSE_BASE_URL` matches your self‑host/cloud URL.
  - Double‑check `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` in the environment used by the running server.

## Quick Checklist

- Add trace/generation with safe optional chaining
- Include small, useful `input`/`output` fields
- End both generation and trace in `finally`
- Avoid secrets and PII in logs

