# Agent Evaluation Checklist

Use this checklist for any new or updated agent, tool, or workflow.

---

## Design Review

- Decision rule applied (single LLM call > workflow > agent > multi-agent).
- Tool set kept minimal; tools are semantic, not API-shaped.
- Tool outputs have response_format or clear truncation controls.
- All LLM outputs are schema-validated (BAML preferred).

---

## Safety & Reliability

- Destructive actions require explicit confirmation.
- Timeouts and retries are implemented for tool calls.
- Circuit breakers and graceful fallbacks exist for external dependencies.
- Checkpointing or resumable execution is in place for long tasks.

---

## Observability

- Logging captures inputs, tool calls, outputs, errors, and recovery actions.
- Token usage and latency are tracked per run.
- Trace review is feasible (Langfuse or equivalent).

---

## Evaluation

- At least 20 realistic test cases exist.
- Failure modes are covered (loops, hallucination cascades, missing context).
- Metrics tracked: accuracy, tool calls, token usage, latency, error rate.

---

## Launch Readiness

- Human escalation path is defined.
- Permissions and least-privilege rules are enforced.
- Post-launch monitoring plan is documented.
