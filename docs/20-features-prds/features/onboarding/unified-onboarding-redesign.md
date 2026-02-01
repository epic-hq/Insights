# Unified Onboarding Redesign

| Field | Value |
|-------|-------|
| **Status** | In Review |
| **Author** | UX Analysis + Engineering |
| **Date** | 2026-01-31 |
| **Branch** | `claude/redesign-onboarding-flow-Y0NoU` |

---

## 1. Overview

### 1.1 Problem Statement

Current onboarding has too many choices upfront (4 paths), introduces complex concepts too early (lenses, themes, insights), and buries our strongest differentiator—multimedia surveys with video responses. Users need a simpler mental model: **"Am I doing research or sales?"** followed by the right guided path.

### 1.2 Success Criteria

- [ ] Onboarding completion rate: 60% → 80%
- [ ] Time to first insight: 8+ min → < 5 min
- [ ] Survey creation rate: 3x increase
- [ ] Video response enablement: 10% → 50%
- [ ] Skip-to-dashboard rate: High → < 15%

---

## 2. User Stories

### Primary Stories

| ID | Story | Priority | Acceptance Criteria |
|----|-------|----------|---------------------|
| US-1 | As a **researcher**, I want to quickly set up a survey so that I can start collecting customer feedback today | Must Have | Can share survey link within 3 minutes of signup |
| US-2 | As a **sales manager**, I want to upload my team's call recordings so that I can see why deals are won/lost | Must Have | Can upload and see first insights within 5 minutes |
| US-3 | As a **PM**, I want to interview users about a feature so that I can validate assumptions before building | Must Have | AI generates relevant questions based on my goal |
| US-4 | As a **new user**, I want to understand what this tool does so that I can decide if it's right for me | Should Have | Clear value prop without jargon on first screen |

### Edge Cases

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| EC-1 | User wants both research AND sales | Allow project type selection per project |
| EC-2 | User has no company website | Skip auto-analysis, use manual description |
| EC-3 | User has existing recordings | Detect intent, offer bulk import |
| EC-4 | User is just evaluating | Tertiary "Just exploring" option with demo data |

---

## 3. User Journey

### 3.1 High-Level Flow: Research vs Sales Fork

```mermaid
flowchart LR
    START((Start)) --> INTENT{What brings<br/>you here?}

    INTENT -->|Research| RESEARCH[🔬 Research Path]
    INTENT -->|Sales| SALES[💼 Sales Path]
    INTENT -->|Exploring| EXPLORE[👀 Demo Mode]

    RESEARCH --> VALUE_R[First Evidence]
    SALES --> VALUE_S[First Evidence]
    EXPLORE --> VALUE_E[Sample Data]

    VALUE_R --> GROW[Progressive Features]
    VALUE_S --> GROW
    VALUE_E --> CONVERT[Convert to Real Project]
```

### 3.2 Research Path: Detailed Flow

```mermaid
flowchart TD
    subgraph entry["🚀 Entry"]
        R_START[Research Selected] --> METHOD{How do you<br/>want to learn?}
    end

    subgraph survey["📋 Survey Path"]
        METHOD -->|Surveys| S_CTX[Enter company<br/>website]
        S_CTX --> S_ANALYZE[AI analyzes<br/>your business]
        S_ANALYZE --> S_GOAL[What do you want<br/>to learn?]
        S_GOAL --> S_QUESTIONS[AI generates<br/>survey questions]
        S_QUESTIONS --> S_CONFIG[Configure survey<br/>+ enable video]
        S_CONFIG --> S_SHARE[📤 Share link]
    end

    subgraph interview["🎙️ Interview Path"]
        METHOD -->|Interviews| I_CTX[Enter company<br/>website]
        I_CTX --> I_ANALYZE[AI analyzes<br/>your business]
        I_ANALYZE --> I_GOAL[What do you want<br/>to learn?]
        I_GOAL --> I_QUESTIONS[AI generates<br/>interview questions]
        I_QUESTIONS --> I_ACTION{Record or<br/>upload?}
        I_ACTION -->|Record| I_LIVE[🎤 Live recording]
        I_ACTION -->|Upload| I_UPLOAD[📁 Upload file]
    end

    subgraph outcome["✨ First Value"]
        S_SHARE --> S_WAIT[Wait for responses]
        I_LIVE --> PROCESS[⚙️ Processing]
        I_UPLOAD --> PROCESS
        S_WAIT --> EVIDENCE[🎉 First evidence!]
        PROCESS --> EVIDENCE
    end

    style entry fill:#e8f4f8,stroke:#0ea5e9
    style survey fill:#f0fdf4,stroke:#22c55e
    style interview fill:#fef3c7,stroke:#f59e0b
    style outcome fill:#fdf4ff,stroke:#a855f7
```

