# Quick Spec: HowTo Agent (App Guidance + UX Research + GTM Coaching)

## 1. Problem
Users ask "how do I do X in Upsight?" and "what should I do for comparison/segmentation/ICP-fit?" but current responses can be mixed between:
- product navigation help,
- strategic recommendations,
- execution actions.

This causes inconsistent quality, avoidable token spend, and confusion about what Uppy should do vs what the user should do.

## 2. Decision (Recommended)
Build **one new `howtoAgent` now**, with two internal discipline modes:
1. `ux_research_mode`
2. `gtm_mode`

Do **not** split into two separate agents yet. Split later only if:
- sustained traffic shows clear separation,
- prompts/tooling diverge materially,
- latency or quality improves from specialization.

Reasoning:
- lower orchestration complexity now,
- better consistency in "how-to" tone/format,
- keeps routing simple while project-status orchestration is still being optimized.

## 3. Scope
### In Scope
- App-specific how-to guidance (navigation, workflows, "where to click", best sequence).
- Playbook guidance for:
  - comparison workflows,
  - segmentation,
  - ICP fit and ICP data quality improvement.
- "How to ask Uppy better" prompt coaching.
- Domain framing from curated principle packs (not quotes):
  - UX/HCI: Norman, Ive, Jobs-inspired heuristics.
  - GTM/PLG: a16z, Lenny-inspired heuristics.
  - Research rigor: Judd Antin-style evidence quality rules.

### Out of Scope (Phase 1)
- Direct data mutation from `howtoAgent` (create/update/delete records).
- Long-running research or batch operations.
- Replacing `chiefOfStaffAgent` strategy role.

## 4. User Outcomes
- Users get fast, consistent "how-to" answers in one response pattern.
- Users can immediately navigate to the right screen with links.
- Users get concrete, low-token guidance for comparison/segmentation/ICP tasks.
- Uppy quality improves because execution is delegated; guidance is standardized.

## 5. Response Contract (Standardized)
Every `howtoAgent` response should use:
1. **Direct answer** (1-2 lines)
2. **Do this now** (3-5 numbered steps)
3. **Prompt to use with Uppy** (1-2 reusable prompt templates)
4. **Quick links** (relevant in-app paths)
5. **If stuck** fallback line

If confidence is low: explicitly say what is uncertain and how to verify.

## 6. Functional Requirements
### FR1 Routing
`projectStatusAgent` routes "how do I", "where do I", "best way to", "teach me", "what should I ask Uppy" intent to `howtoAgent`.

### FR2 Fast Guidance
`howtoAgent` defaults to low-cost model + low max steps.

### FR3 Read-Only by Default
`howtoAgent` only uses read/navigation tools in Phase 1.

### FR4 App-Aware Links
All guidance includes clickable links to relevant pages.

### FR5 Comparison Playbook
Must answer "what do person A and person B have in common/different?" with repeatable method.

### FR6 Segmentation Playbook
Must explain how to cluster by roles/segments/facets and validate segment quality.

### FR7 ICP Playbook
Must explain ICP fit scoring interpretation and data-quality fixes (missing title/company etc).

### FR8 Prompt Coaching
Must provide optimized prompt examples for users to ask Uppy.

### FR9 Discipline Modes
Select `ux_research_mode` or `gtm_mode` (or combined) per request.

### FR10 Principle Packs
Use internal principle packs as guidance constraints (heuristics/checklists), not citations.

### FR11 Fallback Reliability
Never return blank response. Must always return a safe fallback answer.

### FR12 Debug Support
Respect `/debug` and return concise reasoning/tool trace after answer.

## 7. Non-Functional Requirements
- P50 response time target: <= 3.0s for standard how-to prompts.
- Average token budget reduction vs current generic project-status replies: >= 35%.
- Zero blank-response tolerance for routed how-to turns.
- All responses include at least one actionable step.

