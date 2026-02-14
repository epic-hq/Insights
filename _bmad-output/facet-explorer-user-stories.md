# Facet Explorer - User Stories

**Date**: 2026-02-11
**Status**: Draft
**Authors**: UX (Sally) + PM perspective

## Product Context

UpSight turns customer conversations into verifiable evidence. Facets are the AI-discovered vocabulary — labels like "Move Faster" (Goal), "Too Expensive" (Pain), "Weekly Standup" (Workflow) — that describe what people say. They're the bridge between raw quotes and structured insights.

The Facet Explorer gives researchers visibility into this vocabulary so they can trust, curate, and leverage it.

## Target Personas

| Persona | Job-to-be-Done | Why they care about facets |
|---------|---------------|--------------------------|
| **UX Researcher** | Synthesize interview findings into patterns | Need to verify the AI's vocabulary matches their mental model before building reports |
| **Product Manager** | Prioritize based on customer evidence | Need to find what customers care about without reading every transcript |
| **Research Ops** | Maintain data quality across projects | Need to catch duplicates, merge synonyms, keep vocabulary clean |

## User Stories

### Epic 1: Explore & Understand (Current - Explorer v1)

**US-1.1: Browse vocabulary by category**
> As a researcher, I want to see all facets grouped by kind (Goal, Pain, Workflow, etc.) so I can understand the full vocabulary the AI has built from my conversations.

**Acceptance**: Groups sorted by frequency. Each facet shows evidence count + people count. Expand/collapse per kind.

**US-1.2: Search by meaning, not just text**
> As a researcher, I want to search facets semantically so that typing "speed" also surfaces "Performance", "Reduce Latency", and "Move Faster" — concepts the AI knows are related even if the words don't match.

**Acceptance**: Text filter is instant. Semantic results appear after brief delay with sparkle indicator and similarity %. Results sorted: text matches first, then semantic by relevance.

**US-1.3: Understand what facets are**
> As a new user, I want a plain-language explanation of what facets are so I can understand the page without reading documentation.

**Acceptance**: Explanation card in non-technical language. Includes actionable steps (search, expand, synonyms).

---

### Epic 2: Drill Down (Next — high value, builds on Explorer)

**US-2.1: See who talks about a facet**
> As a researcher, I want to click a facet and see which people are tagged with it so I can identify patterns across participants.

**Acceptance**: Click facet → shows list of people with that facet, sorted by evidence count. Links to person detail page.

**US-2.2: See the actual quotes**
> As a researcher, I want to see the evidence (verbatim quotes) tagged with a facet so I can verify the AI's tagging and pull quotes for presentations.

**Acceptance**: Click facet → expandable section showing verbatim quotes with interview source and timestamp anchor.

**US-2.3: Filter by entity type**
> As a researcher, I want to distinguish between evidence-facets (what was said) and person-facets (traits) so I understand where the data comes from.

**Acceptance**: Visual indicator or filter toggle for "evidence" vs "people" sources. Badge counts differentiated.

---

### Epic 3: Curate & Quality Control (Future — vocabulary management)

**US-3.1: Merge duplicate facets**
> As a research ops person, I want to merge "UX" and "User Experience" into one facet so my analysis isn't split across duplicates.

**Acceptance**: Select two facets → merge action → all evidence_facet and person_facet records point to the surviving facet. Merged label added as synonym.

**US-3.2: Deactivate junk facets**
> As a researcher, I want to deactivate facets that the AI created incorrectly (e.g., filler words tagged as goals) so they don't pollute my analysis.

**Acceptance**: Toggle `is_active` per facet. Deactivated facets hidden from future processing but historical evidence preserved. Visual distinction for inactive facets.

**US-3.3: Add synonyms manually**
> As a researcher, I want to add synonym terms to a facet so the AI recognizes variations in future conversations.

**Acceptance**: Inline edit to add/remove synonyms. Synonyms visible in explorer and used in text matching.

**US-3.4: Rename a facet**
> As a researcher, I want to rename a facet label (e.g., "Speed" → "Execution Velocity") so it matches my team's language.

**Acceptance**: Inline rename. Updates label everywhere. Old label added as synonym automatically.

---

### Epic 4: Leverage for Analysis (Future — connects to insights workflow)

**US-4.1: Create a theme from a facet cluster**
> As a researcher, I want to select related facets and create a theme from them so I can build my analysis bottom-up from the vocabulary.

**Acceptance**: Multi-select facets → "Create Theme" action → pre-populates theme with selected facets' evidence.

**US-4.2: Compare facets across segments**
> As a PM, I want to see which facets are common among enterprise users vs SMB users so I can prioritize by segment.

**Acceptance**: Facet counts broken down by persona/segment. Comparison view or heatmap.

**US-4.3: Track vocabulary growth over time**
> As a research ops person, I want to see how many new facets the AI discovers per week so I can gauge research velocity.

**Acceptance**: Simple trend chart showing new facets over time by kind.

---

## Navigation Placement

### Recommendation: Under "Insights" mega-menu

```
Insights (Lightbulb icon) - "What you've learned"
  ├── Top Themes (lightbulb)
  ├── Evidence (file-text)
  ├── Vocabulary (tag icon) ← NEW: Facet Explorer
  └── Analysis (glasses)
```

**Why "Insights" and NOT "Settings":**
- Facets are *analytical output* — the vocabulary your AI discovered from conversations
- Researchers browse facets as part of their analysis workflow, not as a config task
- "Settings" implies one-time setup; facet exploration is ongoing
- The drill-down stories (US-2.x) connect directly to evidence and people — core analysis objects

**Label recommendation**: "Vocabulary" rather than "Facets" or "Facet Explorer"
- "Vocabulary" is self-explanatory to non-technical users
- "Facets" is internal jargon
- Subtitle in mega-menu: "AI-discovered labels from your conversations"

### Future: Vocabulary Management in-context

When Epic 3 (Curate) ships, merge/deactivate/rename should be **inline in the Explorer** — not split into a separate Settings page. Researchers need to curate while they're exploring, not context-switch to a settings panel.

---

## How This Connects to Product Goals

| Product Goal | Facet Explorer Role |
|-------------|-------------------|
| **Trust** — "Evidence you can verify" | Researchers can see exactly what the AI tagged, verify accuracy, correct mistakes |
| **Vocabulary** — "Shared language" | Teams see the same facets, building shared understanding of customer language |
| **Action** — "Insights → Decisions" | Semantic search helps PMs find relevant customer signals without reading transcripts |
| **Quality** — "Clean data → Better insights" | Merge/deactivate keeps vocabulary clean, improving all downstream analysis |
| **Adoption** — "Show value fast" | New users see the explanation card, understand the system, feel oriented |

## Priority Recommendation

1. **Now**: Epic 1 (done) — browse + semantic search + explanation
2. **Next sprint**: US-2.1 + US-2.2 (drill to people + quotes) — highest user value
3. **Fast follow**: US-3.1 + US-3.2 (merge + deactivate) — quality control
4. **Later**: Epic 4 (analysis integration) — depends on theme workflow maturity
