# Dashboard & Navigation Redesign Plan

## Overview

Redesign the Insights dashboard to better showcase lens results, provide clear paths to setup goals and upload content, with a mobile-first approach using bottom tab navigation and a feature tour splash screen.

---

## 1. New Dashboard Architecture

### Design Philosophy
- **State-aware UI**: Dashboard adapts based on project progress (empty, in-progress, rich data)
- **Action-oriented**: Clear CTAs for the most relevant next action
- **Results-focused**: Lens results are the primary value display
- **Mobile-first**: Designed for touch, works great on desktop

### Dashboard States

#### A. Empty State (No content)
```
┌─────────────────────────────────────┐
│  Welcome to [Project Name]          │
│  Let's get started                  │
├─────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐          │
│  │ 🎯      │  │ 📤      │          │
│  │ Setup   │  │ Upload  │          │
│  │ Goals   │  │ Content │          │
│  └─────────┘  └─────────┘          │
│                                     │
│  [Start with a quick setup →]       │
└─────────────────────────────────────┘
```

#### B. In-Progress State (Some content, waiting for analysis)
```
┌─────────────────────────────────────┐
│  [Project Name] • 3 conversations   │
├─────────────────────────────────────┤
│  📊 Processing 2 conversations...   │
│  ████████░░ 80%                     │
├─────────────────────────────────────┤
│  Quick Actions                      │
│  [+ Upload] [⚙ Goals] [📋 Lenses]  │
└─────────────────────────────────────┘
```

#### C. Results State (Rich data available)
```
┌─────────────────────────────────────┐
│  [Project Name]                     │
│  12 conversations • 4 lenses active │
├─────────────────────────────────────┤
│  ┌─ Lens Results ─────────────────┐ │
│  │ 💰 Sales BANT    [View →]      │ │
│  │    4 qualified, 2 objections   │ │
│  ├─────────────────────────────────┤ │
│  │ 🔍 Customer Discovery [View →] │ │
│  │    3 problems validated        │ │
│  └─────────────────────────────────┘ │
│                                     │
│  Quick Actions                      │
│  [+ Upload] [⚙ Goals] [📋 All Lenses]│
└─────────────────────────────────────┘
```

### Key Components

#### 1. ProjectHeader (Compact)
- Project name with edit capability
- Quick stats: conversations count, active lenses
- Progress indicator if processing

#### 2. LensResultsGrid
- Card-based grid showing enabled lenses
- Each card shows:
  - Lens icon + name
  - Key metric/insight count
  - Status indicator (has data / needs more)
  - Tap to view full results

#### 3. QuickActionsBar
- Sticky/prominent action buttons
- Context-aware: different actions for different states
- Actions:
  - Upload Content (opens upload sheet)
  - Setup Goals (links to setup page)
  - Lens Library (configure lenses)

#### 4. RecentActivity (Optional)
- Last 3-5 conversations processed
- Tap to view conversation with lenses

---

## 2. Navigation Redesign

### Bottom Tab Bar (Mobile)
```
┌───────────────────────────────────────┐
│   🏠      📊      ➕      🔍      ⚙   │
│  Home   Results  Upload  Search  More │
└───────────────────────────────────────┘
```

**5 Tabs:**
1. **Home** - Dashboard (current project status)
2. **Results** - Lens results & analysis views
3. **Upload** - Quick add content (floating action style)
4. **Search** - Search conversations, people, insights
5. **More** - Settings, projects list, profile

### Desktop Sidebar (Simplified)
Keep existing sidebar but reorganize:

```
Discovery
  ├─ Dashboard (home icon)
  ├─ Objectives (target icon)
  └─ Conversations (file icon)

Results (NEW grouping)
  ├─ Lens Overview (grid icon)
  ├─ Sales BANT
  ├─ Customer Discovery
  ├─ ICP Discovery
  ├─ Themes
  └─ Findings

Directory
  ├─ People
  ├─ Organizations
  └─ Opportunities
```

### Simplified User Flows

#### Flow 1: First-Time User
```
Splash → Feature Tour → Create Project → Setup Goals → Upload First Content → Dashboard
```

#### Flow 2: Returning User (Has Data)
```
Login → Dashboard (shows lens results) → Tap lens → View aggregated analysis
```

#### Flow 3: Upload Content
```
Dashboard → Tap Upload → Select file type → Upload → Processing → See results
```

---

## 3. Splash Screen / Feature Tour

### Structure: 4 Screens

