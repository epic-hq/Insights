# Navigation Redesign: Split-Pane Layout Wireframe

## Overview

This document specifies a new layout architecture with horizontal top navigation, a persistent AI assistant panel, and a contextual content area.

**Key Design Goals:**
- Reduce cognitive load with clear navigation hierarchy
- Enable AI-first interaction while maintaining direct access to features
- Support mobile-responsive design with hamburger collapse
- Create a "wow" factor through contextual intelligence

---

## Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Logo]    Plan    Sources    Insights    CRM        [Search]  [User]      │
├─────────────────────┬───────────────────────────────────────────────────────┤
│                     │                                                       │
│   AI ASSISTANT      │              MAIN CONTENT AREA                        │
│   PANEL             │                                                       │
│   (Collapsible)     │              (Changes based on nav selection          │
│                     │               and AI suggestions)                     │
│   ┌───────────────┐ │                                                       │
│   │ Project       │ │                                                       │
│   │ Selector      │ │                                                       │
│   └───────────────┘ │                                                       │
│                     │                                                       │
│   ┌───────────────┐ │                                                       │
│   │ Top Task      │ │                                                       │
│   │ This Week     │ │                                                       │
│   │               │ │                                                       │
│   │ [Actionable]  │ │                                                       │
│   └───────────────┘ │                                                       │
│                     │                                                       │
│   ┌───────────────┐ │                                                       │
│   │ Context Card  │ │                                                       │
│   │ (Dynamic)     │ │                                                       │
│   └───────────────┘ │                                                       │
│                     │                                                       │
│                     │                                                       │
│                     │                                                       │
│   ┌───────────────┐ │                                                       │
│   │ [Search icon] │ │                                                       │
│   │ Ask or search │ │                                                       │
│   │ anything...   │ │                                                       │
│   └───────────────┘ │                                                       │
│                     │                                                       │
└─────────────────────┴───────────────────────────────────────────────────────┘
        ~320px                         Remaining width (fluid)
```

---

## Navigation Structure

### Top Navigation Bar

| Item | Sub-menu Items | Purpose |
|------|----------------|---------|
| **Plan** | Context, Research Goals, Interview Prompts, Tasks | Set up and prioritize research activities |
| **Sources** | Conversations, Surveys, Notes, Documents | Raw materials and collected data |
| **Insights** | Top Themes, Evidence, Custom Lenses | Synthesized findings and analysis |
| **CRM** | People, Organizations, Opportunities | Relationship and pipeline management |

### Navigation Bar Specifications

```
Height: 56px (desktop), 48px (mobile)
Background: white with subtle bottom border (gray-200)
Logo: Left-aligned, links to dashboard/home
Nav items: Center-aligned with even spacing
User controls: Right-aligned (search, notifications, avatar)
```

### Hover/Expanded State (Desktop)

On hover, show mega-menu dropdown:

```
┌──────────────────────────────────────────────────────────────┐
│  Plan                                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Context              Research Goals      Tasks              │
│  Company background   What you want to    5 tasks due       │
│  and market info      learn               this week →       │
│                                                              │
│  Interview Prompts                                           │
│  3 guides ready                                              │
│  [+ Create new guide]                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Mobile Navigation

```
Width < 768px:
- Collapse to hamburger menu (top-left)
- AI panel hidden by default, accessible via floating button
- Full-screen slide-out menu on hamburger tap
```

---

## AI Assistant Panel

### Panel States

| State | Width | Trigger |
|-------|-------|---------|
| **Expanded** (default for new users) | 320px | Click expand icon |
| **Collapsed** | 48px (icon strip) | Click collapse icon |
| **Hidden** (mobile) | 0px | Screen < 768px |

### Collapsed State

```
┌────┐
│ AI │  ← Avatar/icon, click to expand
├────┤
│ 3  │  ← Task count badge
├────┤
│ 💬 │  ← Quick chat access
└────┘
```

### Expanded Panel Components

#### 1. Project Selector
```
┌─────────────────────────────────────┐
│ [Avatar] UpSight Project      [▼]  │
└─────────────────────────────────────┘
```
- Dropdown to switch between projects
- Shows project avatar/icon

#### 2. Top Task Card
```
┌─────────────────────────────────────┐
│ ☑ Top Task This Week               │
│                                     │
│ "Review 3 new survey responses      │
│  from enterprise prospects"         │
│                                     │
│ [Yes, let's do it] [Later] [Skip]  │
└─────────────────────────────────────┘
```
- AI-surfaced priority task
- Actionable buttons that trigger content area changes
- "Yes" navigates to relevant view and provides guidance

#### 3. Context Card (Dynamic)
```
┌─────────────────────────────────────┐
│ 📊 What's happening                 │
│                                     │
│ • 2 themes emerging from last week  │
│ • 1 opportunity needs follow-up     │
│ • Interview with Acme in 2 days     │
│                                     │
│ [Show me the themes]                │
└─────────────────────────────────────┘
```
- Changes based on current view context
- Shows relevant suggestions and next steps

#### 4. Chat Input
```
┌─────────────────────────────────────┐
│ [🔍] Ask or search anything...      │
│                                     │
│ Try: "What did customers say about  │
│       pricing?"                     │
└─────────────────────────────────────┘
```
- Combined search + chat input
- Search icon makes dual purpose clear
- Placeholder text shows example queries
- Suggestion chips below for common actions

---

