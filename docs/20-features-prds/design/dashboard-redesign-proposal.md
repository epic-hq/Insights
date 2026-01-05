# Dashboard Redesign Proposal

A comprehensive redesign of the Insights dashboard to create a focused, state-aware experience that guides new users while providing rich functionality for active projects.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Design Vision](#design-vision)
3. [Information Architecture](#information-architecture)
4. [Component Architecture](#component-architecture)
5. [Empty State Design](#empty-state-design)
6. [Populated State Design](#populated-state-design)
7. [Progressive Disclosure](#progressive-disclosure)
8. [Responsive Considerations](#responsive-considerations)
9. [Implementation Approach](#implementation-approach)

---

## Current State Analysis

### Existing Structure

The current dashboard (`metro-index.tsx`) uses:

- **AppLayout**: Wraps all pages with sidebar (desktop) and bottom tab bar (mobile)
- **DashboardV2**: State-aware component with empty/processing/hasData states
- **Sidebar**: Full navigation with Discovery, Results, and Directory sections
- **EmptyState**: Simple two-card onboarding (Setup Goals / Add Content)

### Current Sidebar Navigation (app-sidebar.config.ts)

```
Discovery
  - Dashboard
  - Objectives
  - Conversations
  - Tasks

Results
  - Lens Library
  - Sales BANT
  - Customer Discovery
  - ICP Discovery
  - Themes
  - Personas
  - Findings

Directory
  - People
  - Organizations
  - Opportunities
```

### Pain Points

1. **Overwhelming for new users**: Full sidebar shows all features immediately
2. **No clear path**: Users don't know where to start
3. **Disconnected sections**: Dashboard doesn't surface key data from other areas
4. **Missing context**: No project context or chat access on dashboard
5. **No task visibility**: Tasks buried in separate page

---

## Design Vision

### Core Principles

1. **Progressive Revelation**: Show features as they become relevant
2. **Action-Oriented Empty States**: Every empty section teaches what to do
3. **Information Density**: Dashboard as command center for daily use
4. **Joyful Onboarding**: First experience feels achievable, not overwhelming

### New Sidebar Structure (Simplified)

```
[Logo]

Dashboard        <- Main hub
Tasks            <- High visibility for action items
Insights         <- AI-generated findings
People/Orgs      <- CRM entities combined
Opportunities    <- Pipeline/deals

[Docs]
[User Profile]
```

### Dashboard Content Hierarchy

1. **Top 3 Tasks** - Immediate action items
2. **Top 3 Insights** - Latest AI discoveries
3. **Lens Feed** - Stream of analysis results
4. **Add Conversations** - Primary CTA
5. **Context Panel** - Project goals & settings
6. **Chat Access** - AI assistant trigger

---

## Information Architecture

### State-Based Layout Logic

```typescript
type DashboardState =
  | "empty"      // No conversations, no data
  | "processing" // Has uploads, awaiting analysis
  | "active"     // Has data, normal operation

interface DashboardLayoutConfig {
  showSidebar: boolean
  showOnboardingTasks: boolean
  sections: DashboardSection[]
}

function getDashboardConfig(state: DashboardState): DashboardLayoutConfig {
  switch (state) {
    case "empty":
      return {
        showSidebar: false,  // Hide sidebar for new users
        showOnboardingTasks: true,
        sections: ["onboarding", "empty-placeholders"]
      }
    case "processing":
      return {
        showSidebar: true,
        showOnboardingTasks: false,
        sections: ["processing-status", "tasks", "lens-feed"]
      }
    case "active":
      return {
        showSidebar: true,
        showOnboardingTasks: false,
        sections: ["tasks", "insights", "lens-feed", "context"]
      }
  }
}
```

### URL Structure

```
/a/{accountId}/{projectId}/dashboard     <- Main dashboard
/a/{accountId}/{projectId}/tasks         <- Full tasks view
/a/{accountId}/{projectId}/insights      <- All insights
/a/{accountId}/{projectId}/directory     <- People & Orgs combined
/a/{accountId}/{projectId}/opportunities <- Pipeline
```

---

## Component Architecture

### File Structure

```
app/features/dashboard-v3/
  components/
    DashboardShell.tsx        <- Layout wrapper with state logic
    OnboardingDashboard.tsx   <- Empty state dashboard
    ActiveDashboard.tsx       <- Populated dashboard

    sections/
      TasksSection.tsx        <- Top 3 tasks preview
      InsightsSection.tsx     <- Top 3 insights preview
      LensFeed.tsx            <- Scrollable lens results
      ContextPanel.tsx        <- Project context sidebar
      ChatTrigger.tsx         <- AI assistant FAB

    onboarding/
      OnboardingTaskCard.tsx  <- Checklist-style task
      EmptyPlaceholder.tsx    <- "Do X to see Y" boxes
      WelcomeHeader.tsx       <- Personalized greeting

    shared/
      SectionHeader.tsx       <- Consistent section titles
      ViewAllLink.tsx         <- "View all" navigation
      EmptyStateBox.tsx       <- Reusable empty container

  hooks/
    useDashboardState.ts      <- Compute dashboard state
    useDashboardData.ts       <- Aggregate data loader

  pages/
    index.tsx                 <- Route entry point
```

### Component Hierarchy

```
DashboardShell
  |-- (state === "empty")
  |     OnboardingDashboard
  |       WelcomeHeader
  |       OnboardingTaskList
  |         OnboardingTaskCard (x3)
  |       EmptyPlaceholdersGrid
  |         EmptyPlaceholder (Tasks)
  |         EmptyPlaceholder (Insights)
  |         EmptyPlaceholder (Lens Results)
  |
  |-- (state !== "empty")
        ActiveDashboard
          TasksSection
            TaskCard (x3)
            ViewAllLink
          InsightsSection
            InsightCard (x3)
            ViewAllLink
          LensFeed
            LensResultCard (scrollable)
          ContextPanel (desktop sidebar)
            ProjectGoals
            QuickStats
          ChatTrigger (FAB)
```

---

## Empty State Design

### Onboarding Dashboard Layout

When `conversationCount === 0`, render without sidebar:

```
+--------------------------------------------------+
|  [Logo]                              [Skip Tour] |
+--------------------------------------------------+
|                                                  |
|     Welcome to [Project Name]                    |
|     Let's get your research project set up       |
|                                                  |
+--------------------------------------------------+
|  GETTING STARTED                                 |
|  +--------------------------------------------+  |
|  | [ ] 1. Define your research goals          |  |
|  |     Set clear objectives for what you      |  |
|  |     want to learn from your conversations  |  |
|  +--------------------------------------------+  |
|  | [ ] 2. Upload your first conversation      |  |
|  |     Add a recording, transcript, or notes  |  |
|  |     to start extracting insights           |  |
|  +--------------------------------------------+  |
|  | [ ] 3. Configure your analysis lenses      |  |
|  |     Choose which frameworks to apply       |  |
|  |     (Sales BANT, Customer Discovery, etc)  |  |
|  +--------------------------------------------+  |
+--------------------------------------------------+
|                                                  |
|  WHAT YOU'LL SEE                                 |
|                                                  |
|  +-------------+  +-------------+  +----------+  |
|  | TASKS       |  | INSIGHTS    |  | LENS     |  |
|  |             |  |             |  | RESULTS  |  |
|  | Upload a    |  | Upload a    |  | Upload a |  |
|  | conversation|  | conversation|  | conver-  |  |
|  | to see AI-  |  | to see AI-  |  | sation   |  |
|  | generated   |  | discovered  |  | to see   |  |
|  | action      |  | patterns &  |  | lens     |  |
|  | items here  |  | themes here |  | analysis |  |
|  +-------------+  +-------------+  +----------+  |
|                                                  |
+--------------------------------------------------+
```

### Empty State Copy Recommendations

#### Tasks Section
```
Title: "Tasks"
Icon: CheckSquare (muted)
Message: "Upload a conversation to see AI-generated action items here"
CTA: "Add Conversation" (secondary button)
```

#### Insights Section
```
Title: "Insights"
Icon: Lightbulb (muted)
Message: "Upload a conversation to see AI-discovered patterns and themes here"
CTA: "Add Conversation" (secondary button)
```

#### Lens Results Section
```
Title: "Lens Results"
Icon: Glasses (muted)
Message: "Configure lenses, then upload conversations to see structured analysis here"
CTA: "Configure Lenses" (ghost button)
```

#### People Section (when accessed directly)
```
Title: "People & Organizations"
Icon: Users (muted)
Message: "People mentioned in your conversations will appear here automatically"
Subtext: "No manual entry needed - just upload conversations"
```

#### Opportunities Section (when accessed directly)
```
Title: "Opportunities"
Icon: Briefcase (muted)
Message: "Sales opportunities identified from your conversations will appear here"
Subtext: "Enable the Sales BANT lens to start tracking deals"
CTA: "Enable Sales Lens" (outline button)
```

### Onboarding Task Cards

```typescript
interface OnboardingTask {
  id: string
  title: string
  description: string
  icon: LucideIcon
  href: string
  isComplete: boolean
  priority: 1 | 2 | 3
}

const ONBOARDING_TASKS: OnboardingTask[] = [
  {
    id: "goals",
    title: "Define your research goals",
    description: "Set clear objectives for what you want to learn from your conversations",
    icon: Target,
    href: "{projectPath}/setup",
    isComplete: false, // Check project_sections
    priority: 1,
  },
  {
    id: "upload",
    title: "Upload your first conversation",
    description: "Add a recording, transcript, or notes to start extracting insights",
    icon: Upload,
    href: "{projectPath}/interviews/upload",
    isComplete: false, // Check interviews.count > 0
    priority: 2,
  },
  {
    id: "lenses",
    title: "Configure your analysis lenses",
    description: "Choose which frameworks to apply (Sales BANT, Customer Discovery, etc)",
    icon: Glasses,
    href: "{projectPath}/lens-library",
    isComplete: false, // Check enabled_lenses.length > 0
    priority: 3,
  },
]
```

---

## Populated State Design

### Active Dashboard Layout (Desktop)

```
+------------------+----------------------------------------+
| [Sidebar]        |  [Project Name]              [Chat]   |
|                  +----------------------------------------+
| Dashboard *      |                                        |
| Tasks (3)        |  TASKS                    [View All]   |
| Insights (12)    |  +----------+ +----------+ +--------+  |
| Directory        |  | Task 1   | | Task 2   | | Task 3 |  |
| Opportunities    |  | High Pri | | Med Pri  | | Low    |  |
|                  |  +----------+ +----------+ +--------+  |
| [Docs]           |                                        |
| [Profile]        |  INSIGHTS                 [View All]   |
|                  |  +----------+ +----------+ +--------+  |
|                  |  | Insight  | | Insight  | | Insight|  |
|                  |  | Card 1   | | Card 2   | | Card 3 |  |
|                  |  +----------+ +----------+ +--------+  |
|                  |                                        |
|                  |  LENS FEED                             |
|                  |  +------------------------------------+|
|                  |  | [Sales BANT] 5 conversations       ||
|                  |  | [Customer Discovery] 3 convos     ||
|                  |  | [Custom Lens] 2 conversations      ||
|                  |  +------------------------------------+|
|                  |                                        |
|                  |  +----------+ PROJECT CONTEXT          |
|                  |  | + Add    | Research Goal: ...       |
|                  |  | Convo    | 12 conversations         |
|                  |  +----------+ 3 lenses active          |
+------------------+----------------------------------------+
                                                    [AI FAB]
```

### Section Components

#### TasksSection

```tsx
interface TasksSectionProps {
  tasks: Task[]
  projectPath: string
  maxVisible?: number // default: 3
}

function TasksSection({ tasks, projectPath, maxVisible = 3 }: TasksSectionProps) {
  const topTasks = tasks
    .filter(t => t.status !== "done" && t.status !== "archived")
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxVisible)

  if (tasks.length === 0) {
    return (
      <EmptyStateBox
        icon={CheckSquare}
        title="Tasks"
        message="Upload a conversation to see AI-generated action items here"
        ctaText="Add Conversation"
        ctaHref={`${projectPath}/interviews/upload`}
      />
    )
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Tasks"
        count={tasks.filter(t => t.status !== "done").length}
        viewAllHref={`${projectPath}/tasks`}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {topTasks.map(task => (
          <TaskPreviewCard key={task.id} task={task} />
        ))}
      </div>
    </section>
  )
}
```

#### InsightsSection

```tsx
interface InsightsSectionProps {
  insights: Insight[]
  projectPath: string
  maxVisible?: number // default: 3
}

function InsightsSection({ insights, projectPath, maxVisible = 3 }: InsightsSectionProps) {
  const topInsights = insights
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, maxVisible)

  if (insights.length === 0) {
    return (
      <EmptyStateBox
        icon={Lightbulb}
        title="Insights"
        message="Upload a conversation to see AI-discovered patterns and themes here"
        ctaText="Add Conversation"
        ctaHref={`${projectPath}/interviews/upload`}
      />
    )
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Insights"
        count={insights.length}
        viewAllHref={`${projectPath}/insights`}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {topInsights.map(insight => (
          <InsightPreviewCard key={insight.id} insight={insight} />
        ))}
      </div>
    </section>
  )
}
```

#### LensFeed

```tsx
interface LensFeedProps {
  lenses: LensSummary[]
  projectPath: string
}

function LensFeed({ lenses, projectPath }: LensFeedProps) {
  const lensesWithData = lenses.filter(l => l.hasData)

  if (lensesWithData.length === 0) {
    return (
      <EmptyStateBox
        icon={Glasses}
        title="Lens Results"
        message="Configure lenses, then upload conversations to see structured analysis here"
        ctaText="Configure Lenses"
        ctaHref={`${projectPath}/lens-library`}
        variant="subtle"
      />
    )
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Lens Feed"
        viewAllHref={`${projectPath}/lens-library`}
      />
      <div className="space-y-2">
        {lensesWithData.map(lens => (
          <LensFeedItem key={lens.templateKey} lens={lens} />
        ))}
      </div>
    </section>
  )
}
```

---

## Progressive Disclosure

### Sidebar Visibility Rules

```typescript
interface SidebarVisibilityConfig {
  showSidebar: boolean
  visibleItems: string[]
}

function getSidebarVisibility(
  conversationCount: number,
  hasGoals: boolean,
  hasLenses: boolean
): SidebarVisibilityConfig {
  // Empty project: No sidebar
  if (conversationCount === 0 && !hasGoals) {
    return {
      showSidebar: false,
      visibleItems: [],
    }
  }

  // Has goals but no conversations: Minimal sidebar
  if (conversationCount === 0 && hasGoals) {
    return {
      showSidebar: true,
      visibleItems: ["dashboard", "tasks"], // Just basics
    }
  }

  // Has conversations: Full sidebar
  return {
    showSidebar: true,
    visibleItems: ["dashboard", "tasks", "insights", "directory", "opportunities"],
  }
}
```

### Feature Unlocking

| Trigger | Features Unlocked |
|---------|-------------------|
| Account created | Dashboard (empty state) |
| Goals defined | Tasks section shows |
| First conversation | Insights, People, Lens Results |
| Sales lens enabled | Opportunities section |
| 3+ conversations | AI Chat suggestions |
| 5+ conversations | Pattern detection, Themes |

---

## Responsive Considerations

### Mobile Layout (< 768px)

1. **No sidebar** - Use bottom tab bar
2. **Single column** - Stack all sections vertically
3. **Collapsible sections** - Accordion-style for dense info
4. **Floating chat button** - Fixed position, always accessible
5. **Swipe navigation** - Between dashboard sections

### Bottom Tab Bar (Mobile)

```
+-------+-------+-------+-------+-------+
| Home  | Tasks | Opps  | [AI]  | Add   |
+-------+-------+-------+-------+-------+
```

### Tablet Layout (768px - 1024px)

1. **Collapsed sidebar** - Icon-only, expandable
2. **Two-column grid** - For cards
3. **Side panel** - For context (slideover)

### Desktop Layout (> 1024px)

1. **Full sidebar** - With labels
2. **Three-column cards** - For tasks/insights
3. **Right sidebar** - For project context

---

## Visual Design Recommendations

### Spacing System

```css
/* Consistent spacing scale */
--space-section: 2rem;      /* Between major sections */
--space-cards: 0.75rem;     /* Between cards in grid */
--space-card-padding: 1rem; /* Inside cards */
--space-header: 1.5rem;     /* Below section headers */
```

### Typography Hierarchy

```css
/* Dashboard type scale */
.page-title     { font-size: 1.5rem; font-weight: 600; }
.section-title  { font-size: 1rem; font-weight: 600; }
.card-title     { font-size: 0.875rem; font-weight: 500; }
.card-body      { font-size: 0.875rem; color: var(--muted-foreground); }
.empty-message  { font-size: 0.875rem; color: var(--muted-foreground); }
```

### Card Styles

```tsx
// Standard card (Tasks, Insights)
<Card className="border bg-card p-4 transition-shadow hover:shadow-sm">

// Empty state placeholder
<div className="rounded-lg border-2 border-dashed border-muted bg-muted/30 p-6">

// Highlighted onboarding card
<Card className="border-2 border-primary/20 bg-primary/5 p-4">
```

### Color Usage

- **Primary**: CTAs, active states, progress indicators
- **Muted**: Empty state icons, secondary text, borders
- **Success**: Completed tasks, positive insights
- **Warning**: In-progress items, attention needed
- **Destructive**: Blocked tasks, critical issues

---

## Implementation Approach

### Phase 1: Foundation (Week 1)

1. Create `DashboardShell` component with state detection
2. Build `OnboardingDashboard` for empty state
3. Implement sidebar visibility logic
4. Add onboarding task tracking

### Phase 2: Core Sections (Week 2)

1. Build `TasksSection` with preview cards
2. Build `InsightsSection` with preview cards
3. Build `LensFeed` component
4. Wire up data loaders

### Phase 3: Polish (Week 3)

1. Add `ContextPanel` for desktop
2. Implement `ChatTrigger` FAB
3. Add empty state placeholders
4. Responsive testing & refinement

### Phase 4: Sidebar Simplification (Week 4)

1. Update `app-sidebar.config.ts` with new structure
2. Add count badges to sidebar items
3. Implement progressive disclosure logic
4. Remove deprecated sections

### Migration Strategy

1. Build new dashboard at `/dashboard-v3` route
2. Feature flag for gradual rollout
3. A/B test with subset of users
4. Full migration once validated

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `app/components/layout/AppLayout.tsx` | Add sidebar visibility prop |
| `app/components/navigation/app-sidebar.config.ts` | Simplify navigation structure |
| `app/features/dashboard/routes.ts` | Add v3 route |
| `app/features/dashboard/pages/index.tsx` | Update to use new shell |

## New Files to Create

| File | Purpose |
|------|---------|
| `app/features/dashboard-v3/components/DashboardShell.tsx` | State-aware layout wrapper |
| `app/features/dashboard-v3/components/OnboardingDashboard.tsx` | Empty state experience |
| `app/features/dashboard-v3/components/ActiveDashboard.tsx` | Populated dashboard |
| `app/features/dashboard-v3/components/sections/*.tsx` | Section components |
| `app/features/dashboard-v3/components/shared/EmptyStateBox.tsx` | Reusable empty state |
| `app/features/dashboard-v3/hooks/useDashboardState.ts` | State computation |

---

## Success Metrics

1. **Time to first insight**: < 5 minutes for new users
2. **Onboarding completion**: > 80% complete all 3 tasks
3. **Daily active usage**: Dashboard as most visited page
4. **Feature discovery**: Users find & use all sidebar items within first week

---

## Appendix: Empty State Copy Reference

### Quick Reference for "Do X to See Y" Patterns

| Section | X (Action) | Y (Result) |
|---------|------------|------------|
| Tasks | Upload a conversation | AI-generated action items |
| Insights | Upload a conversation | AI-discovered patterns and themes |
| Lens Results | Configure lenses + upload | Structured analysis |
| People | Upload conversations | Auto-extracted contacts |
| Organizations | Upload conversations | Auto-extracted companies |
| Opportunities | Enable Sales lens + upload | Deal tracking |
| Themes | Upload 3+ conversations | Pattern clusters |