#### Screen 1: Welcome
```
┌─────────────────────────┐
│                         │
│    [Logo Animation]     │
│                         │
│   Turn conversations    │
│   into insights         │
│                         │
│   [Get Started]         │
│   Already have account? │
└─────────────────────────┘
```

#### Screen 2: Upload
```
┌─────────────────────────┐
│   [Illustration]        │
│   📹 🎙 📝              │
│                         │
│   Upload anything       │
│   Recordings, notes,    │
│   voice memos           │
│                         │
│   ● ○ ○ ○    [Next →]  │
└─────────────────────────┘
```

#### Screen 3: Lenses
```
┌─────────────────────────┐
│   [Illustration]        │
│   🔍 Lenses             │
│                         │
│   Automatic analysis    │
│   Sales, Research,      │
│   Product frameworks    │
│                         │
│   ○ ● ○ ○    [Next →]  │
└─────────────────────────┘
```

#### Screen 4: Results
```
┌─────────────────────────┐
│   [Illustration]        │
│   📊                    │
│                         │
│   Actionable insights   │
│   See patterns across   │
│   all conversations     │
│                         │
│   ○ ○ ● ○ [Start Now →]│
└─────────────────────────┘
```

---

## 4. Component Implementation Plan

### New Components to Create

```
app/features/dashboard/components/
├── DashboardV2.tsx           # Main dashboard component
├── ProjectHeader.tsx         # Compact project header
├── LensResultsGrid.tsx       # Grid of lens result cards
├── LensResultCard.tsx        # Individual lens card
├── QuickActionsBar.tsx       # Action buttons bar
├── EmptyState.tsx            # Empty project state
├── ProcessingState.tsx       # Processing indicator

app/components/navigation/
├── BottomTabBar.tsx          # Mobile bottom navigation
├── TabBarItem.tsx            # Individual tab item

app/features/onboarding/components/
├── SplashScreen.tsx          # Initial splash
├── FeatureTour.tsx           # Swipeable tour
├── TourSlide.tsx             # Individual slide
```

### Files to Modify

```
app/features/dashboard/pages/metro-index.tsx
  → Replace with new DashboardV2 component

app/components/navigation/app-sidebar.config.ts
  → Reorganize sections (Discovery, Results, Directory)

app/components/AppLayout.tsx
  → Add BottomTabBar for mobile

app/routes.ts
  → Add splash/tour routes
```

---

## 5. Implementation Phases

### Phase 1: Core Dashboard
1. Create DashboardV2 with state-aware UI
2. Create LensResultsGrid and LensResultCard
3. Create QuickActionsBar
4. Create EmptyState and ProcessingState

### Phase 2: Mobile Navigation
1. Create BottomTabBar component
2. Integrate into AppLayout (mobile only)
3. Update routing for tab navigation

### Phase 3: Splash & Tour
1. Create SplashScreen component
2. Create FeatureTour with swipeable slides
3. Add routing and localStorage tracking (shown once)

### Phase 4: Polish
1. Animations and transitions
2. Dark mode verification
3. Accessibility pass
4. Performance optimization

---

## 6. Technical Decisions

### State Management
- Use existing React Router loaders for data
- Local state for UI interactions
- Zustand for cross-component state if needed

### Mobile Detection
- Use existing `useIsMobile()` hook (768px breakpoint)
- Conditional rendering for nav components

### Routing
- Keep existing route structure
- Add `/welcome` for splash/tour (public route)
- Dashboard remains at project root

### Data Loading
- Reuse existing loader from metro-index.tsx
- Add lens summary data to loader
- Cache lens results in loader

---

## 7. Design Tokens

### Spacing (Mobile)
- Touch targets: min 44px
- Card padding: 16px
- Grid gap: 12px
- Bottom bar height: 56px + safe area

### Colors (Using existing)
- Primary actions: `bg-primary`
- Secondary actions: `bg-secondary`
- Success states: `text-green-600`
- Cards: `bg-card border-border`

### Typography
- Page title: `text-xl font-semibold`
- Card title: `text-base font-medium`
- Body: `text-sm`
- Caption: `text-xs text-muted-foreground`

---

## Summary

This redesign focuses on:
1. **Clarity**: Users immediately see their lens results
2. **Action**: Clear paths to upload, setup, and explore
3. **Mobile-first**: Bottom tab bar, touch-friendly targets
4. **Progressive**: UI adapts to project state
5. **Minimal**: Lean design, no clutter
