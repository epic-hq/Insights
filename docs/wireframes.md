# Low-Fidelity Wireframes (ASCII)

_Last updated: 2025-07-06 23:08-06:00_

> These are quick sketches to visualise layout. Real designs will move to Figma.

---

## 1. Dashboard (`/`)
```
+-------------------------------------------------------------+
| Logo | Study Switch ▼ | 🔍 Search           | User Avatar |
+-------------------------------------------------------------+
| Filters: [Persona ▼] [Theme ▼] [Opportunity ▼] [Reset]      |
+-------------------------------------------------------------+
| Impact × Novelty Heat-Map (ThemeMatrix)                     |
|  [ Click cell → side panel lists insights ]                 |
+-------------------------------------------------------------+
| Recent Interviews (table)          | Opportunities (table) |
+-------------------------------------------------------------+
```

## 2. Upload Recording (`/studies/:id/upload`)
```
+--------------------------------------------------+
| ← Back to Dashboard                             |
+--------------------------------------------------+
| Drag & Drop area [Browse Files]                 |
| +----------------------------+  +-------------+ |
| | interview1.mp3  (80%)      |  | Cancel |     |
| +----------------------------+  +-------------+ |
+--------------------------------------------------+
| Processing Queue (list with status chips)        |
+--------------------------------------------------+
```

## 3. Interview Detail (`/studies/:id/interviews/:iid`)
```
+---------------------------------------------+
| ← Back | Interview #123  | Tags: #student   |
+---------------------------------------------+
| InsightCard × N                             |
| +-----------------------------------------+ |
| | #onboarding  Impact 4  Novelty 3        | |
| | JTBD: "When I …"                        | |
| | Quotes: "…"                             | |
| +-----------------------------------------+ |
|                …                            |
+---------------------------------------------+
```

## 4. Persona View (`/studies/:id/personas/:pid`)
```
+-----------------------------------------------+
| ← Dashboard | Persona: Returning Adult STEM   |
+-----------------------------------------------+
| Snapshot (avatar, summary)                    |
+-----------------------------------------------+
| Top Insights (table)                          |
+-----------------------------------------------+
| Related Interviews (list)                     |
+-----------------------------------------------+
```

## 5. Theme Matrix (`/studies/:id/themes`)
```
+------------------------------------------------+
| Heat-Map grid (Impact y-axis, Novelty x-axis)  |
| Hover cell: tooltip counts                     |
+------------------------------------------------+
| Sidebar: Insight list for selected cell        |
+------------------------------------------------+
```

---

## Wireframe Notes
* Use responsive grid; pivot to vertical stacking on ≤768 px width.
* Side panels slide in via Remix route transitions.
* All actions use shadcn `<Dialog>` and `<Sheet>` components.
