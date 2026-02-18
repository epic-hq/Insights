# Gen-UI Widget Family Spec: Time-to-Aha JTBD Flow

**Date:** 2026-02-18
**Status:** Draft
**Author:** Architecture Agent

---

## Overview

This spec defines a family of gen-ui widgets that map to the 9-step "Time-to-Aha" flow in UpSight. Each widget is designed to be rendered inline in the AI chat via the existing `displayComponentTool` mechanism. The widgets follow Sally's editorial design language: conversational, focused, one-thing-at-a-time.

The existing component registry (`app/lib/gen-ui/component-registry.ts`) has ~20 components registered via `defineComponent()` in `app/lib/gen-ui/registered-components.tsx`. This spec identifies which existing widgets map to each moment, what gaps exist, and provides full schemas for new widgets.

---

## Existing Component Mapping Table

| # | User Moment | Existing Widget(s) | Coverage | Gap |
|---|---|---|---|---|
| 1 | Frame the Decision | `ProjectContextStatus` | Partial | No decision framing, deadline, success metric, or "brief complete" gate |
| 2 | Choose Intake Path | (none) | None | New widget needed |
| 3A | Upload Interviews | `UploadRecording` | Good | Missing batch status / processing ETA |
| 3B | Live Recording | (none -- recording is in-page, not gen-ui) | N/A | Recording is a page feature, not a chat widget. No gap. |
| 3C | Email Survey Links | `SurveyCreated` | Partial | Missing recipient list, delivery funnel, send count |
| 4 | Intake Health | (none) | None | New widget needed -- the key "confidence gate" |
| 5 | Evidence Grounding | `EvidenceCard` | Partial | Single card only. Missing grouped-by-pain/goal view |
| 6 | Pattern Synthesis | `ThemeList`, `InsightCard` | Partial | ThemeList shows impact/novelty but not mention count or confidence tier |
| 7 | Decision Forcing | `ActionCards`, `TaskList` | Partial | Missing tradeoffs, effort/impact, commit with owners + dates |
| 8 | CRM Activation | `PeopleList`, `PersonCard` | Partial | Missing evidence/theme linkage in the list view |
| 9 | Close the Loop | `StatCard` | Minimal | Missing weekly delta, action tracking, confidence change |

**Meta-widget needed:** `ProgressRail` -- persistent across all 9 steps.

---

## ProgressRail Meta-Widget

### Widget Name: `ProgressRail`

This is a compact horizontal progress indicator that the agent renders at the start of any JTBD-flow interaction. It shows which phase the user is in and what comes next.

### Zod Schema

```typescript
export const progressRailPhaseSchema = z.object({
  id: z.enum(["frame", "collect", "validate", "commit", "measure"]),
  label: z.string(),
  status: z.enum(["complete", "active", "upcoming", "blocked"]),
  /** Conversational hint, e.g. "You need 2 more interviews" */
  hint: z.string().optional(),
});

export const progressRailDataSchema = z.object({
  phases: z.array(progressRailPhaseSchema).min(1).max(5),
  /** Which of the 9 moments is active right now */
  activeMoment: z.number().min(1).max(9).optional(),
  /** Editorial summary of where the user stands */
  statusLine: z.string(),
  /** The one thing to do next */
  nextAction: z.string().optional(),
  nextActionUrl: z.string().optional(),
});
```

### ASCII Wireframe

```
+-----------------------------------------------------------------------+
|  Frame Decision  >  Collect Signal  >  Validate Pattern  >  Commit    |
|  [checkmark]        [active-dot]       [upcoming]           [upcoming]|
+-----------------------------------------------------------------------+
| "Growing Confidence -- 6 interviews in, 2 strong themes emerging"     |
| [Next: Review your top themes ->]                                     |
+-----------------------------------------------------------------------+
```

### Agent Trigger

- Render at the start of any session where the user has an active project
- Re-render when a phase transition occurs (e.g., enough signal collected)
- Triggered by: "where am I", "what's my progress", "show my status", or proactively at session start

### Data Sources

- `fetchProjectStatusContextTool` (scopes: status, interviews, themes, insights)
- `recommendNextActionsTool` (for projectState.stage mapping)

### Primary CTA

Navigate to the next recommended action.

---

## Moment 1: Frame the Decision

### Existing vs New

`ProjectContextStatus` partially covers this but is a passive display of project metadata. It lacks the decision-framing structure: the specific decision being made, the deadline, the success metric, and the "Decision Brief complete" confirmation gate.

**Verdict:** NEW widget `DecisionBrief`.

### Widget Name: `DecisionBrief`

### Zod Schema

```typescript
export const decisionBriefDataSchema = z.object({
  projectId: z.string(),
  /** The core decision question, e.g. "Should we build feature X?" */
  decisionQuestion: z.string().nullable(),
  /** Who is the target customer for this decision */
  targetCustomer: z.string().nullable(),
  /** When does this decision need to be made */
  deadline: z.string().nullable(),
  /** What does success look like */
  successMetric: z.string().nullable(),
  /** Research questions that support the decision */
  researchQuestions: z.array(z.string()).optional(),
  /** Current completeness of the brief */
  completeness: z.object({
    hasDecision: z.boolean(),
    hasTarget: z.boolean(),
    hasDeadline: z.boolean(),
    hasMetric: z.boolean(),
    hasQuestions: z.boolean(),
  }),
  /** Conversational label: "Almost there" / "Ready to go" / "Needs framing" */
  readinessLabel: z.string(),
  editUrl: z.string().optional(),
});
```