### 3.3 Sales Path: Detailed Flow

```mermaid
flowchart TD
    subgraph entry["🚀 Entry"]
        S_START[Sales Selected] --> S_CTX[Enter company<br/>website]
        S_CTX --> S_ANALYZE[AI analyzes<br/>your business]
    end

    subgraph goals["🎯 Goal Selection"]
        S_ANALYZE --> GOAL{What's your<br/>main goal?}
        GOAL -->|Record calls| G_RECORD[🔗 Connect<br/>Zoom/Meet/Teams]
        GOAL -->|Upload past| G_UPLOAD[📁 Upload<br/>recordings]
        GOAL -->|Win/Loss| G_WINLOSS[📁 Upload won<br/>& lost deals]
        GOAL -->|Competitive| G_COMP[📁 Upload calls<br/>with competitors]
    end

    subgraph action["⚡ Quick Start"]
        G_RECORD --> CONNECT[Connect integration]
        G_UPLOAD --> UPLOAD[Upload files]
        G_WINLOSS --> UPLOAD
        G_COMP --> UPLOAD
        CONNECT --> WAIT[Wait for next call]
        UPLOAD --> PROCESS[⚙️ Processing]
    end

    subgraph outcome["✨ First Value"]
        WAIT --> EVIDENCE[🎉 First evidence!]
        PROCESS --> EVIDENCE
    end

    style entry fill:#e8f4f8,stroke:#0ea5e9
    style goals fill:#fefce8,stroke:#eab308
    style action fill:#f0fdf4,stroke:#22c55e
    style outcome fill:#fdf4ff,stroke:#a855f7
```

### 3.4 Progressive Feature Unlock

```mermaid
flowchart LR
    subgraph day0["Day 0"]
        direction TB
        A1[Choose path]
        A2[Set context]
        A3[First action]
        A1 --> A2 --> A3
    end

    subgraph day1["Day 1-3"]
        direction TB
        B1[🎉 First evidence]
        B2[💬 Try Assistant]
        B3[👤 See people]
        B1 --> B2 --> B3
    end

    subgraph week1["Week 1"]
        direction TB
        C1[🏷️ Themes emerge]
        C2[📊 Filter & search]
        C1 --> C2
    end

    subgraph week2["Week 2+"]
        direction TB
        D1[🔍 Apply lenses]
        D2[💡 Create insights]
        D3[📈 CRM/Opps]
        D1 --> D2 --> D3
    end

    day0 --> day1 --> week1 --> week2

    style day0 fill:#e8f4f8,stroke:#0ea5e9
    style day1 fill:#f0fdf4,stroke:#22c55e
    style week1 fill:#fefce8,stroke:#eab308
    style week2 fill:#fdf4ff,stroke:#a855f7
```

### 3.5 Feature Discovery Triggers