## "WOW" Factor Features

### AI Agent Responsibilities

The AI agent should own and implement these contextual intelligence features:

#### 1. Contextual Transitions
When user navigates to a new section, AI panel animates to show relevant context:

```
User clicks "Insights" →
AI panel updates to show:
┌─────────────────────────────────────┐
│ 💡 Insights Context                 │
│                                     │
│ "I noticed 3 new themes emerging    │
│  from your recent interviews.       │
│  Want me to summarize them?"        │
│                                     │
│ [Summarize] [Show evidence first]   │
└─────────────────────────────────────┘
```

#### 2. Proactive Suggestions
Based on user activity patterns:
- "You haven't reviewed survey responses in 5 days"
- "3 interviews are ready for theme extraction"
- "Acme Corp mentioned pricing 4 times - want to see the quotes?"

#### 3. Evidence Linking
When displaying an insight or recommendation:
```
┌─────────────────────────────────────┐
│ 💬 "Customers want faster onboarding"│
│                                     │
│ Based on 7 quotes from 4 people     │
│ [View evidence]                     │
│                                     │
│ Confidence: High (consistent theme) │
└─────────────────────────────────────┘
```

#### 4. Task Momentum Indicator
```
┌─────────────────────────────────────┐
│ 🔥 3-day streak!                    │
│ ████████░░ 80% weekly goal          │
│                                     │
│ Complete 1 more task to hit target  │
└─────────────────────────────────────┘
```

#### 5. Smart Navigation Hints
In mega-menu dropdowns, show AI-generated insights:
- "Sources → Conversations: 2 unreviewed"
- "Insights → Themes: 1 new pattern detected"
- "CRM → People: 3 need follow-up"

---

## Main Content Area

### Behavior

- Fills remaining width after AI panel
- Updates based on:
  1. Navigation selection
  2. AI panel interactions
  3. Direct URL navigation
  4. Search/chat queries

### Content Area Header

```
┌─────────────────────────────────────────────────────────────────┐
│ Themes                                        [Filter] [+ Add]  │
│ 12 themes across 45 conversations                               │
├─────────────────────────────────────────────────────────────────┤
│ [Search themes...]                    [All] [Emerging] [Strong] │
└─────────────────────────────────────────────────────────────────┘
```

### Responsive Behavior

| Breakpoint | AI Panel | Content Area |
|------------|----------|--------------|
| > 1280px | 320px fixed | Remaining width |
| 1024-1280px | 280px fixed | Remaining width |
| 768-1024px | Collapsed (48px) by default | Nearly full width |
| < 768px | Hidden (floating button) | Full width |

---

## Search Integration

### Combined Search + Chat Input

The input field serves dual purpose:

```
┌─────────────────────────────────────┐
│ [🔍] Ask or search anything...      │
└─────────────────────────────────────┘
```

**Behavior:**
- Typing triggers live search results dropdown
- Natural language queries route to AI chat
- Search icon click shows search-focused UI
- Enter submits to AI for processing

### Search Results Preview

```
┌─────────────────────────────────────┐
│ Results for "pricing"               │
├─────────────────────────────────────┤
│ 📝 Evidence (4)                     │
│   "Too expensive for small teams"   │
│   "Fair price for the value"        │
│                                     │
│ 👤 People (2)                       │
│   Sarah Chen (mentioned pricing)    │
│   Mike Johnson (pricing objection)  │
│                                     │
│ 💡 Themes (1)                       │
│   Pricing Sensitivity               │
│                                     │
│ [See all results] [Ask AI about this]│
└─────────────────────────────────────┘
```

---

## Component Specifications

### Colors

| Element | Token | Notes |
|---------|-------|-------|
| Nav background | `white` | With `border-b border-gray-200` |
| Nav item (default) | `gray-700` | |
| Nav item (hover) | `gray-900` | |
| Nav item (active) | `primary-500` | With underline indicator |
| AI panel background | `gray-50` | Subtle distinction |
| AI panel border | `gray-200` | Right border only |
| Task card | `white` | With shadow-sm |
| Chat input | `white` | With border, focus ring |

### Typography

| Element | Style |
|---------|-------|
| Nav items | `text-sm font-medium` |
| Panel headers | `text-xs font-semibold uppercase tracking-wide text-gray-500` |
| Task title | `text-sm font-medium text-gray-900` |
| Task description | `text-sm text-gray-600` |
| Chat placeholder | `text-sm text-gray-400` |

### Animations

| Interaction | Animation |
|-------------|-----------|
| Panel collapse/expand | `transition-all duration-200 ease-in-out` |
| Nav dropdown | `transition-opacity duration-150` |
| Context card change | Fade out/in with `duration-300` |
| Task completion | Slide out + confetti micro-animation |

---

## Implementation Priority

### Phase 1: Foundation
1. Top navigation bar with dropdowns
2. Basic two-column layout
3. AI panel shell (collapsible)
4. Route integration

### Phase 2: AI Integration
1. Chat input with search
2. Task surfacing logic
3. Context card system
4. Proactive suggestions

### Phase 3: WOW Features
1. Contextual transitions
2. Evidence linking UI
3. Task momentum/streaks
4. Smart navigation hints

---

## Related Documents

- [Card Sorting Exercise Plan](./card-sorting-exercise-plan.md)
- [UI Style Guide](./ui-style.md)
- [Information Architecture](../../00-foundation/_information_architecture.md)