### ASCII Wireframe

```
+-----------------------------------------------------------------------+
| DECISION BRIEF                                     [Edit ->]          |
+-----------------------------------------------------------------------+
|                                                                       |
| "Should we invest in a self-serve onboarding flow?"                   |
|                                                                       |
| For: Mid-market SaaS ops leads                                        |
| Decide by: March 15                                                   |
| Success looks like: 20% reduction in onboarding tickets               |
|                                                                       |
| Research questions:                                                   |
|   1. What blocks self-serve adoption today?                           |
|   2. Which persona segments would use it?                             |
|   3. What's the cost of doing nothing?                                |
|                                                                       |
+-----------------------------------------------------------------------+
| [checkmark] Decision framed  [checkmark] Target set  [x] No deadline |
|                                                                       |
| "Almost there -- add a deadline to complete your brief"               |
| [Set a deadline ->]                                                   |
+-----------------------------------------------------------------------+
```

### Agent Trigger

- "what decision am I making", "help me frame the problem", "set up my research"
- Proactively when a new project has no goals or research questions set
- After `recommendNextActionsTool` returns stage=`setup`

### Data Sources

- `fetchProjectStatusContextTool` (scopes: status, sections)
- `fetchProjectGoalsTool` for research questions
- Project `project_settings` for deadline/metric if stored there

### Primary CTA

"Complete your brief" -- navigates to project setup or triggers inline editing.

---

## Moment 2: Choose Intake Path

### Existing vs New

No existing widget covers this. This is a routing/decision widget that presents three intake paths.

**Verdict:** NEW widget `IntakePathPicker`.

### Widget Name: `IntakePathPicker`

### Zod Schema

```typescript
export const intakePathOptionSchema = z.object({
  id: z.enum(["upload", "record", "survey"]),
  label: z.string(),
  description: z.string(),
  /** e.g. "Fastest if you have recordings" */
  hint: z.string().optional(),
  /** Whether this path has already been started */
  started: z.boolean().optional(),
  /** Count of items already in this path */
  count: z.number().optional(),
  /** Icon name from lucide-react */
  icon: z.string().optional(),
  /** URL to navigate to when selected */
  actionUrl: z.string().optional(),
});

export const intakePathPickerDataSchema = z.object({
  projectId: z.string(),
  accountId: z.string(),
  title: z.string().optional(),
  /** Editorial prompt, e.g. "How do you want to get signal?" */
  prompt: z.string().optional(),
  paths: z.array(intakePathOptionSchema).min(1).max(4),
  /** Which path the agent recommends based on context */
  recommendedPath: z.enum(["upload", "record", "survey"]).optional(),
});
```

### ASCII Wireframe

```
+-----------------------------------------------------------------------+
| How do you want to get signal?                                        |
+-----------------------------------------------------------------------+
|                                                                       |
| +-------------------+  +-------------------+  +-------------------+   |
| | [Upload icon]     |  | [Mic icon]        |  | [Mail icon]       |   |
| | Upload            |  | Live Recording    |  | Send Surveys      |   |
| | interviews        |  |                   |  |                   |   |
| |                   |  | Capture a fresh   |  | Collect responses |   |
| | Get existing      |  | conversation now  |  | from real people  |   |
| | recordings in now |  |                   |  |                   |   |
| |                   |  |                   |  |                   |   |
| | [Start ->]        |  | [Start ->]        |  | [Start ->]        |   |
| +-------------------+  +-------------------+  +-------------------+   |
|                                     * Recommended for you             |
+-----------------------------------------------------------------------+
```

### Agent Trigger

- "how do I get started", "I need to collect data", "what's the fastest way"
- After Decision Brief is marked complete
- When `recommendNextActionsTool` returns stage=`discovery` with no interviews

### Data Sources

- `fetchProjectStatusContextTool` (scopes: status, interviews) for counts
- `recommendNextActionsTool` for recommended path
- `generateProjectRoutesTool` for actionUrls

### Primary CTA

Select an intake path (renders the appropriate widget for that path).

---

## Moment 3A: Upload Interviews

### Existing vs New

`UploadRecording` already handles single file upload with drag-drop, progress, and success state. What is missing is batch awareness: how many files have been uploaded, processing status across multiple files, and an overall ETA.

**Verdict:** ENHANCE existing `UploadRecording` + NEW companion widget `IntakeBatchStatus`.

### Widget Name: `IntakeBatchStatus`

### Zod Schema

```typescript
export const intakeItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.enum(["upload", "recording", "survey", "import"]),
  status: z.enum(["queued", "processing", "ready", "failed"]),
  /** e.g. "3 insights extracted" */
  resultSummary: z.string().optional(),
  detailUrl: z.string().optional(),
});

export const intakeBatchStatusDataSchema = z.object({
  projectId: z.string(),
  items: z.array(intakeItemSchema),
  /** Counts by status */
  summary: z.object({
    total: z.number(),
    ready: z.number(),
    processing: z.number(),
    failed: z.number(),
  }),
  /** Conversational status: "3 of 5 interviews processed" */
  statusLine: z.string(),
  /** Whether enough signal has been collected to move on */
  signalGate: z.object({
    sufficient: z.boolean(),
    message: z.string(),
  }).optional(),
  uploadMoreUrl: z.string().optional(),
});
```

### ASCII Wireframe