```mermaid
flowchart TD
    subgraph triggers["📬 What Triggers New Features"]
        E1[First evidence] --> ASSISTANT["💬 Introduce Assistant"]
        E3[3+ responses] --> THEMES["🏷️ Show Themes"]
        E5[5+ calls] --> LENSES["🔍 Suggest Lenses"]
        E10[10+ evidence] --> INSIGHTS["💡 Create Insight"]
        SALES_5[5+ sales calls] --> OPPS["📈 Track Opportunities"]
    end

    subgraph explain["Just-in-Time Explanation"]
        ASSISTANT --> A_TIP["'Ask me anything<br/>about your data'"]
        THEMES --> T_TIP["'We found patterns<br/>in your responses'"]
        LENSES --> L_TIP["'Try extracting BANT<br/>from this call'"]
        INSIGHTS --> I_TIP["'Bundle these themes<br/>into a report'"]
        OPPS --> O_TIP["'Track this deal<br/>and link evidence'"]
    end

    style triggers fill:#fef3c7,stroke:#f59e0b
    style explain fill:#dbeafe,stroke:#3b82f6
```

---

## 4. Wireframes

### Screen 1: Intent Selection (Entry Point)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Logo] UpSight                                         [Sign Out]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                                                                     │
│                     What brings you to UpSight?                     │
│                                                                     │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │                             │  │                             │  │
│  │     🔬 Customer Research    │  │     💼 Sales Intelligence   │  │
│  │                             │  │                             │  │
│  │  Understand what customers  │  │  Capture and analyze your   │  │
│  │  think, feel, and need      │  │  sales conversations        │  │
│  │                             │  │                             │  │
│  │  • Surveys with video       │  │  • Call recording & upload  │  │
│  │  • Live interviews          │  │  • Win/loss analysis        │  │
│  │  • AI-powered analysis      │  │  • Competitor tracking      │  │
│  │                             │  │                             │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                     │
│                        Just exploring? [Try demo →]                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Screen 2: Research Method Selection

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                        Skip to dashboard →  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                     How do you want to learn?                       │
│                                                                     │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │                             │  │                             │  │
│  │     📋 Surveys              │  │     🎙️ Interviews           │  │
│  │                             │  │                             │  │
│  │  Send a link, collect       │  │  Have conversations and     │  │
│  │  responses at scale         │  │  capture the insights       │  │
│  │                             │  │                             │  │
│  │  ✓ Video responses          │  │  ✓ Live or recorded         │  │
│  │  ✓ Voice & chat modes       │  │  ✓ AI-powered analysis      │  │
│  │  ✓ Anonymous or identified  │  │  ✓ Automatic transcription  │  │
│  │                             │  │                             │  │
│  │  Best for: Scale, async     │  │  Best for: Depth, rapport   │  │
│  │                             │  │                             │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                     │
│                         ◉ ○ ○ ○ (Progress)                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Screen 3: Company Context

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                        Skip to dashboard →  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Let's learn about your company so we can ask better questions.     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  What's your company website?                               │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  https://acme.com                                   │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                             │   │
│  │  We'll analyze your website to understand your business     │   │
│  │  and suggest relevant research questions.                   │   │
│  │                                                             │   │
│  │                                          [Continue →]       │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ○ No website? [Describe your company instead]                      │
│                                                                     │
│                         ○ ◉ ○ ○ (Progress)                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Screen 4: Research Goal + AI Context

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                        Skip to dashboard →  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✓ Found: Acme Corp - B2B project management SaaS                   │
│    Serves: Tech startups, mid-market teams                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  What do you want to learn from your customers?             │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  Why do users churn after the first month?          │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                             │   │
│  │  Suggestions based on your business:                        │   │
│  │                                                             │   │
│  │  [Why do teams choose us over Asana?]                       │   │
│  │  [What features do enterprise buyers need?]                 │   │
│  │  [How do teams onboard new members?]                        │   │
│  │                                                             │   │
│  │                                   [Generate Questions →]    │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                         ○ ○ ◉ ○ (Progress)                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Screen 5: Survey Configuration (Multimedia Promotion)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back                                        Skip to dashboard →  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Your survey is ready! Configure how respondents can answer.        │
│                                                                     │
│  ┌────────────────────────────────┬────────────────────────────┐   │
│  │  Response Modes                │  Preview                   │   │
│  │                                │                            │   │
│  │  [✓] Text responses            │  ┌──────────────────────┐  │   │
│  │      Always available          │  │                      │  │   │
│  │                                │  │  "Why do users       │  │   │
│  │  [✓] Video responses           │  │   churn after the    │  │   │
│  │      Let respondents record    │  │   first month?"      │  │   │
│  │      up to 2 min each          │  │                      │  │   │
│  │      ⭐ Recommended             │  │  [Record Video 🎥]   │  │   │
│  │                                │  │                      │  │   │
│  │  [ ] Voice chat mode           │  │  [Type Answer ⌨️]    │  │   │
│  │      AI conducts interview     │  │                      │  │   │
│  │      (Experimental)            │  └──────────────────────┘  │   │
│  │                                │                            │   │
│  ├────────────────────────────────┤                            │   │
│  │  Respondent Identity           │                            │   │
│  │                                │                            │   │
│  │  ( ) Anonymous                 │                            │   │
│  │  (●) Identified by email       │                            │   │
│  │  ( ) Identified by phone       │                            │   │
│  │                                │                            │   │
│  └────────────────────────────────┴────────────────────────────┘   │
│                                                                     │
│  [Preview Survey]                            [Copy Link & Share →]  │
│                                                                     │
│                         ○ ○ ○ ◉ (Progress)                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Integration Map

