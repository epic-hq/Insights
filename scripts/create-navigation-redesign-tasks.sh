#!/bin/bash
#
# Create Beads tasks for Navigation Redesign Phase 2 & 3
#
# Run this script after installing Beads:
#   chmod +x scripts/create-navigation-redesign-tasks.sh
#   ./scripts/create-navigation-redesign-tasks.sh
#

echo "Creating Beads tasks for Navigation Redesign..."

# Phase 2: Validation & Refinement
bd create \
  --title="Run Card Sorting Exercise for Navigation Validation" \
  --type=task \
  --priority=2 \
  --body="Execute the card sorting exercise plan to validate the new navigation structure (Plan, Sources, Insights, CRM).

## Reference
See docs/20-features-prds/design/card-sorting-exercise-plan.md for full plan.

## Summary
1. Phase 1: Open Card Sort (Week 2) - Discover how users naturally group features
2. Phase 2: Closed Card Sort (Week 4) - Test proposed categories
3. Phase 3: Tree Testing (Week 4) - Validate findability

## Deliverables
- Similarity matrix from open sort
- Agreement rates from closed sort
- Task success rates from tree test
- Recommendations for IA updates

## Dependencies
- Participant recruitment (8-12 users per phase)
- Tool setup (Optimal Workshop recommended)
- \$25-50 incentive per participant"

bd create \
  --title="Instrument Navigation Analytics" \
  --type=task \
  --priority=2 \
  --body="Add PostHog tracking to the new navigation components for data-driven iteration.

## Track
- Nav item clicks (which items, from which page)
- AI panel open/close events
- Search queries and result clicks
- Time to first navigation after page load
- Onboarding walkthrough completion rate
- Step-by-step drop-off in onboarding

## Implementation
- Add posthog.capture() calls to TopNavigation.tsx
- Add posthog.capture() calls to AIAssistantPanel.tsx
- Add posthog.capture() calls to OnboardingWalkthrough.tsx
- Create dashboard in PostHog for navigation metrics"

bd create \
  --title="A/B Test Evidence Placement" \
  --type=task \
  --priority=3 \
  --body="Test whether Evidence should be in nav or surfaced contextually.

## Variants
A: Evidence as nav item under Insights
B: Evidence surfaced contextually only (on Themes, People, via AI)

## Metrics
- Time to find quotes
- Quote usage in workflows
- User preference survey

## Prerequisites
- Navigation analytics instrumented
- Sufficient user base for statistical significance"

# Phase 3: WOW Factor Features
bd create \
  --title="Implement Contextual AI Transitions" \
  --type=task \
  --priority=2 \
  --body="When user navigates to a new section, AI panel should animate to show relevant context.

## Example
User clicks 'Insights' ->
AI panel updates to show:
'I noticed 3 new themes emerging from your recent interviews. Want me to summarize them?'
[Summarize] [Show evidence first]

## Implementation
- Listen for route changes in AIAssistantPanel
- Fetch relevant context based on destination
- Animate context card transitions
- Generate contextual suggestions per section

## Reference
See docs/20-features-prds/design/navigation-redesign-wireframe.md - WOW Factor section"

bd create \
  --title="Implement Proactive AI Suggestions" \
  --type=task \
  --priority=2 \
  --body="AI should proactively suggest actions based on user activity patterns.

## Examples
- 'You haven't reviewed survey responses in 5 days'
- '3 interviews are ready for theme extraction'
- 'Acme Corp mentioned pricing 4 times - want to see the quotes?'

## Implementation
- Track user activity timestamps
- Define trigger conditions for each suggestion type
- Add suggestion rendering to AIAssistantPanel context card
- Respect user preferences (don't be annoying)"

bd create \
  --title="Implement Evidence Linking on Themes/People" \
  --type=task \
  --priority=2 \
  --body="Show evidence contextually rather than as a nav destination.

## Theme Cards
- Show '12 quotes support this theme' with expand
- Link to source conversations
- Show confidence indicator

## People Profiles
- 'Key quotes from Sarah' section
- Timeline of mentions
- Link to conversations

## Implementation
- Update theme detail components
- Update people profile components
- Add evidence summary queries"

bd create \
  --title="Implement Task Momentum/Streak Indicator" \
  --type=task \
  --priority=3 \
  --body="Gamify task completion with streaks and progress indicators.

## Display
- Progress ring: '████████░░ 80% weekly goal'
- Streak badge: '🔥 3-day streak!'
- Encouragement: 'Complete 1 more task to hit target'

## Implementation
- Track daily task completion
- Store streak data in user_settings
- Add streak display to AIAssistantPanel
- Add celebration animation on milestone"

bd create \
  --title="Implement Smart Navigation Hints" \
  --type=task \
  --priority=3 \
  --body="Show AI-generated hints in mega-menu dropdowns.

## Examples
- 'Sources → Conversations: 2 unreviewed'
- 'Insights → Themes: 1 new pattern detected'
- 'CRM → People: 3 need follow-up'

## Implementation
- Add hints to top-nav.config.ts structure
- Fetch counts/status for each nav item
- Display in NavDropdown component
- Respect performance (don't block render)"

# Onboarding Enhancements
bd create \
  --title="Implement Role-Based Landing Pages" \
  --type=task \
  --priority=3 \
  --body="Direct users to the most relevant page based on their role.

## Role Mapping
- Sales users -> CRM
- Product Managers -> Insights
- Founders -> AI Chat
- Researchers -> Sources

## Implementation
- Read role from onboarding data
- Configure default route per role
- Apply on first login after onboarding
- Allow user to override preference"

bd create \
  --title="Add Onboarding Skip Option" \
  --type=task \
  --priority=3 \
  --body="Allow users to skip onboarding if they prefer to explore.

## Implementation
- Add 'Skip for now' link to walkthrough
- Store skip preference
- Don't show again for 7 days
- Offer to complete later in settings"

echo "Done! Tasks created."
echo ""
echo "View tasks with: bd list"
