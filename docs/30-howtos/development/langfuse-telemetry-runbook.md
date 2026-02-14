# Langfuse Telemetry Runbook

## Goal

Make Langfuse traces consistently show:

- Input + output
- Token usage
- Cost (USD)

for `api.chat.*` and agent flows.

## Mental Model (Plain English)

- `Trace`: one full request lifecycle (for example: one `api.chat.project-status` call).
- `Generation`: one LLM call inside that trace.
- `Span`: any timed step; generation is a specialized span for model calls.
- `Usage`: token counts.
- `UsageDetails`: detailed token metrics (preferred modern Langfuse shape).
- `CostDetails`: USD costs by category (`total`, and optionally `input`/`output`).

Rule of thumb: **usage/cost belongs on generations/spans, not on the top-level trace**.

## Required Wiring Pattern

1. Start a trace at route entry.
2. Start a generation for the model execution.
3. On completion (or error), end the generation with:
   - `usage`
   - `usageDetails`
   - `costDetails`
4. Update/end the trace with high-level request output and metadata.

## Canonical Payload Shapes

```ts
// Generation payload (recommended)
{
  usage: { input: 123, output: 45, total: 168 },
  usageDetails: { input: 123, output: 45, total: 168 },
  costDetails: { total: 0.0042 }
}
```

```ts
// Trace payload (keep for top-level context)
{
  input: { ... },
  output: { ... },
  metadata: { ... }
}
```

## Why Data Goes Missing

Common failure mode:

- Tokens/cost are written via `trace.update(...)` only.
- Langfuse UI then shows input/output, but token/cost fields are blank.

Fix:

- Emit token/cost fields on `generation.end(...)` (or `generation.update(...)` + `generation.end(...)`).

## Project-Specific Notes

- `api.chat.project-status` now records:
  - trace input/output metadata on `api.chat.project-status`
  - usage/cost on generation `api.chat.project-status.route`
- For stream flows, finalize usage/cost inside `onFinish`.
- For early failures, end generation with `level: "ERROR"` and `statusMessage`.

## Verification Checklist

1. Trigger one chat request in dev.
2. Open Langfuse trace `api.chat.project-status`.
3. Confirm generation row has:
   - non-empty usage/usageDetails
   - non-empty costDetails
4. Confirm top-level trace still has input/output.
5. Confirm app billing logs and Langfuse totals are directionally aligned.

## Quick Troubleshooting

- Missing usage/cost but output exists:
  - Check if usage/cost was sent to trace instead of generation.
- Input present, output missing:
  - Ensure error paths call `generation.end(...)` and `trace.end(...)`.
- Intermittent blanks:
  - Confirm every control path (success, early return, catch) ends generation/trace.