```
+-----------------------------------------------------------------------+
| INTAKE STATUS                                        3 of 5 ready     |
+-----------------------------------------------------------------------+
|                                                                       |
| [checkmark] VP Product interview.mp3      12 insights extracted       |
| [checkmark] Sales lead call.m4a           8 insights extracted        |
| [checkmark] Customer feedback.pdf         5 insights extracted        |
| [spinner]   Onboarding session.mp4        Transcribing...             |
| [x]         Corrupted file.wav            Upload failed               |
|                                                                       |
+-----------------------------------------------------------------------+
| "3 conversations analyzed, 25 evidence points so far.                 |
|  You could use more VP-level signal."                                 |
| [Upload another ->]                                                   |
+-----------------------------------------------------------------------+
```

### Agent Trigger

- "how are my uploads doing", "processing status", "are my interviews ready"
- Proactively after 2+ files have been uploaded in a session
- When user asks "do I have enough data"

### Data Sources

- `fetchProjectStatusContextTool` (scopes: interviews) for interview list + status
- Interview `status` field (processing/ready/failed)
- Evidence counts per interview

### Primary CTA

"Upload another" (renders `UploadRecording`) or "Review your evidence" (if gate passed).

---

## Moment 3B: Live Recording

This is handled by the existing in-page recording feature (not a gen-ui widget). The chat agent can navigate the user to the recording page using `navigateToPageTool`. No new widget needed.

---

## Moment 3C: Email Survey Links

### Existing vs New

`SurveyCreated` shows confirmation after creation. What is missing is the outreach/distribution view: who to send to, message preview, send count, and delivery funnel.

**Verdict:** NEW widget `SurveyOutreach`.

### Widget Name: `SurveyOutreach`

### Zod Schema

```typescript
export const surveyOutreachRecipientSchema = z.object({
  email: z.string(),
  name: z.string().optional(),
  status: z.enum(["pending", "sent", "opened", "completed", "bounced"]).optional(),
});

export const surveyOutreachDataSchema = z.object({
  surveyId: z.string(),
  surveyName: z.string(),
  publicUrl: z.string(),
  /** Recipients to show */
  recipients: z.array(surveyOutreachRecipientSchema).optional(),
  /** Message preview for the outreach */
  messagePreview: z.string().optional(),
  /** Delivery funnel summary */
  funnel: z.object({
    sent: z.number(),
    opened: z.number(),
    completed: z.number(),
    bounced: z.number(),
  }).optional(),
  /** Conversational status line */
  statusLine: z.string(),
  /** URL to manage the survey */
  editUrl: z.string().optional(),
  /** URL to add more recipients */
  addRecipientsUrl: z.string().optional(),
});
```

### ASCII Wireframe

```
+-----------------------------------------------------------------------+
| SURVEY: Customer Onboarding Feedback                                  |
+-----------------------------------------------------------------------+
|                                                                       |
| Share this link:                                                      |
| [https://app.upsight.ai/s/abc123]  [Copy]                           |
|                                                                       |
| Or send via email:                                                    |
|  To: sarah@acme.com, mike@beta.co, +3 more                          |
|                                                                       |
|  "Hi {name}, we'd love your input on..."  [Edit message]             |
|                                                                       |
+-----------------------------------------------------------------------+
| Delivery:  5 sent  |  3 opened  |  1 completed  |  0 bounced         |
|                                                                       |
| "1 response in -- you need at least 5 for useful signal"             |
| [Add more recipients ->]                                              |
+-----------------------------------------------------------------------+
```

### Agent Trigger

- "send surveys", "share the survey link", "who should I send this to"
- After `createSurveyTool` completes successfully
- When user asks "how are my survey responses coming in"

### Data Sources

- `fetchSurveysTool` for survey metadata
- `searchSurveyResponsesTool` for response counts
- Survey response data for funnel metrics

### Primary CTA

"Copy link" or "Add more recipients".

---

## Moment 4: Intake Health

### Existing vs New

No existing widget covers this. This is the critical "confidence gate" widget that tells the user whether they have enough signal to draw conclusions.

**Verdict:** NEW widget `IntakeHealth` -- the most important new widget in this spec.

### Widget Name: `IntakeHealth`

### Zod Schema

```typescript
export const coverageSegmentSchema = z.object({
  label: z.string(),
  /** e.g. "VP Engineering", "SMB customers" */
  count: z.number(),
  target: z.number().optional(),
  /** Source breakdown */
  sources: z.object({
    interviews: z.number(),
    surveys: z.number(),
    documents: z.number(),
  }).optional(),
});

export const intakeHealthDataSchema = z.object({
  projectId: z.string(),
  /** Overall confidence tier */
  confidenceTier: z.enum(["early_signal", "growing_confidence", "decision_ready"]),
  /** Conversational label: "Early Signal", "Growing Confidence", "Decision-Ready" */
  confidenceLabel: z.string(),
  /** Editorial summary: "You have strong VP signal but need more IC perspectives" */
  summary: z.string(),
  /** Coverage by persona/segment */
  coverage: z.array(coverageSegmentSchema).optional(),
  /** Source mix */
  sourceMix: z.object({
    interviews: z.number(),
    surveys: z.number(),
    documents: z.number(),
  }),
  /** Total evidence count */
  totalEvidence: z.number(),
  /** Freshness: days since most recent intake */
  daysSinceLastIntake: z.number().optional(),
  /** What's missing -- conversational nudges */
  gaps: z.array(z.string()).optional(),
  /** Whether the gate is passed */
  gateStatus: z.enum(["insufficient", "marginal", "sufficient"]),
  /** What to do next based on gate status */
  nextAction: z.string(),
  nextActionUrl: z.string().optional(),
});
```