## 8. Proposed Tool Surface (Phase 1)
Read/navigation only:
- `capabilityLookup`
- `generateProjectRoutes`
- `fetchProjectStatusContext` (minimal scopes)
- `fetchPeopleDetails` (default evidence off, facets on)
- `recommendNextActions` (optional for context)

No mutating tools in Phase 1.

## 9. Architecture
- Keep `projectStatusAgent` as orchestrator/router.
- Add `howtoAgent` as specialist sub-agent under orchestrator network.
- Add classifier label: `howto_guidance`.
- Reuse link-guarantee and empty-response fallback protections in chat route.

## 10. Stories (<= 12)
### Story 1: Route how-to intent to new specialist
As a user, when I ask how to do something, I get routed to `howtoAgent`.

### Story 2: Standardized response format
As a user, I get the same high-clarity structure for every how-to answer.

### Story 3: App link inclusion
As a user, I can click directly to the screens mentioned in guidance.

### Story 4: Comparison workflow help
As a user, I can ask how to compare people and get concrete steps + prompt templates.

### Story 5: Segmentation workflow help
As a user, I can ask how to segment people and validate segment quality.

### Story 6: ICP-fit workflow help
As a user, I can ask how to improve ICP confidence and scoring coverage.

### Story 7: Prompt-coaching output
As a user, I get reusable "ask Uppy like this" prompt snippets.

### Story 8: UX-research discipline mode
As a user, I receive UX-research-specific heuristics when appropriate.

### Story 9: GTM discipline mode
As a user, I receive GTM-specific heuristics when appropriate.

### Story 10: Reliability fallback
As a user, I never get empty output; I get a fallback message if tool/model fails.

### Story 11: `/debug` trace support
As a user, I can inspect routing/tool trace for troubleshooting.

### Story 12: Evaluation + benchmark harness
As a team, we can run smoke prompts and snapshot quality/latency regressions.

## 11. Acceptance Criteria
- How-to prompts route to `howtoAgent` with >= 0.8 routing confidence.
- 100% of `howtoAgent` answers include:
  - direct answer,
  - numbered action steps,
  - at least 1 in-app link.
- Comparison/segmentation/ICP prompts produce domain-relevant guidance (no unrelated theme snapshots).
- `/debug` yields trace after answer.
- No blank responses in smoke suite.
- `test:agents` and integration baseline remain green after rollout.

## 12. Metrics
- Routing precision for how-to intents.
- Response quality score (human rubric):
  - correctness,
  - actionability,
  - navigability,
  - brevity.
- Latency and token usage deltas vs current baseline.
- Follow-through metric: clicks on suggested links/prompts.

## 13. Phase Plan
### Phase A (MVP)
- Add `howtoAgent`.
- Add routing label and response contract.
- Ship with read-only tool surface and fallback protection.

### Phase B
- Add explicit principle packs (UX/HCI + GTM + research rigor) in prompt assets.
- Add smoke benchmark dashboard snapshots.

### Phase C (Optional Split)
- Split into two agents (`uxResearchCoachAgent`, `gtmCoachAgent`) only if data supports.

## 14. Applicability Boundaries (Bryan Feedback)
This spec addresses the **guidance/coaching** slice of Bryan's feedback, not the full trust/auditability product surface.

### Covered Here (HowTo Agent)
- Best-practice coaching baked into question creation (guidance layer)
- Comparison/segmentation/ICP-fit how-to workflows
- Prompt coaching ("how to ask Uppy for better answers")
- Quality-oriented framing in assistant responses (assistant, not replacement)
- Benchmark hooks for response quality/latency snapshots

### Out of Scope Here (handled by Trust/Auditability epic)
- Transcript-level audit drawer and side-by-side source verification
- Evidence grooming workflows (reject/edit/reclassify/manual add)
- Teach-the-agent correction loop that re-runs classification
- Taxonomy management and role-based permissions
- Advanced/Researcher mode UX

Reference implementation stream: `Insights-gepv` and children.
