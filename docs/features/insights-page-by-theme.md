# Insights Page — "By Theme" Lens

The **By Theme** lens presents a story-driven view of customer themes. Instead of a flat data table, it uses progressive disclosure across four layers so users absorb the narrative before diving into details.

---

## Page Layers

| Layer | Section | Purpose |
|-------|---------|---------|
| 1 | **Signal Summary** | Top 3 themes with direct links to detail pages — the headline story |
| 2 | **All Themes** | Full grid of theme cards, collapsed by default — expand to browse |
| 3 | **Blind Spots & Weak Signals** | Themes with low breadth but meaningful evidence — potential gaps |
| 4 | **Suggested Next Steps** | AI-derived actions ranked by confidence — what to do next |

---

## Signal Level

Every theme gets a **signal level** based on relative strength within the current dataset.

**How it's calculated:**

1. `signal_strength = evidence_count × person_count` — how much evidence and how many unique people mentioned it
2. All themes are sorted by `signal_strength` descending
3. Assigned by tertile:

| Rank | Level | Badge | Color | Meaning |
|------|-------|-------|-------|---------|
| Top 33% | **High** | `High Signal ↑` | Red | Strongest pattern — many people, lots of evidence. Act on this. |
| Middle 33% | **Medium** | `Investigate →` | Yellow | Moderate signal — worth digging into to understand if it's growing or fading. |
| Bottom 33% | **Low** | `Monitor →` | Green | Weakest signal — keep an eye on it but don't prioritize yet. |

Signal level is **relative** — a theme's level depends on how it compares to others in the project, not absolute thresholds.

---

## Trend (Stable / Growing / Fading)

Trend shows whether a theme is accelerating, steady, or cooling down over time.

**How it's calculated:**

- Compare evidence created in the **last 14 days** ("recent") vs the **prior 14 days** ("prior")
- If no prior window exists (e.g., all data was bulk-uploaded), default to **Stable**

| Condition | Trend | Badge | Meaning |
|-----------|-------|-------|---------|
| `recent > prior × 1.2` | **Growing** | `↑ Growing` | This topic is accelerating — more evidence appearing recently |
| `recent < prior × 0.8` | **Fading** | `↓ Fading` | This topic is cooling down — less recent evidence |
| Everything else | **Stable** | `→ Stable` | Steady state — no significant change in velocity |

---

## Confidence (High / Medium / Low)

Confidence appears on **Suggested Next Steps** (Layer 4) and indicates how certain we are that the recommended action is the right call.

| Level | Badge | Meaning |
|-------|-------|---------|
| **High confidence** | Red dot | Strong signal + clear pattern — high likelihood this is a real issue worth acting on |
| **Medium** | Yellow dot | Moderate signal or growing trend — worth investigating but not yet conclusive |
| **Low** | Green dot | Weak or narrow signal — needs more data before committing resources |

Confidence is derived from the theme's signal level and trend:
- **High**: The theme has `signal_level = "high"` (top third of all themes)
- **Medium**: The theme is growing in trend regardless of current signal level
- **Low**: The theme is a weak signal (bottom third) that needs validation

---

## Blind Spots & Weak Signals

This section surfaces themes that might be hiding important patterns.

**Criteria:** `signal_level === "low"` AND `evidence_count >= 3`

These are themes in the bottom third of signal strength but with enough evidence (3+) that they aren't noise. They may represent:
- A problem experienced deeply by a small group
- An emerging issue that hasn't spread yet
- A topic that needs broader validation (e.g., via survey)

### Investigate Button

Opens the theme detail page so you can review the underlying evidence, see who mentioned it, and decide whether it's a real pattern or noise. *(Currently disabled — will link to detail page in Phase B.)*

### Dismiss Button

Removes the weak signal from the current view. This is a **session-only** dismissal — refreshing the page brings it back. Useful for cleaning up the view during a review session without permanently hiding data.

---

## Suggested Next Steps

AI-generated action recommendations based on the current theme landscape.

| Action Type | When It Appears | CTA |
|-------------|-----------------|-----|
| **Fix** | Top theme has `signal_level = "high"` | "Create Task" — route to task creation |
| **Investigate** | A theme has `trend = "growing"` (not the top theme) | "Run Follow-Up Survey" — dig deeper |
| **Validate** | A weak signal exists in Blind Spots | "Send Survey" — broaden the data |
| **Share Discovery Brief** | Always shown (placeholder) | "Generate Link" — compile shareable summary |

---

## Interaction Model

- **Signal Summary rows** → Click navigates directly to the insight detail page
- **Theme cards** → Click navigates to the insight detail page
- **All Themes section** → Collapsed by default; click header to expand
- **Dismiss (Blind Spots)** → Hides from current session only
- **Investigate (Blind Spots)** → Opens detail page *(Phase B)*
- **CTA buttons (Next Steps)** → Disabled placeholders for Phase B actions