### ASCII Wireframe

```
+-----------------------------------------------------------------------+
| INTAKE HEALTH                                   Growing Confidence    |
|                                                  [amber indicator]    |
+-----------------------------------------------------------------------+
|                                                                       |
| "You have solid signal from 6 interviews, but your survey             |
|  response rate is low. Consider a follow-up nudge."                   |
|                                                                       |
| Coverage:                                                             |
|   VP Engineering     ||||||||-- (4/5)   Strong                        |
|   Product Managers   ||||------ (2/5)   Needs more                    |
|   End Users          ||-------- (1/5)   Thin                          |
|                                                                       |
| Sources:  6 interviews  |  2 surveys  |  1 document                   |
| Evidence: 47 data points                                              |
| Last intake: 2 days ago                                               |
|                                                                       |
+-----------------------------------------------------------------------+
| Gaps:                                                                 |
|  - "You need 3 more end-user interviews for balanced coverage"        |
|  - "Your survey has 2 responses -- nudge the other 8 recipients"      |
|                                                                       |
| [Send survey reminders ->]                                            |
+-----------------------------------------------------------------------+
```

### Agent Trigger

- "do I have enough data", "is my signal strong enough", "intake health"
- "am I ready to draw conclusions", "should I collect more"
- Proactively when the user has been collecting data and hasn't checked health
- After 3+ interviews are processed

### Data Sources

- `fetchProjectStatusContextTool` (scopes: status, interviews, people, personas)
- `fetchPersonasTool` for persona coverage
- `fetchSurveysTool` / `searchSurveyResponsesTool` for survey metrics
- `recommendNextActionsTool` for gap analysis

### Primary CTA

Dynamic: "Collect more signal" (if insufficient) or "Start reviewing patterns" (if sufficient).

---

## Moment 5: Evidence Grounding

### Existing vs New

`EvidenceCard` shows individual evidence well. What is missing is a grouped view that clusters evidence by pain/goal with source traceability.

**Verdict:** NEW widget `EvidenceWall`.

### Widget Name: `EvidenceWall`

### Zod Schema

```typescript
export const evidenceClusterSchema = z.object({
  /** Grouping label, e.g. "Onboarding friction" or "Pricing confusion" */
  label: z.string(),
  /** Whether this is a pain, goal, or neutral observation */
  type: z.enum(["pain", "goal", "observation"]),
  /** Evidence items in this cluster */
  items: z.array(z.object({
    id: z.string(),
    verbatim: z.string(),
    speakerName: z.string().nullable(),
    speakerTitle: z.string().nullable(),
    interviewTitle: z.string().nullable(),
    detailUrl: z.string().optional(),
  })).min(1),
  /** How many total items (may be more than shown) */
  totalCount: z.number(),
});

export const evidenceWallDataSchema = z.object({
  projectId: z.string(),
  /** Editorial headline: "Here's what your customers actually said" */
  headline: z.string().optional(),
  clusters: z.array(evidenceClusterSchema),
  /** Total evidence count across all clusters */
  totalEvidence: z.number(),
  /** How many unique sources (people) contributed */
  uniqueSources: z.number(),
  viewAllUrl: z.string().optional(),
});
```

### ASCII Wireframe

```
+-----------------------------------------------------------------------+
| HERE'S WHAT YOUR CUSTOMERS ACTUALLY SAID                              |
| 47 evidence points from 8 people                                      |
+-----------------------------------------------------------------------+
|                                                                       |
| [red] ONBOARDING FRICTION (12 mentions)                               |
| +------------------------------------------------------------------+  |
| | "I spent 3 hours just trying to set up the integration"          |  |
| | -- Sarah Chen, VP Eng @ Acme  [View source ->]                   |  |
| +------------------------------------------------------------------+  |
| | "Nobody told us there was a setup wizard. We did it manually."   |  |
| | -- Mike R., Product Lead @ Beta  [View source ->]                |  |
| +------------------------------------------------------------------+  |
| | +2 more...                                                       |  |
|                                                                       |
| [blue] FASTER DECISIONS (8 mentions)                                  |
| +------------------------------------------------------------------+  |
| | "If I could get a weekly summary of what my team learned, that   |  |
| |  would change everything"                                        |  |
| | -- Jamie Walsh, Head of Research @ Gamma  [View source ->]       |  |
| +------------------------------------------------------------------+  |
|                                                                       |
| [View all evidence ->]                                                |
+-----------------------------------------------------------------------+
```

### Agent Trigger

- "show me the evidence", "what did people actually say", "ground me in the data"
- "show me real quotes", "what are the top pain points", "customer voice"
- After Intake Health shows sufficient signal

### Data Sources

- `semanticSearchEvidenceTool` for targeted queries
- `fetchProjectStatusContextTool` (scopes: evidence, people)
- `fetchTopThemesWithPeopleTool` for theme-to-people linkage

### Primary CTA

"View all evidence" or "Start grouping into themes".

---

## Moment 6: Pattern Synthesis

### Existing vs New

`ThemeList` shows themes with impact/novelty scores but lacks mention counts, confidence tiers, and the editorial framing needed for synthesis. `InsightCard` is for individual insights.

**Verdict:** NEW widget `PatternSynthesis`.

