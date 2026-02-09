# Mobile Lean UX Spec

**Date:** 2026-02-08
**Status:** Approved (Party Mode consensus)
**Mock:** [mobile-mock.html](./mobile-mock.html)

## Design Decision

Replace the 5-tab mobile bottom nav (Plan, Sources, AI, Insights, CRM) with a focused 3-item layout:

| Position | Item | Icon | Purpose |
|----------|------|------|---------|
| Left | **AI** | Sparkles | Home screen. Chat, voice input, insight cards |
| Center (elevated) | **Upload** | Plus | One-tap file upload (existing FAB behavior) |
| Right | **People** | Users | Contact lookup, person detail |

## What Gets Cut from Mobile

- Plan (setup, questions, journey mapping) — desktop only
- Sources list/management — upload via center FAB
- Insights/Themes as standalone tab — surfaced via AI chat responses
- Organization management — desktop only
- Opportunities/priorities — desktop only
- Lens configuration — desktop only
- Detailed CRM editing — desktop only
- Onboarding walkthrough — desktop only (or future simplified mobile intro)

## Implementation Tiers

### Tier 1: Ship This Week (2-4 hours total)

**1a. Slim BottomTabBar from 5 → 3 items**
- File: `app/components/navigation/BottomTabBar.tsx`
- Remove Plan, Sources, Insights TabItems
- Keep AI (left), Upload FAB (center elevated), People (right)
- Update `BottomTabBarProps.routes` interface to only require `chat`, `upload`, `crm` (rename to `people`)
- Update active-state detection: AI = `/project-chat` or `/assistant`, People = `/people` or `/organizations`
- Update parent components passing routes prop

**1b. Full-screen AI chat on mobile**
- File: `app/components/layout/SplitPaneLayout.tsx` or equivalent
- When `isMobile`: render chat as full-viewport (no split pane)
- Hide desktop sidebar/panel chrome on mobile
- Ensure chat input bar sits above bottom nav with proper safe-area spacing

**1c. Suggestion chips in mobile chat**
- File: `app/components/chat/ProjectStatusAgentChat.tsx`
- Add horizontal scrollable chip row above input bar (or below header)
- Chips: "Top themes", "Recent calls", "Key people", "Pricing feedback" (contextual)
- Tap chip → sends as message

### Tier 2: This Sprint (3-5 days total)

**2a. Mic button in chat input bar**
- Add mic icon button inside the chat input wrapper (right side, before send)
- Tap → start recording with existing `useSpeechToText` hook
- Visual: mic button pulses red, input placeholder shows "Listening..."
- Transcribed text flows into input, AI processes as evidence/note
- Uses existing MediaRecorder + audio/webm;codecs=opus pattern

**2b. Rich response cards in AI chat**
- Create shared components in `app/components/ui/`:
  - `ThemeCard` — theme name, mention count badge, top quote, attribution
  - `EvidenceCard` — quote with left-border, source attribution, date
  - `PersonCard` — avatar, name, role, org, ICP badge, receipt count
- Render in chat message stream based on structured Mastra agent responses
- Cards are tappable → navigate to full detail view

**2c. People tab mobile optimization**
- Read-only list view with search bar
- Each row: avatar, name, role/org, ICP badge, evidence count
- Tap → person detail card (existing PersonDetailPage, responsive)
- Hide desktop-only features (inline editing, facet lenses) on mobile

**2d. "Ask AI about [person]" button on person detail**
- Add prominent button on mobile person detail view
- Tap → navigates to AI chat with pre-filled query "Tell me about [person name]"
- Bridges People tab back to the AI home screen

### Tier 3: Polish (Future)

- Contextual suggestion chips based on recent activity
- Rich card tap → deep-link to desktop detail view
- Mobile-optimized onboarding (3-screen intro)
- Tablet breakpoint adjustments (768-1023)

## Architecture Notes

- No new routes needed — responsive CSS + conditional rendering
- Center Upload button triggers file picker (existing behavior), not a page navigation
- Desktop navigation (TopNavigation) unchanged — all 5+ categories remain
- Use `hidden md:block` / `md:hidden` for desktop-only UI hiding
- Voice recording uses proven MediaRecorder pattern from codebase
- Rich cards are shared components usable in both chat and standalone views

## Files to Modify

| File | Change |
|------|--------|
| `app/components/navigation/BottomTabBar.tsx` | 5 tabs → 3 items |
| `app/components/layout/SplitPaneLayout.tsx` | Full-screen chat on mobile |
| `app/components/chat/ProjectStatusAgentChat.tsx` | Suggestion chips, mic button |
| `app/components/layout/AppLayout.tsx` | Update routes passed to BottomTabBar |
| Parent route files passing BottomTabBar routes | Update props |
