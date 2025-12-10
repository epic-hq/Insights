# Onboarding Flow Storyboard

Mobile-first UX storyboard for the onboarding experience.

## Overview

A lean, mobile-first onboarding flow that captures user context, enables file upload, and provides educational content during processing while building user confidence.

## Structure: 7 Frames

This flow requires multiple screens and decision points to gather user context and process media.

## Frame-by-Frame Storyboard

### Frame 1: Welcome & Context Setting

**Goal:** Capture user's target market and research goals immediately after signup

**What to show:**

- Clean welcome screen with progress indicator (Step 1 of 3)
- Welcome message: "Let's set up your first project"
- ICP/Persona input field with placeholder: "Who are you researching?"
- Research goal dropdown: "What do you want to learn?"
- Continue button (disabled until ICP filled)

**Interaction focus:** User types their target audience and selects research goal

**Mobile considerations:** Large touch targets, single column layout, auto-focus on input

### Frame 2: Key Questions Setup

**Goal:** Gather specific research questions the user wants answered

**What to show:**

- Question collection interface (Step 2 of 3)
- Header: "What questions do you want answered?"
- Pre-filled suggestions based on selected goal
- "+ Add custom question" button
- Each question has remove option

**Interaction focus:** User can accept suggestions, edit them, or add custom questions

**Mobile considerations:** Swipe to delete questions, expandable text areas

### Frame 3: File Upload

**Goal:** Enable easy media upload with clear instructions

**What to show:**

- Drag & drop upload area (Step 3 of 3)
- Large upload zone: "Drop your interview file here or tap to browse"
- File type indicators: Audio, Video, Document icons
- Media type selector: Interview, Focus Group, Customer Call, etc.

**Interaction focus:** User drags/selects file and chooses media type

**Mobile considerations:** Native file picker, camera option for new recordings

### Frame 4: Upload Processing + Educational Card 1

**Goal:** Show upload progress while providing value about the platform

**What to show:**

- Progress bar: "Uploading... 45%"
- Educational card: "How AI analyzes your interviews"
- Visual: Simple diagram showing audio → transcript → insights
- Auto-advance timer (5 seconds) with pause option

**Interaction focus:** User can pause auto-advance or navigate manually

### Frame 5: Processing + Educational Card 2

**Goal:** Continue education while processing continues

**What to show:**

- Progress: "Analyzing transcript... 70%"
- Educational card: "Getting the most from your insights"
- Tips: "Best practices for interview quality and length"

**Interaction focus:** Passive consumption with optional interaction controls

### Frame 6: Processing + Educational Card 3

**Goal:** Build confidence about data security and privacy

**What to show:**

- Progress: "Generating insights... 90%"
- Educational card: "Your data is secure"
- Privacy highlights: encryption, access controls, deletion options

**Interaction focus:** Reassurance and trust building

### Frame 7: Results & Next Steps

**Goal:** Show completed project with clear value and encourage more uploads

**What to show:**

- Success message: "Your first project is ready!"
- Project summary card showing interview count and key insight preview
- Call-to-action: "Add more interviews to unlock deeper insights"
- Secondary action: "View full analysis"
- Tip: "Projects with 3+ interviews reveal 40% more insights"

**Interaction focus:** User can view results or add more files immediately

## Mobile-First Design Principles

### Screen Transitions

- Smooth slide transitions between steps
- Clear progress indicators throughout
- Swipe gestures for card navigation
- Pull-to-refresh on processing screens

### Interaction Details

- Large touch targets (44px minimum)
- Auto-focus on primary inputs
- Haptic feedback for successful actions
- Loading states with meaningful progress

### Edge Case Considerations

- Upload failures: Clear retry options with network status
- Processing delays: Extended educational content loop
- File format errors: Helpful format conversion suggestions
- Abandoned flow: Save progress and email reminder

## Technical Requirements

### State Management

- Upload progress tracking
- Educational card timing/position
- User input persistence across steps
- Background processing status

### API Integration

- File upload with progress callbacks
- Real-time processing status updates
- User preference storage
- Analytics event tracking

### Performance

- Progressive image loading for educational content
- Offline support for uploaded content
- Background sync when connection restored
- Optimistic UI updates

## Success Metrics

- Completion rate: >80% reach Frame 7
- Upload success rate: >95% first attempt
- Time to first insight: <5 minutes average
- Immediate second upload rate: >30%
- Mobile vs desktop completion parity: >90%

## Implementation Notes

- Educational cards should be configurable CMS content
- Progress calculation should be realistic (not just fake timing)
- File processing should start immediately on upload
- All copy should be A/B testable
- Support for camera capture on mobile devices