### Widget Name: `PatternSynthesis`

### Zod Schema

```typescript
export const patternSchema = z.object({
  id: z.string(),
  name: z.string(),
  statement: z.string().nullable(),
  /** Number of evidence mentions backing this pattern */
  mentionCount: z.number(),
  /** Confidence tier based on evidence depth */
  confidenceTier: z.enum(["thin", "emerging", "strong", "validated"]),
  /** Conversational confidence label */
  confidenceLabel: z.string(),
  /** Top verbatim quotes supporting this pattern */
  topQuotes: z.array(z.object({
    verbatim: z.string(),
    speakerName: z.string().nullable(),
  })).optional(),
  /** How many unique people mentioned this */
  uniqueSources: z.number().optional(),
  detailUrl: z.string().optional(),
});

export const patternSynthesisDataSchema = z.object({
  projectId: z.string(),
  /** Editorial headline */
  headline: z.string().optional(),
  /** Summary of what patterns mean together */
  narrativeSummary: z.string().optional(),
  /** Ranked patterns */
  patterns: z.array(patternSchema),
  /** How many patterns are strong vs thin */
  distribution: z.object({
    strong: z.number(),
    emerging: z.number(),
    thin: z.number(),
  }).optional(),
  /** Next action based on pattern state */
  nextAction: z.string().optional(),
  nextActionUrl: z.string().optional(),
});
```

### ASCII Wireframe

```
+-----------------------------------------------------------------------+
| WHAT REPEATS AND WHAT MATTERS                                         |
| "3 strong patterns across 8 interviews. 2 need more signal."         |
+-----------------------------------------------------------------------+
|                                                                       |
| [green] STRONG: Onboarding friction                   14 mentions     |
| "Users consistently struggle with initial setup"      from 6 people   |
|   > "I spent 3 hours..." -- Sarah C.                                 |
|   > "Nobody told us..." -- Mike R.                                   |
|   [View pattern ->]                                                   |
|                                                                       |
| [green] STRONG: Need for weekly summaries             11 mentions     |
| "Decision-makers want regular synthesis"              from 5 people   |
|   > "A weekly summary would change everything" -- Jamie W.           |
|   [View pattern ->]                                                   |
|                                                                       |
| [amber] EMERGING: Pricing confusion                    5 mentions     |
| "Some users report unclear pricing tiers"             from 3 people   |
|   [View pattern ->]                                                   |
|                                                                       |
| [gray] THIN: API limitations                           2 mentions     |
| "Mentioned by 2 technical users"                      from 2 people   |
|   [View pattern ->]                                                   |
|                                                                       |
+-----------------------------------------------------------------------+
| "2 strong themes are ready for action. Consider                       |
|  1 more interview to validate pricing confusion."                     |
| [Plan your actions ->]                                                |
+-----------------------------------------------------------------------+
```

### Agent Trigger

- "what patterns are emerging", "what repeats", "show me themes"
- "what's the strongest signal", "synthesize what we know"
- After Intake Health shows decision-ready or growing confidence

### Data Sources

- `fetchThemesTool` for theme data
- `fetchTopThemesWithPeopleTool` for mention counts and people
- `fetchProjectStatusContextTool` (scopes: themes, evidence)
- `semanticSearchEvidenceTool` for top quotes per theme

### Primary CTA

"Plan your actions" (transition to Moment 7).

---

## Moment 7: Decision Forcing

### Existing vs New

`ActionCards` shows prioritized actions with reasoning but lacks tradeoff analysis, effort/impact assessment, and the ability to commit with owners and dates. `TaskList` is too lightweight for decision-forcing.

**Verdict:** NEW widget `DecisionForcing`.

### Widget Name: `DecisionForcing`

### Zod Schema

```typescript
export const decisionActionSchema = z.object({
  id: z.string(),
  /** The recommended action */
  action: z.string(),
  /** Why this action based on evidence */
  reasoning: z.string(),
  /** Effort level */
  effort: z.enum(["low", "medium", "high"]),
  /** Expected impact */
  impact: z.enum(["low", "medium", "high"]),
  /** Risks or tradeoffs */
  tradeoffs: z.array(z.string()).optional(),
  /** Evidence backing this action */
  evidenceCount: z.number().optional(),
  evidenceUrl: z.string().optional(),
  /** Commitment fields (filled when user commits) */
  owner: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  committed: z.boolean().optional(),
});

export const decisionForcingDataSchema = z.object({
  projectId: z.string(),
  /** Editorial headline: "What should you do this week?" */
  headline: z.string().optional(),
  /** The decision context from the brief */
  decisionContext: z.string().optional(),
  /** Recommended actions ranked by impact */
  actions: z.array(decisionActionSchema),
  /** Patterns that informed these recommendations */
  informingPatterns: z.array(z.object({
    name: z.string(),
    confidenceLabel: z.string(),
  })).optional(),
  /** Overall recommendation narrative */
  narrative: z.string().optional(),
  /** URL to view/manage committed actions */
  actionsUrl: z.string().optional(),
});
```

### ASCII Wireframe

