# Feature Storyboard Template

## Overview
This template guides you through creating feature storyboards that demonstrate user flows and interactions clearly. Focus on showing the actual user journey through your feature, not marketing outcomes.

## Structure Options

### Option A: Simple Feature (3-5 frames)
For features with straightforward interactions

### Option B: Complex Feature (5-8 frames)
For features requiring multiple screens or decision points

## Frame-by-Frame Guide

### Frame 1: Current State & Problem
**Goal:** Show the user's starting point and what triggers the need for this feature
- **What to show:** Actual screen/context where user realizes they need this feature
- **Key elements:**
  - Current UI state
  - User's mental model or expectation
  - Specific trigger moment (error, missing data, inefficient process)
- **Interaction focus:** What the user is trying to do that isn't working well

### Frame 2: Entry Point
**Goal:** Show how the user discovers and accesses your feature
- **What to show:** The exact UI element that leads to your feature
- **Key elements:**
  - Button, menu item, or navigation path
  - Current screen context
  - Visual hierarchy showing discoverability
- **Interaction focus:** The specific click/tap that starts the feature flow

### Frame 3: First Interaction Screen
**Goal:** Demonstrate the initial interface and primary action
- **What to show:** The main feature interface in its initial state
- **Key elements:**
  - Form fields, input areas, or main controls
  - Clear visual hierarchy
  - Helper text or onboarding if needed
- **Interaction focus:** What the user does first (input, selection, configuration)

### Frame 4: Interaction/Processing
**Goal:** Show the user completing the main task or making key decisions
- **What to show:** User actively using the feature (filling forms, making selections, etc.)
- **Key elements:**
  - Interactive states (focused inputs, selected options)
  - Progress indicators if applicable
  - Validation feedback or real-time updates
- **Interaction focus:** The core value-creating interaction

### Frame 5: Result/Confirmation
**Goal:** Show the immediate outcome of the user's action
- **What to show:** Success state, results screen, or confirmation
- **Key elements:**
  - Clear success indicators
  - Actual data/content generated
  - Next step options if applicable
- **Interaction focus:** What the user sees and can do next

### Optional Frames (for complex features):

### Frame 6: Secondary Actions
**Goal:** Show additional capabilities or edge cases
- **What to show:** Secondary screens, settings, or advanced options
- **Interaction focus:** Less common but important user paths

### Frame 7: Integration/Context
**Goal:** Demonstrate how this fits into the broader workflow
- **What to show:** How the feature result appears in other parts of the app
- **Interaction focus:** User returning to main workflow with new capabilities

### Frame 8: Error/Edge Cases
**Goal:** Show how the feature handles problems gracefully
- **What to show:** Error states and recovery paths
- **Interaction focus:** How users get back on track when things go wrong

## Practical Guidelines

### Screen Transitions
- Show actual loading states, not just "instant" results
- Include realistic data and content, not Lorem ipsum
- Demonstrate responsive behavior for different screen sizes
- Show hover states, focus states, and other micro-interactions

### Interaction Details
- Highlight exactly where users click/tap with visual indicators
- Show keyboard shortcuts or gesture controls if relevant
- Include realistic timing (don't skip loading/processing time)
- Show what happens when users navigate away and return

### Edge Case Considerations
- What happens with empty states or missing data?
- How does the feature behave with slow connections?
- What are the error recovery paths?
- How does it work with accessibility tools?

## Quality Checklist

**Technical accuracy:**
- [ ] Shows actual UI components from your design system
- [ ] Includes realistic data and content
- [ ] Demonstrates proper loading and error states
- [ ] Shows complete user flow without gaps

**User flow clarity:**
- [ ] Each frame shows a clear user action or system response
- [ ] Navigation between screens is obvious
- [ ] User's mental model progression is clear
- [ ] Success criteria are visually evident

**Implementation readiness:**
- [ ] Developers can identify required components
- [ ] State management needs are clear
- [ ] API or data requirements are evident
- [ ] Accessibility considerations are included

## Common Patterns

### Form-based features: Problem → Entry → Input → Validation → Confirmation
### Data visualization: Context → Navigation → Loading → Results → Interaction
### Settings/Configuration: Current state → Access → Modify → Preview → Apply
### Collaborative features: Individual action → Sharing → Notification → Group response