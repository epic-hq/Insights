# Quick Spec: Bryan Feedback Applicability and Execution Map

## 1. Summary
Bryan's feedback is highly applicable and should be treated as a **trust architecture roadmap**, not a UI polish list.

Core interpretation:
- Trust and auditability are adoption-critical for researcher users.
- AI value is controllability + traceability, not summary speed.
- Upsight should position as "research acceleration with evidence receipts," not replacement.

## 2. Mapping: Feedback -> Implementation Track

| # | Feedback request | Track | Bead mapping |
|---|------------------|-------|--------------|
| 1 | Project context reliably used by AI | Analysis quality | `Insights-5uaj` |
| 2 | Best-practice coaching in question creation | Guidance/agent | `Insights-gum5`, `Insights-7a00` |
| 3 | Objective ↔ question linkage UI | Research design UX | `Insights-l6k9` |
| 4 | Transcript-level auditability | Trust UX | `Insights-64cp`, `Insights-gepv` |
| 5 | Evidence grooming workflow | Trust UX + controls | `Insights-xrv5` |
| 6 | Side drawer pattern for context | Trust UX | `Insights-64cp` |
| 7 | Teach-the-agent correction loop | Learning loop | `Insights-thbp` |
| 8 | Global + project taxonomy/lenses | Taxonomy system | `Insights-3je1` |
| 9 | Role-based permissions | Governance | `Insights-bf3b` |
| 10 | Advanced mode (progressive disclosure) | UX architecture | `Insights-dg46` |
| 11 | Benchmark harness vs expert coders | Quality ops | `Insights-r055`, `Insights-7ajv` |
| 12 | Quality > speed positioning | Messaging/product UX | `Insights-9ek8` |

## 3. Product Architecture Decision
Two parallel streams:
1. **HowTo/Coaching stream** (agent guidance quality, low latency, app-howto).
2. **Trust/Auditability stream** (evidence receipts, editing, taxonomy governance, benchmarking).

Do not merge these into a single monolithic agent/project. They should integrate, but remain separable execution tracks.

## 4. Phase Plan

### Phase 1 (now)
- Deliver reliable routing and standardized guidance responses (`Insights-7a00`, `Insights-x6zh`, `Insights-7491`).
- Ship transcript verification drawer and context linkage (`Insights-64cp`).
- Strengthen project-context injection in analysis (`Insights-5uaj`).

### Phase 2
- Deliver evidence grooming and objective-question linkage (`Insights-xrv5`, `Insights-l6k9`).
- Surface taxonomy controls (`Insights-3je1`) and role permissions (`Insights-bf3b`).

### Phase 3
- Add teach-the-agent correction loop (`Insights-thbp`).
- Add advanced/researcher mode (`Insights-dg46`).
- Operationalize benchmark harness with expert baseline (`Insights-r055` + `Insights-7ajv`).

## 5. Acceptance Criteria for "applicable"
We should consider Bryan feedback "applied" when:
1. Users can trace any insight to transcript evidence in <= 2 clicks.
2. Users can reject/edit/reclassify AI outputs and see downstream effect.
3. AI analysis explicitly references project objectives/decision questions.
4. Core taxonomy edits are permissioned and auditable.
5. Benchmark reports show trendable precision/recall vs expert-coded set.