```
+-----------------------------------------------------------------------+
| WHAT SHOULD YOU DO THIS WEEK?                                         |
| Based on: Onboarding friction + Weekly summaries themes               |
+-----------------------------------------------------------------------+
|                                                                       |
| #1  Build a setup wizard for new accounts                             |
|     Impact: HIGH  |  Effort: MEDIUM                                   |
|     "14 mentions of setup friction across 6 people"                   |
|     Tradeoffs: Requires eng sprint, delays API work                   |
|     [View evidence ->]                                                |
|     Owner: [________]  Due: [________]  [Commit]                     |
|                                                                       |
| #2  Ship weekly digest emails                                         |
|     Impact: HIGH  |  Effort: LOW                                      |
|     "11 mentions from decision-makers wanting summaries"              |
|     Tradeoffs: Adds email infrastructure dependency                   |
|     [View evidence ->]                                                |
|     Owner: [________]  Due: [________]  [Commit]                     |
|                                                                       |
| #3  Clarify pricing page copy                                         |
|     Impact: MEDIUM  |  Effort: LOW                                    |
|     "5 mentions but only from 3 people -- emerging signal"            |
|     [View evidence ->]                                                |
|     Owner: [________]  Due: [________]  [Commit]                     |
|                                                                       |
+-----------------------------------------------------------------------+
| "Strong signal on #1 and #2. Pricing needs more validation            |
|  before committing resources."                                        |
| [Save committed actions ->]                                           |
+-----------------------------------------------------------------------+
```

### Agent Trigger

- "what should we do", "recommend actions", "decision time"
- "what are the tradeoffs", "help me prioritize", "what to do this week"
- After Pattern Synthesis shows 2+ strong patterns

### Data Sources

- `recommendNextActionsTool` for recommendations
- `fetchProjectStatusContextTool` (scopes: themes, insights, evidence)
- `fetchTopThemesWithPeopleTool` for informing patterns

### Primary CTA

"Save committed actions" (persists owner + due date to tasks).

---

## Moment 8: CRM Activation

### Existing vs New

`PeopleList` and `PersonCard` exist but show contacts without linking them to the evidence and themes that matter. This moment needs a people-in-context view.

**Verdict:** NEW widget `StakeholderMap`.

### Widget Name: `StakeholderMap`

### Zod Schema

```typescript
export const stakeholderEntrySchema = z.object({
  personId: z.string(),
  name: z.string(),
  title: z.string().nullable(),
  orgName: z.string().nullable(),
  /** Themes this person contributed to */
  linkedThemes: z.array(z.object({
    name: z.string(),
    evidenceCount: z.number(),
  })),
  /** Key quote from this person */
  topQuote: z.string().nullable(),
  /** ICP band if scored */
  icpBand: z.string().nullable(),
  detailUrl: z.string().optional(),
});

export const stakeholderMapDataSchema = z.object({
  projectId: z.string(),
  /** Editorial headline */
  headline: z.string().optional(),
  /** Summary: "8 people contributed to your strongest patterns" */
  summary: z.string().optional(),
  /** Stakeholders grouped by relevance to patterns */
  stakeholders: z.array(stakeholderEntrySchema),
  /** How many total people are in the project */
  totalPeople: z.number(),
  /** Link to people page */
  viewAllUrl: z.string().optional(),
});
```

### ASCII Wireframe

```
+-----------------------------------------------------------------------+
| WHO DOES THIS APPLY TO?                                               |
| "8 people shaped your strongest patterns"                             |
+-----------------------------------------------------------------------+
|                                                                       |
| Sarah Chen  |  VP Eng @ Acme  |  ICP: HIGH                           |
|   Onboarding friction (4 quotes), Weekly summaries (2 quotes)         |
|   > "I spent 3 hours just trying to set up..."                       |
|   [View profile ->]                                                   |
|                                                                       |
| Mike Rodriguez  |  Product Lead @ Beta  |  ICP: HIGH                  |
|   Onboarding friction (3 quotes), Pricing confusion (1 quote)         |
|   > "Nobody told us there was a setup wizard..."                     |
|   [View profile ->]                                                   |
|                                                                       |
| Jamie Walsh  |  Head of Research @ Gamma  |  ICP: MEDIUM              |
|   Weekly summaries (5 quotes)                                         |
|   > "A weekly summary would change everything"                       |
|   [View profile ->]                                                   |
|                                                                       |
| +5 more people                                                        |
|                                                                       |
| [View all people ->]                                                  |
+-----------------------------------------------------------------------+
```

### Agent Trigger

- "who are the stakeholders", "who does this affect", "show me the people"
- "who contributed to these themes", "CRM view", "link people to insights"
- After Decision Forcing or Pattern Synthesis

### Data Sources

- `fetchTopThemesWithPeopleTool` for theme-to-people linkage
- `fetchProjectStatusContextTool` (scopes: people, personas)
- `fetchThemeStakeholdersTool` for per-theme stakeholder data
- `fetchPeopleDetailsTool` for person details

### Primary CTA

"View all people" -- navigate to CRM/People page.

---

## Moment 9: Close the Loop

### Existing vs New

`StatCard` can show individual metrics but lacks the weekly delta, action tracking, and confidence change needed for close-the-loop reporting.

**Verdict:** NEW widget `ResearchPulse`.

### Widget Name: `ResearchPulse`

### Zod Schema