### 5.1 Existing Components We're Using

| Component | Location | How We're Using It |
|-----------|----------|-------------------|
| `ProjectSetupProvider` | `app/features/onboarding/context/project-setup-context.tsx` | State management for multi-step flow |
| `project-setup-store.ts` | `app/features/onboarding/context/` | Zustand store for persistence |
| `useProjectRoutes` | `app/hooks/useProjectRoutes.ts` | Navigation after setup complete |
| `ResearchLinkForm` | `app/features/research-links/components/` | Survey creation form |
| `VoiceRecorder` | `app/features/onboarding/components/` | Live recording capability |
| `UploadScreen` | `app/features/onboarding/components/` | File upload flow |

### 5.2 Existing Patterns We're Following

| Pattern | Reference | Notes |
|---------|-----------|-------|
| Multi-step wizard | `OnboardingFlow.tsx` | Stepper with state machine |
| AI suggestions | `ContextualSuggestions.tsx` | Based on captured context |
| Mode switching | `SetupModeSelector.tsx` | Chat/Voice/Form patterns |
| Survey identity modes | Recent commits (b2a2a49, 3bd88f0) | Anonymous/Email/Phone toggle |

### 5.3 What's Net New

| New Component/System | Purpose | Depends On |
|---------------------|---------|------------|
| `IntentSelector` | Research/Sales fork at entry | None |
| `MethodSelector` | Survey/Interview choice | IntentSelector |
| `CompanyContextCapture` | Website → AI analysis | project-setup-store |
| `SurveyConfigPanel` | Multimedia options promotion | ResearchLinkForm |
| `FeatureUnlockBanner` | Progressive feature introduction | User activity tracking |

### 5.4 Integration Diagram

```mermaid
flowchart LR
    subgraph existing["Existing (Keep)"]
        PSP[ProjectSetupProvider]
        RLF[ResearchLinkForm]
        VR[VoiceRecorder]
        UP[UploadScreen]
    end

    subgraph modified["Modified"]
        OF[OnboardingFlow<br/>+ intent routing]
        OB[OnboardingStepper<br/>+ new steps]
    end

    subgraph new["Net New"]
        IS[IntentSelector]
        MS[MethodSelector]
        CC[CompanyContextCapture]
        SC[SurveyConfigPanel]
    end

    IS --> MS
    MS --> CC
    CC --> PSP
    MS -->|Survey| SC
    SC --> RLF
    MS -->|Interview| OF
    OF --> VR
    OF --> UP
```

