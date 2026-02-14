# Person Page PM + UX Teardown (Party Mode)

Date: 2026-02-09
Surface: Person detail + people list mobile card view
Focus: Usefulness, actionability, and mobile responsiveness

## Executive Assessment

Overall status: **Good foundation, weak actionability in key moments**.

The page is information-rich but several states do not help users move to the next best action. The biggest gap was ICP showing "Unscored" with no immediate path to score. Mobile dark mode contrast also reduced scannability in list/card browsing.

## Priority Findings (Most Important First)

1. **P0 - ICP "Unscored" had no direct action**
- Problem: Users saw "Unscored" but no in-context control.
- Impact: Decision workflow stalls; value of scorecard is reduced.
- Fix: Add `Score ICP` CTA on the badge block, support auto-trigger when likely scorable, and show "we are working" feedback.

2. **P1 - ICP detection logic had mismatch risk**
- Problem: Person detail was reading `person_scale.kind_slug === "icp"` while scoring pipeline writes `"icp_match"`.
- Impact: Valid scores can be missed, causing false "Unscored" state.
- Fix: Resolve with `icp_match` first, keep `icp` fallback for compatibility.

3. **P1 - Dark mode mobile card surfaces blended together**
- Problem: Low surface separation between background/card/chips in dark mode.
- Impact: Scanning speed drops and hierarchy is unclear.
- Fix: Increase global token separation and add stronger card-level surface treatment for person cards.

4. **P1 - Duplicate dismiss affordance in mobile hamburger sheet**
- Problem: Two close controls appeared due to default Sheet close + custom close button.
- Impact: Visual noise and potential tap confusion.
- Fix: Keep single close affordance.

5. **P1 - Quick note completion did not refresh page evidence context**
- Problem: New note save did not immediately refresh person/sources data.
- Impact: Users distrust whether action succeeded.
- Fix: Revalidate route loader after successful quick note save.

## Actionability Scorecard (Before -> After)

- ICP state to action: **2/5 -> 4/5**
- Mobile scanability: **2/5 -> 3.5/5**
- Feedback immediacy after note actions: **2/5 -> 4/5**
- Navigation clarity on mobile menu: **2.5/5 -> 4/5**

## Implemented in This Pass

1. In-person-page ICP scoring flow
- Added person detail action intent `score-icp`.
- Added in-context `Score ICP` CTA.
- Added loading feedback while scoring.
- Added auto-kickoff scoring on load when likely scorable.
- Added refresh/revalidate on successful score completion.

2. ICP data correctness
- Person detail now resolves scale using `icp_match` (with `icp` fallback).

3. Dark mode contrast improvements
- Strengthened global dark tokens for surface/border separation.
- Improved people card dark surface contrast and chip contrast.

4. Quick note revalidation
- Person detail and Sources now revalidate after successful note save.

5. Mobile menu close UX
- Removed duplicate close control from hamburger sheet header.

## Remaining Recommendations (Next Stories)

1. **Make "Recommended Next Steps" clickable actions**
- Current state: mostly advisory text.
- Story: each step should map to an executable CTA (schedule follow-up, send survey, run ICP, add note).
- Acceptance criteria:
  - Every displayed step includes a CTA button or link.
  - CTR and completion can be instrumented.

2. **Add ICP scoring reason transparency**
- Current state: score shown, little explanation.
- Story: expose why score is high/medium/low (role/org/size signals and missing dimensions).
- Acceptance criteria:
  - Badge hover/click opens score rationale.
  - Shows at least: matched criteria, missing criteria, confidence.

3. **Prevent re-run fatigue for indeterminate ICP**
- Current state: auto-score is one-time per mount, but users may still manually retry without guidance.
- Story: if indeterminate, show explicit guidance: "Add title/org/size data to score ICP".
- Acceptance criteria:
  - Indeterminate result shows required fields checklist.
  - CTA links to edit person fields.

4. **Stats row should be drill-down actionable**
- Current state: Convos/Surveys/Notes/Chats are informative only.
- Story: chips navigate to filtered evidence/timeline state.
- Acceptance criteria:
  - Tap on each chip opens corresponding filtered evidence view.

5. **Mobile first card mode persistence**
- Current state: defaults to card mode on mobile only after mount logic.
- Story: persist user view preference by breakpoint and route.
- Acceptance criteria:
  - Mobile remembers card/table preference across reloads.
  - Default remains card on first mobile visit.

## Suggested Tracking Metrics

- ICP score adoption rate: `% person views that trigger ICP scoring`.
- Time-to-first-action on person page.
- Note-save confirmation latency (save -> visible in timeline).
- Mobile person page bounce/exit rate.
- Tap-through rate on recommended next-step actions.