```typescript
export const weeklyDeltaSchema = z.object({
  label: z.string(),
  current: z.union([z.string(), z.number()]),
  previous: z.union([z.string(), z.number()]).optional(),
  change: z.string().optional(),
  /** "up", "down", "flat" */
  direction: z.enum(["up", "down", "flat"]).optional(),
});

export const actionTrackingSchema = z.object({
  id: z.string(),
  action: z.string(),
  owner: z.string().nullable(),
  status: z.enum(["not_started", "in_progress", "complete", "blocked"]),
  dueDate: z.string().nullable(),
});

export const researchPulseDataSchema = z.object({
  projectId: z.string(),
  /** Report period label: "Week of Feb 10" */
  periodLabel: z.string(),
  /** Overall confidence shift */
  confidenceTier: z.enum(["early_signal", "growing_confidence", "decision_ready"]),
  confidenceLabel: z.string(),
  confidenceChange: z.enum(["improved", "stable", "declined"]).optional(),
  /** Key deltas for the period */
  deltas: z.array(weeklyDeltaSchema),
  /** Action progress from Decision Forcing */
  actions: z.array(actionTrackingSchema).optional(),
  /** New signal since last check */
  newSignalSummary: z.string().optional(),
  /** Editorial "what to do next" */
  nextStep: z.string(),
  nextStepUrl: z.string().optional(),
});
```

### ASCII Wireframe

```
+-----------------------------------------------------------------------+
| RESEARCH PULSE  |  Week of Feb 10                                     |
|                    Confidence: Growing -> Decision-Ready [improved]    |
+-----------------------------------------------------------------------+
|                                                                       |
| This week:                                                            |
|   New interviews:    +2  (total: 8)                                   |
|   New evidence:      +14 (total: 61)                                  |
|   Survey responses:  +3  (total: 8)                                   |
|   Themes validated:  +1  (total: 4)                                   |
|                                                                       |
+-----------------------------------------------------------------------+
| Action progress:                                                      |
|   [checkmark] Build setup wizard        @Sarah    Complete            |
|   [in-progress] Ship weekly digests     @Mike     In Progress         |
|   [not-started] Clarify pricing copy    @Jamie    Not Started         |
|                                                                       |
+-----------------------------------------------------------------------+
| New signal:                                                           |
| "2 new interviews reinforced the onboarding friction theme.           |
|  Pricing confusion is now emerging with 3 more mentions."             |
|                                                                       |
| What's next: "Run one more round of surveys to validate              |
|  pricing confusion before committing design resources."               |
| [Start survey ->]                                                     |
+-----------------------------------------------------------------------+
```

### Agent Trigger

- "how are we doing", "weekly update", "close the loop", "research pulse"
- "what changed this week", "progress report", "did this improve"
- Proactively at the start of a new week if the project has active research

### Data Sources

- `fetchProjectStatusContextTool` (scopes: status, interviews, themes, evidence)
- `recommendNextActionsTool` for next steps
- Task/action data for action tracking (via `manageTasks` tool)

### Primary CTA

Dynamic based on state: "Collect more signal", "Review new patterns", or "Mark decision complete".

---

## Implementation Priority Order

The widgets should be built in this order, balancing user impact with dependency chain:

### Phase 1: Foundation (Weeks 1-2)

| Priority | Widget | Rationale |
|----------|--------|-----------|
| P0 | `ProgressRail` | Meta-widget used by all other moments; provides orientation |
| P0 | `IntakeHealth` | The key confidence gate -- drives the entire decision to collect more or proceed |
| P1 | `DecisionBrief` | Entry point for the flow; needed before anything else makes sense |

**Why these first:** ProgressRail orients every session. IntakeHealth is the most novel and highest-value widget -- no existing component comes close. DecisionBrief sets the stage for everything downstream.

### Phase 2: Signal Collection (Weeks 3-4)

| Priority | Widget | Rationale |
|----------|--------|-----------|
| P1 | `IntakePathPicker` | Routes users to the right collection method |
| P1 | `IntakeBatchStatus` | Gives visibility into processing across multiple uploads |
| P2 | `SurveyOutreach` | Enhances existing survey flow with distribution tracking |

**Why these second:** These widgets complete the "collect signal" phase. IntakePathPicker replaces manual navigation. IntakeBatchStatus gives the batch awareness that UploadRecording lacks.

### Phase 3: Analysis & Action (Weeks 5-6)

| Priority | Widget | Rationale |
|----------|--------|-----------|
| P1 | `EvidenceWall` | Groups evidence by pain/goal -- the "show me real voice" moment |
| P1 | `PatternSynthesis` | Replaces ThemeList with confidence-tiered, editorial synthesis |
| P1 | `DecisionForcing` | The "commit" moment -- where research becomes action |

**Why these third:** These are the highest-complexity widgets and depend on having data from Phase 2. EvidenceWall and PatternSynthesis are what make UpSight different from a dashboard.

### Phase 4: Close the Loop (Week 7)

| Priority | Widget | Rationale |
|----------|--------|-----------|
| P2 | `StakeholderMap` | Links people to insights -- CRM activation |
| P2 | `ResearchPulse` | Weekly delta tracking -- the "did it work" moment |

**Why these last:** These are important but depend on actions being committed (Phase 3) and time passing (for deltas). They also have the most overlap with existing widgets (PeopleList, StatCard).

---

## Code Reuse Strategy

### Components to reuse from existing codebase

| Existing Component | Reuse In | How |
|---|---|---|
| `UploadRecording` | Moment 3A | Render alongside new `IntakeBatchStatus` |
| `SurveyCreated` | Moment 3C | Render after survey creation, before `SurveyOutreach` |
| `EvidenceCard` | `EvidenceWall` | Reuse the accent-bar + verbatim layout inside clusters |
| `ThemeList` | `PatternSynthesis` | Extract the theme row layout; add confidence tiers |
| `ActionCards` | `DecisionForcing` | Extend with effort/impact + commit fields |
| `PersonCard` | `StakeholderMap` | Reuse avatar + title layout inside stakeholder rows |
| `StatCard` | `ResearchPulse` | Reuse for individual delta metrics |

