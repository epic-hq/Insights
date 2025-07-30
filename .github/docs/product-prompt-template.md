# Product Plan: Interview Insights

**Goal**: Create an easy-to-use, powerful, data-driven tool to help product teams distill the insights they need from their interview data to build better products that the market wants and will pay for.

**User Story 1 - insights**: As a product manager I can view key insights from individual interview transcripts so I can truly understand user needs, motivations, preferences, and how they define success.

**User Story 2 - dashboard**: As a product manager I can view a dashboard with aggregated insights from a set of interviews so I can truly understand the bigger market dynamics and make informed decisions about how we can build better products. The dashboard includes a sticky KPI bar, theme visualization, personas breakdown, recent interviews, tag cloud, and a drag-and-drop opportunity kanban board.

**User Story 3 - personas**: As a product manager I can view personas based on the insights from the interviews so I can truly understand the bigger market dynamics and make informed decisions about how we can build better products.

**User Story 4 - themes**: As a product manager I can view sort and analyze themes from the interviews so I can better understand user issues and preferences by product area (eg onboarding, analysis, reporting, etc).

**User Story 5 - product opportunities**: As a product manager I can view product opportunities based on the insights from the interviews so I can evaluate, flesh out, prioritize, and implement product opportunities.

**Flow Skeleton 1: upload interview**: upload interview recordings → generate transcripts → generate insights and other data according to a template→ store in db → user views dashboard and can see aggregated insights, and drill into insights by persona, or individual interview. Allow cross-filtering between personas, insights and product opportunities (using tags).

**Flow Skeleton 2: Analyze insights**:

**Onboarding**: Ask user what their goal is. (used to guide LLM) types of questions they want to uncover. This can guide the LLM to generate insights, recommend follow on questions, etc.
Simple questions:

- What kind of content? interviews with customers, live conversations, focus groups, etc.
- What is the task? understand their pain, motivations, preferences, etc.
- What is the goal? decide on pricing, new features, changes in service terms, etc.
Template: I want to ___ so I can ____.
While trying to do **GOAL/Desired_outcome**, people struggle with **pain** because **WHY: Details/context**.

**Dashboard Key Value**: Quickly tell users:

- top pain points or insights (impact vs frequency) & themes
- suggested next steps, questions
- product/service opportunities.
- dynamic persona descriptions

**Code Context**: TBD

**Constraints & Unknowns**: plan then prototype; plan should be solid, but not perfect. Identify unknowns and ask for clarification.

**Tooling Allowed**: React + RemixJS + TailwindCSS + ShadcnUI + Supabase + Vite

**Success Tests**: run Vitest/Storybook tests; Use cases: Media recording of interview can be uploaded, insights generated and stored to DB, and dashboard renders;  Adding another interview should generate new insights and update the dashboard to show aggregated insights.

**Output Format**: plan + pros/cons matrix + clarifying Qs. Reflect on logical gaps or risky assumptions

**Ask for clarification**: Ask a question if anything is unclear, or could prevent a solid plan.

**Supporting Research**: Based on best practices from Nielsen Norman Group and other vendors, we have a starting foundation for a template of insights and other data to generate from interview transcripts.

## Template

### Study Context

Research Goal:
Study Code / Folder:
Recruitment Channel:
Script Version:

### Interview Metadata

Interview ID:
Date:
Interviewer:
Participant (Pseudonym):
Segment / Role: (e.g., "Returning adult STEM student")
Duration (min):
Transcript Source: (file name or link)

### Participant Snapshot (≤ 7 sentences)

A concise narrative: who they are, their workflow, top frustrations, aspirations, and any standout quotes that define them.

### High‑Impact Themes

List the 5‑10 biggest takeaways as single lines, each starting with a tag and quick rating for synthesis:

# theme_tag One‑sentence insight. (Impact 1‑5 · Novelty 1‑5)

Impact ≈ severity or business value; Novelty ≈ differentiation/delight potential.

### Insight Cards (Create insight card for each #theme_tag)

| Field | Entry |
| --- | --- |
| Name | Insight Name |
| Category | 1-2 word high level category about the insight |
| Journey Stage | Awareness · Onboarding · Planning · Learning · Assessing · Progress · Community · Support · Other |
| Impact Severity | 1 (annoying) … 5 (blocker) |
| JTBD | "When I … I want to … so I can …" |
| Description | Insight description and any additional context |
| Underlying Motivation | e.g., autonomy, mastery, recognition |
| Pain / Friction |  |
| Desired Outcome |  |
| Evidence Quotes | "…" [00:12:14] · "…" [00:23:02]. Include all relevant quotes. Quotes should only be from the person being interviewed, not the interviewer. |
| Emotional Response | The force or level of conviction of the interviewee’s feeling about this need. Low - Neutral - High |
| Opportunity Ideas |  • … • … (short bullets) |
| Confidence | Confidence in the takeaway. Low - Medium - High |
| Related Tags | #tag1 #tag2 |
| Possible Contradictions | Look for contradictions and potential themes by omission, things that they don’t say, e.g. given an opportunity to discuss A,B,C, they only discussed A. Does the user discuss opposing claims? |

(Generate this information for each additional insight.)

### Open Questions & Next Steps

Bullet list of knowledge gaps, hypotheses to validate, and upcoming research actions.

### Observations & Contextual Notes

Non‑verbal cues, environment, surprising behaviours—anything that adds colour but doesn’t belong in an insight.

### Tagging Rules

- Use lower_snake_case.
- Make tags conceptual, not UI feature names (#social_accountability, not #leaderboard).
- Re‑use existing tags to aid cross‑study synthesis; maintain a master tag glossary.
- Optionally prefix with journey stage (progress_visibility).

### Impact / Novelty Scales

Rate each insight:

- Impact — severity to the user or business value (1 = minor annoyance, 5 = critical blocker).

- Novelty — how differentiated or delight‑creating (1 = common expectation, 5 = breakthrough idea).
