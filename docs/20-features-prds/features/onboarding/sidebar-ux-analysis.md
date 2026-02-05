# Sidebar UX Analysis & Improvement Plan

> **Status:** Analysis complete, implementation planned
> **Date:** 2025-01-04
> **Related:** [onboarding-spec.md](./onboarding-spec.md), [navigation-redesign-proposal.md](./navigation-redesign-proposal.md)

## Overview

This document captures a UX teardown of the app sidebar across two user states:
1. **Onboarding** - New users setting up their first project
2. **Post-onboarding** - Users actively using the product

---

## Current Implementation

### Components Involved

| Component | Location | Purpose |
|-----------|----------|---------|
| `AppSidebar` | `app/components/navigation/AppSidebar.tsx` | Main sidebar container |
| `JourneySidebarGroup` | `app/components/navigation/JourneySidebarGroup.tsx` | Onboarding journey nav |
| `app-sidebar.config.ts` | `app/components/navigation/app-sidebar.config.ts` | Navigation items config |
| `useJourneyProgress` | `app/hooks/useJourneyProgress.ts` | Tracks onboarding completion |

### Journey Progress States

The sidebar tracks four completion states via `useJourneyProgress`:
- `contextComplete` - research_goal exists in project_sections
- `promptsComplete` - interview_prompts exist
- `hasConversations` - interviews exist
- `hasInsights` - theme_evidence exists

---

## Onboarding State Analysis

### Current Visual Hierarchy

```
┌─────────────────────────┐
│ [Logo]                  │
│ [Team Switcher]         │
├─────────────────────────┤
│ [+ Add content]         │ ← Primary CTA
├─────────────────────────┤
│ Getting Started         │ ← Onboarding group
│  ▼ Plan                 │
│     ○ Context           │
│     ○ Prompts           │
│  ○ Collect              │ (disabled)
│  ○ Learn                │ (disabled)
├─────────────────────────┤
│ Home                    │ ← Main nav (always visible)
│ Contacts            (0) │
│ Conversations       (0) │
│ Lenses                  │
│ Insights                │ (locked)
│ Tasks                   │
├─────────────────────────┤
│ Project Settings        │ ← Footer utilities
│ Docs                    │
│ [Invite Team]           │
│ [User Profile]          │
└─────────────────────────┘
```

### Issues Identified

| Issue | Severity | Description |
|-------|----------|-------------|
| **Cognitive overload** | High | New users see 12+ navigation items before completing setup. Main nav items are visible but mostly empty/locked. |
| **Competing CTAs** | High | "Add content" button competes with "Getting Started" journey. Both say "start here" but go different places. |
| **Unclear hierarchy** | Medium | "Getting Started" sits between the CTA and main nav. Users may not understand it's the priority. |
| **Disabled items visible** | Medium | Collect/Learn are grayed out but clickable (links still work via `<Link>` wrapper). |
| **Duplicate destinations** | Medium | "Context" in onboarding → same as "Project Settings" in footer. "Collect" → same as "Add content" button. |
| **No progress persistence** | Low | Checkmarks show completion but there's no "X of Y complete" summary. |

### Positive Patterns

- Collapsible Plan phase with sub-steps (Context → Prompts)
- Green checkmarks for completed steps
- Journey group auto-hides when complete
- Clear phase labels (Plan, Collect, Learn)

---

## Post-Onboarding State Analysis

### Current Visual Hierarchy

```
┌─────────────────────────┐
│ [Logo]                  │
│ [Team Switcher]         │
├─────────────────────────┤
│ [+ Add content]         │
├─────────────────────────┤
│ Home                    │
│ Contacts           (12) │
│ Conversations       (8) │
│ Lenses                  │
│ Insights           (24) │
│ Tasks               (3) │
│ Opportunities       (5) │ ← conditional
├─────────────────────────┤
│ Project Settings        │
│ Docs                    │
│ [Invite Team]           │
│ [User Profile]          │
└─────────────────────────┘
```

### Issues Identified

