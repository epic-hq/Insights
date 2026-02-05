# Onboarding Navigation Redesign Proposal

**Date:** December 31, 2024
**Status:** Proposal
**Confidence:** High

---

## Executive Summary

Remove all horizontal navigation bars from onboarding pages. Integrate the journey progress into the existing sidebar. Result: Clean, focused pages with unified wayfinding.

---

## The Problem

Current state has **three stacked horizontal bars** competing for attention:

```
┌─────────────────────────────────────────────────────────────────┐
│  ● Plan        →  Collect  →  Learn                             │  ← Bar 1: Journey
│  Context / Prompts                                              │
├─────────────────────────────────────────────────────────────────┤
│        [ Chat ]  [ Voice ]  [ Form ]                            │  ← Bar 2: Mode
├─────────────────────────────────────────────────────────────────┤
│  💬 Conversation Prompts            ⚙️ Exploratory • 30m        │  ← Bar 3: Header
└─────────────────────────────────────────────────────────────────┘
```

**Problems:**
1. Visual clutter - three distinct UI regions to parse
2. Redundant - sidebar already exists for navigation
3. Wasted vertical space - pushes content down
4. Inconsistent - no other pages have this treatment
5. Amateur appearance - feels like features bolted on

---

## Design Principles

1. **Navigation lives in the sidebar** - Don't invent new navigation paradigms
2. **Controls live with content** - Mode toggles belong inline, not in bars
3. **Progressive disclosure** - Show journey only during onboarding
4. **Consistency** - Match the rest of the app's visual language
5. **Breathing room** - Let content be the hero

---

## Proposed Solution

### Visual Design

```
┌──────────────────┬─────────────────────────────────────────────────┐
│                  │                                                 │
│  UpSight         │                                                 │
│  ──────────────  │                                                 │
│  Workspace ▼     │                                                 │
│                  │                                                 │
│  + Add content   │    Conversation Prompts    [ Chat │ Voice │ Form ]
│                  │                                                 │
│  ══════════════  │    ┌─────────────────────────────────────────┐  │
│  GETTING STARTED │    │                                         │  │
│  ──────────────  │    │                                         │  │
│  ▼ Plan          │    │         (Main content area)             │  │
│    ├─ Context    │    │                                         │  │
│    └─ Prompts ●  │    │         Clean, focused, spacious        │  │
│  ○ Collect       │    │                                         │  │
│  ○ Learn         │    │                                         │  │
│  ══════════════  │    └─────────────────────────────────────────┘  │
│                  │                                                 │
│  WORKSPACE       │                                                 │
│  ──────────────  │                                                 │
│  Home            │                                                 │
│  Contacts        │                                                 │
│  Conversations   │                                                 │
│  Lenses          │                                                 │
│  Insights        │                                                 │
│  Tasks           │                                                 │
│  Opportunities   │                                                 │
│                  │                                                 │
└──────────────────┴─────────────────────────────────────────────────┘
```

### Key Elements

#### 1. Journey Group in Sidebar

A new "Getting Started" section at the top of the sidebar:

- **Plan** (expandable)
  - Context → `/setup`
  - Prompts → `/questions`
- **Collect** → `/interviews/upload`
- **Learn** → `/insights`

Progress indicators:
- `●` = current step (filled circle, primary color)
- `✓` = completed (checkmark, green)
- `○` = upcoming (empty circle, muted)

The section auto-collapses or hides entirely once onboarding is complete.

#### 2. Inline Mode Toggle

The Chat/Voice/Form toggle moves to the page header, aligned right:

```
Conversation Prompts                    [ Chat │ Voice │ Form ]
```

This is a **view control**, not navigation. It belongs with the content it controls.

#### 3. Simplified Page Header

Just the title and the mode toggle. No journey phases, no redundant sub-navigation.

---

## Interaction Details

### Sidebar Journey Behavior

1. **Auto-expand current phase** - When on `/setup`, Plan is expanded showing Context highlighted
2. **Collapse completed phases** - Once Plan is done, it collapses showing just a checkmark
3. **Disable future phases** - Learn is grayed out until Collect has content
4. **Disappear when done** - Once user has conversations + insights, the Getting Started section fades away

### Mode Toggle Behavior

1. **Remember preference** - Persist mode choice per user
2. **Subtle appearance** - Secondary visual weight, doesn't compete with content
3. **Keyboard accessible** - Tab to toggle, arrow keys to switch modes

