# Dashboard Onboarding Tasks

Documentation for the onboarding task cards shown on the dashboard for new users.

## Overview

When a project has no conversations (empty state), the dashboard displays onboarding task cards to guide users through initial setup. These tasks are defined in `OnboardingDashboard.tsx` and rendered as actionable cards.

## Task Definitions

The onboarding tasks are defined in `app/features/dashboard-v3/components/OnboardingDashboard.tsx`:

```typescript
const onboardingTasks: OnboardingTask[] = [
  {
    id: "setup",
    title: "Provide context",
    description: "Help us understand your research goals and target audience",
    href: `${projectPath}/setup`,
    isComplete: hasGoals,
    priority: 1,
  },
  {
    id: "upload",
    title: "Add a conversation",
    description: "Upload an interview, call recording, or research session",
    href: `${projectPath}/interviews/upload`,
    isComplete: hasConversations,
    priority: 2,
  },
  {
    id: "review",
    title: "Review takeaways and apply lenses",
    description: "See what insights emerged and apply analysis lenses",
    href: hasConversations ? `${projectPath}/evidence` : undefined,
    isComplete: hasAppliedLenses,
    priority: 3,
  },
  {
    id: "tasks",
    title: "Review tasks and schedule conversations",
    description: "Plan your next research activities",
    href: hasConversations ? `${projectPath}/priorities` : undefined,
    isComplete: false,
    priority: 4,
  },
]
```

## Completion Logic

Each task's completion status is determined by props passed to `OnboardingDashboard`:

| Task | Completion Condition |
|------|---------------------|
| Provide context | `hasGoals` - Project has research goals defined |
| Add a conversation | `hasConversations` - Project has at least one conversation |
| Review takeaways | `hasAppliedLenses` - At least one lens has been applied |
| Review tasks | Always `false` - Ongoing activity |

## When Tasks Appear

The dashboard state machine determines when to show onboarding tasks:

```typescript
// From useDashboardState.ts
function getDashboardState(): DashboardState {
  if (conversationCount === 0) {
    return "empty"  // Shows OnboardingDashboard
  }
  if (processingCount > 0 && conversationCount === processingCount) {
    return "processing"
  }
  return "active"
}
```

The `DashboardShell.tsx` component renders `OnboardingDashboard` when state is `"empty"`.

## Key Files

| File | Purpose |
|------|---------|
| `app/features/dashboard-v3/components/OnboardingDashboard.tsx` | Main component with task definitions |
| `app/features/dashboard-v3/components/onboarding/OnboardingTaskCard.tsx` | Individual task card component |
| `app/features/dashboard-v3/components/DashboardShell.tsx` | Wrapper that decides which dashboard to show |
| `app/features/dashboard-v3/hooks/useDashboardState.ts` | State machine for dashboard mode |

## Task Card Behavior

### Enabled Tasks

- Rendered as a `Link` component
- Clickable, navigates to the task's `href`
- Shows completion checkmark if `isComplete`

### Disabled Tasks

- Rendered as a `div` (not clickable)
- Grayed out appearance
- `href` is `undefined` when prerequisites not met

## Customization

### Adding New Tasks

1. Add task object to `onboardingTasks` array in `OnboardingDashboard.tsx`
2. Define completion condition via new prop
3. Set appropriate `href` and `priority`

### Changing Task Order

Modify the `priority` field - lower numbers appear first.

### Styling

Task cards use `OnboardingTaskCard` component which accepts:

- `title` - Task name
- `description` - Brief explanation
- `icon` - Lucide icon component
- `isComplete` - Shows checkmark when true
- `href` - Navigation target (undefined = disabled)