| Issue | Severity | Description |
|-------|----------|-------------|
| **Flat hierarchy** | Medium | 7 main items + 2 utilities all at same visual weight. No grouping by workflow stage. |
| **Lenses placement** | Medium | Lenses is a "how to analyze" choice but sits between content (input) and insights (output). |
| **Tasks orphaned** | Low | Tasks appears after Insights but is a cross-cutting feature. |
| **No workflow guidance** | Low | Post-onboarding users get no hints about optimal next actions. |
| **Opportunities conditional** | Low | Shows only when orgs exist OR sales mode. Sudden appearance may confuse. |

### Positive Patterns

- Count badges show data at a glance
- Active state highlighting
- Tooltips with descriptions
- Collapsible to icon-only mode
- User profile always accessible

---

## Cross-State Consistency Issues

| Issue | Description |
|-------|-------------|
| **Project Settings in footer** | Primary onboarding destination lives in footer - users may not look there for setup. |
| **"Add content" always prominent** | Irrelevant during Plan phase - should be contextual. |
| **Journey group disappears** | No breadcrumb trail once "Getting Started" hides. |
| **No return path** | Users must know to click Project Settings to re-edit context. |

---

## Recommendations

### Phase 1: Quick Wins (Low effort, high impact)

1. **Suppress main nav during onboarding**
   - Show only Journey group until Plan complete
   - Reduces cognitive load from 12+ items to 3-4
   - Implementation: Conditional render in `AppSidebar.tsx`

2. **Context-aware CTA**
   - During onboarding: "Continue setup" → current journey step
   - After onboarding: "Add content" → upload page
   - Implementation: Add logic to CTA based on `journeyComplete`

3. **Fix disabled links**
   - Collect/Learn should not render as `<Link>` when disabled
   - Implementation: Conditional render in `JourneySidebarGroup.tsx`

### Phase 2: Medium Effort

4. **Add progress indicator**
   - "Step 2 of 4" or mini progress bar in Journey group header
   - Shows users where they are in the process
   - Implementation: New component in `JourneySidebarGroup`

5. **Group main nav by workflow**
   - Input: Contacts, Conversations
   - Analysis: Lenses, Insights
   - Action: Tasks, Opportunities
   - Implementation: Update `app-sidebar.config.ts` with sections

6. **Persist "Getting Started" as collapsed link**
   - Post-onboarding: Small link to revisit setup
   - Users can always get back to project context
   - Implementation: Always-visible collapsed state

### Phase 3: Structural Changes

7. **Separate onboarding route**
   - `/projects/:id/setup/*` with dedicated minimal sidebar
   - Full focus on setup, no distractions
   - Larger architectural change

8. **Wizard pattern option**
   - Full-screen onboarding flow
   - Sidebar hidden until complete
   - Alternative to sidebar-based onboarding

9. **Contextual sidebar**
   - Different nav items based on current page section
   - E.g., Insights page shows insights-specific sub-nav
   - Most complex, highest impact

---

## Implementation Priority

| Priority | Items | Effort | Impact |
|----------|-------|--------|--------|
| **P0** | Fix disabled links (#3) | Low | Medium |
| **P1** | Suppress main nav (#1), Context-aware CTA (#2) | Medium | High |
| **P2** | Progress indicator (#4), Nav grouping (#5) | Medium | Medium |
| **P3** | Persist setup link (#6) | Low | Low |
| **Future** | Structural changes (#7-9) | High | High |

---

## Success Metrics

- **Onboarding completion rate** - % of users who complete all 4 steps
- **Time to first insight** - Duration from signup to first insight generated
- **Navigation confusion signals** - Back button usage, page abandonment
- **Support tickets** - "How do I..." questions about navigation

---

## Related Documents

- [Onboarding Spec v2](./onboarding-spec.md) - Canonical onboarding flow
- [Navigation Redesign Proposal](./navigation-redesign-proposal.md) - Previous navigation work
- [Adaptive Companion Spec](./adaptive-companion-spec.md) - AI companion for setup
- [UI Proposals](./ui-proposals.md) - Layout explorations
