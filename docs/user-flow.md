# Interview Insights – User Flow

_Last updated: 2025-07-07 14:05-06:00_

## Primary Journey (PM uploads new research)

```mermaid
graph TD
  A[Login / Dashboard] --> B[Create Study]
  B --> C[Upload Interview Recording]
  C --> D[Processing Queue]\nTranscribe → Generate Insights
  D --> E[Interview Detail – Insight Cards]
  E --> F[Dashboard Aggregation]
  F --> G[Persona View]
  F --> H[Theme Matrix]
  H --> I[Opportunity Backlog]
```

### Step Descriptions
|#| Screen | Goal | Key Actions |
|-|-|-|-|
|1| Login / Dashboard | Access workspace | Auth (Supabase) → see list of studies |
|2| Create Study | New research project | Name study, set context meta |
|3| Upload Recording | Add raw data | Drag-n-drop file(s), show progress |
|4| Processing Queue | Background tasks | Real-time status chips (Queued/Done) |
|5| Interview Detail | Investigate a single session | Review Insight Cards, edit tags |
|6| Dashboard | Aggregate insights | Filter by persona/theme/opportunity, sticky KPI bar, 12-column grid layout, interactive filtering |
|7| Persona View | Understand segments | Auto-generated profiles + top quotes |
|8| Theme Matrix | Impact vs Novelty heat-map | Click cell → list supporting insights |
|9| Opportunity Backlog | Bridge to delivery | Prioritised table, export to CSV |

### Alternate Flows
* **Add More Interviews** – from Dashboard, hit “Upload More”.
* **Edit Insight** – from Card actions, opens modal with JSON fields.
* **Share Link** – read-only permalink with Dashboard filters encoded.
* **Filter Insights** – click on tags/categories in Insight cards to filter by related content.
* **Drag-and-Drop Opportunities** – reorder and move opportunity cards between kanban columns.
* **Navigate to List Views** – click on KPI cards or section headers to view detailed list pages.

---

## Navigation
Problem: We have too many things, and no clear flow.
HMW: guide user better to Wow and reduce clutter

- [ ] Desktop version: Top bar or sidenav?

First interaction. How long does it take to get to Wow? After a User uploads an interview, the priority is to understand the target market, people & personas. Then dig into the top themes for the target personas, how much evidence is there, and who resonates with it. Then formulate insights we can validate or act upon

So a lean menu in both mobile and desktop could look like this, with (items) appearing on page or as subnav.

1. Research (status, recommendations, questions, experiments, transcripts, add interviews, surveys) - define goals & get the evidence
2. Personas (people, interviews, evidence, themes, personas x themes) - analyze people & what makes them tick
3. Patterns (themes, themes x personas) - what are the signals we are getting, the top themes, how much evidence is there, and who resonates with it. Then formulate insights we can validate or act upon
4. Insights & Opportunities (future) - what are the insights we can validate or act upon & next steps

Global: Workspace switcher ▸ Projects ▸ Settings/Team


---

## UX Decisions (resolved)
* Single workspace for now.
* Read-only share links are auth-gated.