### New shared abstractions to create

1. **`ConfidenceBadge`** -- Reusable component for "Early Signal" / "Growing Confidence" / "Decision-Ready" labels. Used in: `ProgressRail`, `IntakeHealth`, `PatternSynthesis`, `ResearchPulse`.

2. **`ConversationalStatusLine`** -- A styled text block for editorial summaries ("You need 2 more VP interviews"). Used in: every new widget.

3. **`GateIndicator`** -- Shows whether a gate is passed/blocked with visual treatment. Used in: `DecisionBrief`, `IntakeHealth`.

4. **`EvidenceQuoteRow`** -- Compact verbatim + attribution row extracted from `EvidenceCard`. Used in: `EvidenceWall`, `PatternSynthesis`, `StakeholderMap`.

### Refactoring for DRY compliance

- Extract `priorityDotColor` and `priorityBadgeClass` from `registered-components.tsx` into a shared `app/lib/gen-ui/style-utils.ts` file
- Extract the avatar/initials pattern (used in `PersonCard`, `PeopleList`, `PersonaCard`) into a shared `AvatarInitials` component
- Consolidate the `detailUrl` + `ArrowRight` link pattern into a shared `DetailLink` micro-component

---

## Schema Registration Pattern

Each new widget follows the established pattern. Here is the registration template:

```typescript
// In app/lib/gen-ui/component-registry.ts -- add the schema
export const intakeHealthDataSchema = z.object({ /* ... */ });

// In app/features/generative-ui/components/IntakeHealth.tsx -- the component
export interface IntakeHealthData { /* matches schema */ }
export function IntakeHealth({ data }: { data: IntakeHealthData; isStreaming?: boolean }) {
  // ...
}

// In app/lib/gen-ui/registered-components.tsx -- the registration
import { IntakeHealth, type IntakeHealthData } from "~/features/generative-ui/components/IntakeHealth";
import { intakeHealthDataSchema } from "./component-registry";

defineComponent<IntakeHealthData>({
  type: "IntakeHealth",
  description: "Shows research intake health with confidence tier, coverage gaps, and signal gate.",
  schema: intakeHealthDataSchema,
  component: IntakeHealth as React.ComponentType<{ data: IntakeHealthData; isStreaming?: boolean }>,
  actions: ["collectMore", "proceedToAnalysis"],
  useWhen: "User wants to know if they have enough data, asks about signal strength, or needs a confidence check.",
  triggerExamples: ["do I have enough data", "intake health", "signal check", "am I ready"],
});
```

---

## Risk Assessment

### High Risk

- **Agent hallucination of schema data**: The agent must populate these schemas from real tool outputs. If tools return incomplete data, the agent may fill in plausible-but-false values. **Mitigation:** Add `z.nullable()` liberally and teach the agent to show "Not enough data yet" states rather than inventing values.

- **Widget proliferation bloats the tool description**: Adding 9+ new component types to `displayComponentTool`'s description may exceed context limits or confuse the model. **Mitigation:** Group JTBD widgets under a `jtbd:` prefix and consider a separate `displayJTBDComponentTool` if the description gets too long.

### Medium Risk

- **Confidence tier calculation logic**: The mapping from raw counts to "Early Signal" / "Growing Confidence" / "Decision-Ready" needs to be deterministic and consistent across widgets. **Mitigation:** Create a shared server-side utility `calculateConfidenceTier(projectStatus)` used by all JTBD tools.

- **ProgressRail state drift**: If the rail shows different state than individual widgets, users lose trust. **Mitigation:** Both ProgressRail and individual widgets should derive state from the same `fetchProjectStatusContextTool` call.

### Low Risk

- **Design language drift**: As different developers build different widgets, the editorial voice may drift. **Mitigation:** Define a `JTBD_COPY` constants file with all conversational labels, gate messages, and status lines.

---

## Questions/Clarifications Needed

1. **Persistence of Decision Brief fields**: Should `decisionQuestion`, `deadline`, `successMetric` be stored in `project_settings` JSON or as new `project_sections` kinds? The current `project_sections` pattern would work but may need new `kind` values.

2. **Action commitment storage**: Where should committed actions (owner + due date from DecisionForcing) be stored? The existing `tasks` table or a new `committed_actions` table? The existing `TaskList` widget and `manageTasks` tool suggest reusing the tasks system.

3. **Survey outreach tracking**: Is email sending in scope, or is `SurveyOutreach` purely a display of the shareable link + manual tracking? Current surveys use a public link model without built-in email sending.

4. **Confidence tier thresholds**: What counts as "decision-ready"? A suggested starting point:
   - Early Signal: < 3 interviews, < 10 evidence points
   - Growing Confidence: 3-7 interviews, 10-30 evidence, < 3 strong themes
   - Decision-Ready: 8+ interviews OR 30+ evidence, 3+ strong themes, coverage across 2+ personas

5. **Recording (3B) widget**: Confirmed that live recording stays as an in-page feature and does not need a gen-ui widget. The agent can navigate users to the recording page. Correct?

6. **ProgressRail rendering**: Should the ProgressRail render as a sticky element above the chat, or inline like other widgets? If sticky, it needs a different rendering mechanism than `displayComponentTool`.
