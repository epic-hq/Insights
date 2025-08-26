# Onboarding Flow Components

Mobile-first onboarding flow based on the Metro design system that guides users through setting up their first project.

## Components

### `OnboardingFlow.tsx`
Main container component that manages the flow state and navigation between screens.

### `ProjectGoalsScreen.tsx` (Frame 1)
- Captures target market/ICP and research goal
- Single column mobile-first layout
- Auto-focus on input field
- Progress indicator (Step 1 of 3)

### `QuestionsScreen.tsx` (Frame 2)
- Collects research questions
- Pre-filled suggestions based on research goal
- Editable questions with add/remove functionality
- Mobile-optimized with swipe-to-delete patterns

### `UploadScreen.tsx` (Frame 3)
- File upload with drag & drop
- Media type selection
- Mobile file picker integration
- File validation and preview

### `ProcessingScreen.tsx` (Frames 4-6)
- Real-time progress updates
- Auto-advancing educational cards
- Pause/play controls for cards
- Mobile-optimized navigation

### `ProjectStatusScreen.tsx` (Frame 7)
- Project completion summary
- Encouragement to add more interviews
- Clear CTAs for next actions
- Project statistics display

## Usage

```tsx
import OnboardingFlow from "~/features/onboarding/components/OnboardingFlow"

<OnboardingFlow
  onComplete={(data) => {
    // Handle completed onboarding data
    console.log(data)
  }}
  onAddMoreInterviews={() => {
    // Navigate to add interview
  }}
  onViewResults={() => {
    // Navigate to dashboard
  }}
/>
```

## Design System

- Uses Metro design patterns (black background, colored cards)
- Mobile-first responsive design
- Large touch targets (44px minimum)
- Consistent spacing and typography
- Auto-advancing educational content

## Data Flow

1. **Welcome**: ICP, research goal
2. **Questions**: Research questions array
3. **Upload**: File + media type
4. **Processing**: Background file processing
5. **Complete**: Project created, encourage next steps

## Integration Points

- File upload needs backend processing endpoint
- Project creation needs database integration
- Navigation needs route configuration
- Analytics tracking for completion rates