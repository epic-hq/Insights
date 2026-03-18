# Matrix Grid Questions

## JTBD

Survey authors need to ask one high-value comparative rating question without turning the survey into repetitive one-at-a-time screens. Respondents need to answer that question quickly on desktop and mobile, and analysts need row-level results they can compare and report back to stakeholders.

## Product Call

- Author as one conceptual `matrix` question.
- Store row-level answers under that one question.
- Render as a grid on desktop.
- Render as stacked row cards on mobile.
- Treat matrix as structured quantitative data, not semantic evidence text.

## When To Use

Use `matrix` only when:

- all rows share the same response scale
- the user should compare several dimensions side by side
- the question is high-value enough to justify a grouped rating task
- the row count is small enough to avoid straight-lining

Recommended row count:

- ideal: `3-5`
- acceptable: `6`
- avoid: `7+`

## Authoring Model

Each matrix question stores:

- `type: "matrix"`
- `prompt`
- `matrixRows: [{ id, label }]`
- `likertScale`
- `likertLabels`

Example:

```json
{
  "id": "q7",
  "type": "matrix",
  "prompt": "Rate how well StartupSD delivers on each of the following.",
  "likertScale": 4,
  "likertLabels": {
    "low": "Needs work",
    "high": "Strong"
  },
  "matrixRows": [
    { "id": "networking", "label": "Networking and making valuable connections" },
    { "id": "workshops", "label": "Learning from workshops and speakers" },
    { "id": "mentors", "label": "Access to mentors and advisors" }
  ]
}
```

## Response Model

Responses are stored as an object keyed by row id:

```json
{
  "q7": {
    "networking": "4",
    "workshops": "3",
    "mentors": "2"
  }
}
```

Completion rule:

- matrix is complete only when every row has a non-empty answer

## Rendering

Desktop:

- show the full grid with rows on the left and shared scale across columns
- optimize for fast comparison

Mobile:

- show one row card at a time within the same question block
- keep shared scale buttons large and thumb-friendly

Chat mode:

- matrix questions disable chat mode for now
- fallback is standard form mode

## Analysis

Matrix analysis is row-level:

- average per row
- distribution per row
- percentage breakdown per row

Matrix should not be treated as free-text evidence for semantic retrieval. It is a structured satisfaction/importance signal, not a quote.

## Generator Rules

Survey generation should:

- prefer matrix when multiple dimensions share one common scale
- keep matrices to `3-5` rows by default
- avoid decomposing a true matrix into repetitive likert questions unless mobile-first or branching needs make that necessary
- preserve block/section architecture around the matrix question