---

## 6. What We're NOT Changing (Yet)

### Concepts Deferred to Progressive Disclosure

| Concept | Why Defer | When to Introduce |
|---------|-----------|-------------------|
| **Lenses** | Abstract; requires data context | After 5+ conversations: "Try the BANT lens" |
| **Themes** | Need evidence to cluster | After 3+ responses: "We found patterns" |
| **Insights** | Builds on themes | After themes exist: "Bundle into a report" |
| **Opportunities** | Sales-specific, advanced | After 5+ sales calls: "Track this deal" |
| **Personas** | Requires segmentation data | After 10+ people: "Create a segment" |

### UI Changes NOT in Scope

- Navigation restructuring
- Dashboard redesign
- Evidence card redesign
- Theme clustering algorithm

---

## 7. Risk Assessment

### 7.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Website analysis latency | Medium | Medium | Show skeleton, cache results |
| Breaking existing user flows | Medium | High | Feature flag, A/B test |
| State management complexity | Low | Medium | Leverage existing Zustand store |

### 7.2 UX Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Users pick wrong path | Low | Medium | Allow switching, clear descriptions |
| Video default confuses users | Medium | Low | Clear explanation, easy toggle |
| Sales users want research too | Medium | Medium | Per-project type selection |

### 7.3 Open Questions

- [ ] Should "exploring" mode use synthetic data or real demo project?
- [ ] How do we handle users who signed up before this change?
- [ ] Do we need separate onboarding for team invites vs new signups?

---

## 8. Effort Estimate

### 8.1 Work Breakdown

| Task | Scope | Dependencies |
|------|-------|--------------|
| IntentSelector component | Small | None |
| MethodSelector component | Small | IntentSelector |
| CompanyContextCapture integration | Medium | AI endpoint exists |
| SurveyConfigPanel with video promotion | Medium | ResearchLinkForm |
| Route/flow modifications | Medium | All components |
| Progressive feature banners | Medium | Activity tracking |
| Testing & QA | Medium | All above |

### 8.2 Phases

| Phase | What's Included | Deliverable |
|-------|-----------------|-------------|
| **Phase 1: Fork** | Intent + Method selectors, basic routing | Users see Research/Sales choice |
| **Phase 2: Context** | Company analysis before goal, AI suggestions | Smarter question generation |
| **Phase 3: Multimedia** | Survey config panel, video default ON | Higher video adoption |
| **Phase 4: Progressive** | Feature unlock banners, just-in-time tooltips | Reduced cognitive load |

---

## 9. Measuring Success

### Analytics Events to Track

| Event | Trigger | Purpose |
|-------|---------|---------|
| `onboarding_intent_selected` | Click Research/Sales | Path distribution |
| `onboarding_method_selected` | Click Survey/Interview | Method preference |
| `onboarding_company_analyzed` | Website analysis complete | Context capture rate |
| `onboarding_completed` | First action taken | Completion rate |
| `survey_video_enabled` | Video toggle on at creation | Video adoption |
| `feature_banner_shown` | Progressive feature introduced | Discovery timing |
| `feature_banner_clicked` | User engages with feature | Conversion rate |

---

## 10. References

- [Previous: Streamlined Onboarding UX Analysis](./streamlined-onboarding-ux-analysis.md)
- [Generative UI Story](./generative-ui-story.md) (unified-research-flow branch)
- [Generative UI Architecture](./generative-ui-architecture.md) (unified-research-flow branch)
- [Unified Onboarding UI Spec](./unified-onboarding-ui-spec.md)
- [Current Onboarding Spec](./onboarding-spec.md)

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-01-31 | Claude | Initial consolidated spec from UX analysis + unified-research-flow content |
