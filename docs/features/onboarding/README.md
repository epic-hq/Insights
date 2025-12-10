# Onboarding Documentation

This directory contains all documentation related to user onboarding flows.

## Contents

| File | Description |
|------|-------------|
| [implementation.md](./implementation.md) | Technical implementation details, key files, URL structure, and troubleshooting |
| [storyboard.md](./storyboard.md) | Mobile-first UX storyboard with frame-by-frame design specs |
| [dashboard-tasks.md](./dashboard-tasks.md) | Dashboard onboarding tasks shown to new users |

## Overview

The onboarding system has two main components:

### 1. New Project Onboarding Flow

Triggered when a user has no projects. Guides them through:

1. **Welcome/Goals** - Project goals and research context
2. **Questions** - Interview questions generation
3. **Upload** - First document/interview upload
4. **Processing** - Real-time processing feedback

### 2. Dashboard Onboarding Tasks

Shown on the dashboard when a project is empty (no conversations). Displays actionable task cards:

1. **Provide context** - Set up project goals
2. **Add a conversation** - Upload first interview
3. **Review takeaways** - Apply lenses to evidence
4. **Review tasks** - Schedule follow-up conversations

## Key Files

```text
app/features/onboarding/components/OnboardingFlow.tsx    # Main onboarding flow
app/features/dashboard-v3/components/OnboardingDashboard.tsx  # Dashboard tasks
app/features/dashboard-v3/hooks/useDashboardState.ts    # Dashboard state logic
app/routes/_ProtectedLayout.tsx                          # Auto-redirect logic
```

## Dashboard State

The dashboard shows different content based on project state:

- **empty** - No conversations → Shows `OnboardingDashboard`
- **processing** - Conversations being processed → Shows processing state
- **active** - Has processed conversations → Shows full dashboard

See [implementation.md](./implementation.md) for technical details.