### Transition States

```
NEW USER                    CONTEXT DONE                PROMPTS DONE
─────────────              ─────────────               ─────────────
▼ Plan                     ▼ Plan                      ✓ Plan
  ├─ Context ●               ├─ Context ✓              ○ Collect ●
  └─ Prompts ○               └─ Prompts ●              ○ Learn
○ Collect                  ○ Collect
○ Learn                    ○ Learn
```

---

## Implementation Plan

### Phase 1: Create Sidebar Journey Component

**New file:** `app/components/navigation/JourneySidebarGroup.tsx`

```tsx
interface JourneySidebarGroupProps {
  basePath: string;
  currentPhase: "plan" | "collect" | "learn";
  planSubStep?: "context" | "prompts";
  progress: {
    contextComplete: boolean;
    promptsComplete: boolean;
    hasConversations: boolean;
    hasInsights: boolean;
  };
}
```

Uses existing shadcn sidebar primitives:
- `SidebarGroup`, `SidebarGroupLabel`
- `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`
- `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`
- `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`

### Phase 2: Integrate into AppSidebar

Add the journey group conditionally based on onboarding state:

```tsx
// In AppSidebar.tsx
{!onboardingComplete && (
  <JourneySidebarGroup
    basePath={projectPath}
    currentPhase={currentPhase}
    planSubStep={planSubStep}
    progress={progress}
  />
)}
```

### Phase 3: Simplify Page Layouts

**Remove from setup.tsx and questions/index.tsx:**
- `<JourneyPhaseBar />` component
- Mode toggle bar container
- Extra border/background treatments

**Add:**
- Inline mode toggle in page header
- Clean, minimal page structure

### Phase 4: Delete Obsolete Code

- Delete `app/components/JourneyPhaseBar.tsx`
- Remove related imports from all pages
- Clean up OnboardingDashboard if it references JourneyPhaseBar

---

## Before / After

### Before (Current State)

```
┌─────────────────────────────────────────────────────────────┐
│ [JourneyPhaseBar - 60px]                                    │
├─────────────────────────────────────────────────────────────┤
│ [ModeToggleBar - 48px]                                      │
├─────────────────────────────────────────────────────────────┤
│ [PageHeader - 64px]                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│            Content starts 172px from top                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Total header overhead:** ~172px

### After (Proposed)

```
┌─────────────────────────────────────────────────────────────┐
│ [PageHeader with inline toggle - 56px]                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│            Content starts 56px from top                     │
│                                                             │
│            +116px more space for content                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Total header overhead:** ~56px
**Space saved:** 116px (67% reduction)

---

## Success Metrics

1. **Visual cleanliness** - Single navigation region (sidebar)
2. **Consistency** - Matches app's established patterns
3. **Space efficiency** - 116px more content visible
4. **User comprehension** - Clear journey progress at a glance
5. **Professional appearance** - Award-winning, not amateur hour

---

## Questions to Resolve

1. Should the "Getting Started" section persist for returning users who haven't completed onboarding, or only show on first visit?

2. Should we add a "Complete Setup" CTA in the sidebar when steps remain?

3. Do we want progress dots/percentages, or just checkmarks?

---

## Appendix: Component API

```tsx
// JourneySidebarGroup.tsx

export function JourneySidebarGroup({
  basePath,
  currentPhase,
  planSubStep,
  progress,
}: JourneySidebarGroupProps) {
  const { contextComplete, promptsComplete, hasConversations, hasInsights } = progress;
  const planComplete = contextComplete && promptsComplete;
  const collectComplete = hasConversations;
  const allComplete = planComplete && collectComplete && hasInsights;

  // Don't render if onboarding complete
  if (allComplete) return null;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Getting Started</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Plan - Collapsible with sub-items */}
          {/* Collect - Single item */}
          {/* Learn - Single item, disabled until ready */}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

---

## Next Steps

1. **Approve** this proposal
2. **Implement** JourneySidebarGroup component
3. **Integrate** into AppSidebar with progress state
4. **Simplify** setup.tsx and questions/index.tsx
5. **Delete** JourneyPhaseBar and related code
6. **Test** the full onboarding flow
7. **Ship** it

---

*This proposal prioritizes clarity, consistency, and craft. No half measures.*
