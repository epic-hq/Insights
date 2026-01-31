# Streamlined Onboarding UX Analysis

**Author**: UX Analysis
**Date**: January 2026
**Status**: Proposal
**Branch**: `claude/redesign-onboarding-flow-Y0NoU`

---

## Executive Summary

This document analyzes the current UpSight onboarding experience and proposes a streamlined flow that:
1. **Reduces cognitive load** by deferring advanced concepts (lenses, insights) until users have context
2. **Clarifies intent early** with a simple Research vs. Sales fork
3. **Promotes multimedia surveys** as a first-class research method
4. **Captures company context naturally** through conversational UI
5. **Gets users to value faster** by focusing on their immediate goal

---

## Current State Analysis

### Problems Identified

| Issue | Impact | Severity |
|-------|--------|----------|
| **Too many paths upfront** | Users freeze on 4+ options (Plan Discovery, Analyze Recordings, Record a Call, Just Exploring) | High |
| **Premature complexity** | Lenses, themes, insights explained before users understand their value | High |
| **Surveys underexposed** | Multimedia survey capabilities hidden behind "Ask Links" terminology | High |
| **Context captured late** | Company info gathered after research goal, feels disconnected | Medium |
| **Generic entry point** | No distinction between research and sales use cases | Medium |
| **Feature overload** | Voice, chat, form modes all presented simultaneously | Medium |

### Current Flow (Simplified)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Welcome Tour   │ ──► │  4 Path Choice  │ ──► │  Research Goal  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                        ┌───────────────────────────────┘
                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  AI Questions   │ ──► │  Upload/Record  │ ──► │   Processing    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Pain Points:**
- Users must understand research methodology before stating goals
- Company context (website, description) feels like an afterthought
- Survey creation is a separate flow, not integrated with onboarding
- "What are lenses?" interrupts the flow

---

## Proposed Streamlined Flow

### Core Principle: **Intent → Context → Method → Action**

Instead of asking users to understand the tool, ask what they want to accomplish.

### Phase 1: Intent Recognition (10 seconds)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                        What brings you to UpSight?                  │
│                                                                     │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │                             │  │                             │  │
│  │     🔬 Customer Research    │  │     💼 Sales Intelligence   │  │
│  │                             │  │                             │  │
│  │  Understand what customers  │  │  Capture and analyze your   │  │
│  │  think, feel, and need      │  │  sales conversations        │  │
│  │                             │  │                             │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                     │
│                    ○ ○ ○                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Why two paths?**
- Clear mental model: "Research = learning", "Sales = winning"
- Different downstream needs (surveys vs. call recordings)
- Allows tailored onboarding copy and suggestions

---

### Phase 2A: Research Path

#### Step 2A.1: Method Selection

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ← Back                                        Skip to dashboard →  │
│                                                                     │
│                    How do you want to learn?                        │
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
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                     │
│                    ◉ ○ ○                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key UX Decisions:**
- **Surveys get equal visual weight** — no longer buried as "Ask Links"
- **Feature bullets highlight multimedia** — video responses, voice modes
- **Both paths lead to same context capture** — consistent experience

---

#### Step 2A.2: Company Context (Conversational)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ← Back                                        Skip to dashboard →  │
│                                                                     │
│  Let's learn about your company so we can help you ask              │
│  better questions.                                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  What's your company website?                               │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  https://                                           │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                             │   │
│  │  We'll use this to understand your business                 │   │
│  │  and suggest relevant research questions.                   │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                           [ Continue ]                              │
│                                                                     │
│                    ○ ◉ ○                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**After URL submission:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ← Back                                        Skip to dashboard →  │
│                                                                     │
│  ✓ Found: Acme Corp - B2B SaaS for project management              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  What do you want to learn from your customers?             │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  Why are users churning after the first month?      │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                             │   │
│  │  Examples:                                                  │   │
│  │  • "Why do customers choose us over competitors?"           │   │
│  │  • "What features are most valuable to enterprise users?"   │   │
│  │  • "How can we improve onboarding for new teams?"           │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                           [ Generate Questions ]                    │
│                                                                     │
│                    ○ ○ ◉                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Why this order?**
- Company context first enables **smarter suggestions**
- Research goal feels natural after "what's your company?"
- Examples are tailored based on detected industry/business type

---

#### Step 2A.3: Survey Path - Multimedia Promotion

If user selected **Surveys**, show the multimedia capabilities prominently:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Your survey is ready!                                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  🎬 Want richer responses?                                  │   │
│  │                                                             │   │
│  │  Enable video responses to let participants show you        │   │
│  │  their screen, demonstrate workflows, or express            │   │
│  │  emotions you can't capture in text.                        │   │
│  │                                                             │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │  Response Modes                                       │ │   │
│  │  │                                                       │ │   │
│  │  │  [✓] Text responses                                   │ │   │
│  │  │  [✓] Video responses (up to 2 min each)               │ │   │
│  │  │  [ ] Voice chat mode (AI conducts interview)          │ │   │
│  │  │                                                       │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  │                                                             │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │  Respondent Identity                                  │ │   │
│  │  │                                                       │ │   │
│  │  │  ( ) Anonymous                                        │ │   │
│  │  │  (●) Identified by email                              │ │   │
│  │  │  ( ) Identified by phone                              │ │   │
│  │  │                                                       │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [ Preview Survey ]              [ Copy Link & Share ]              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Multimedia Survey Promotion Strategy:**
1. **Default video ON** — opt-out rather than opt-in
2. **Visual examples** — show a video thumbnail of a sample response
3. **Benefits copy** — emphasize "see their screen", "capture emotions"
4. **Voice mode exposed** — but marked as optional/experimental

---

### Phase 2B: Sales Path

#### Step 2B.1: Company Context First

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ← Back                                        Skip to dashboard →  │
│                                                                     │
│  Let's set up your sales intelligence.                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  What's your company website?                               │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────┐   │   │
│  │  │  https://acme.com                                   │   │   │
│  │  └─────────────────────────────────────────────────────┘   │   │
│  │                                                             │   │
│  │  We'll analyze your business to help you:                   │   │
│  │  • Understand competitor mentions in calls                  │   │
│  │  • Track objection patterns                                 │   │
│  │  • Identify what's winning deals                            │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                           [ Continue ]                              │
│                                                                     │
│                    ◉ ○ ○                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### Step 2B.2: Goal Selection

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ← Back                                        Skip to dashboard →  │
│                                                                     │
│  ✓ Found: Acme Corp - B2B SaaS for project management              │
│                                                                     │
│  What's your main goal?                                             │
│                                                                     │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │                             │  │                             │  │
│  │  📞 Record Sales Calls      │  │  📤 Upload Past Calls       │  │
│  │                             │  │                             │  │
│  │  Connect your meeting tool  │  │  Analyze recordings you     │  │
│  │  or record directly         │  │  already have               │  │
│  │                             │  │                             │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │                             │  │                             │  │
│  │  🎯 Win/Loss Analysis       │  │  📊 Competitive Intel       │  │
│  │                             │  │                             │  │
│  │  Understand why you win     │  │  Track what prospects say   │  │
│  │  and lose deals             │  │  about competitors          │  │
│  │                             │  │                             │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                     │
│                    ○ ◉ ○                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### Step 2B.3: Quick Start Action

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ← Back                                        Skip to dashboard →  │
│                                                                     │
│  Ready to capture your first call!                                  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  Choose how to get started:                                 │   │
│  │                                                             │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │  🎤  Record a test call now (30 seconds)              │ │   │
│  │  │      Try the instant analysis                         │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  │                                                             │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │  📁  Upload a past recording                          │ │   │
│  │  │      MP3, MP4, WAV, or video                          │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  │                                                             │   │
│  │  ┌───────────────────────────────────────────────────────┐ │   │
│  │  │  🔗  Connect Zoom/Meet/Teams                          │ │   │
│  │  │      Auto-sync future recordings                      │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                    ○ ○ ◉                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Complete Flow Diagram

```
                              ┌───────────────────┐
                              │   What brings     │
                              │   you here?       │
                              └─────────┬─────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
          ┌─────────────────┐                     ┌─────────────────┐
          │    Research     │                     │      Sales      │
          └────────┬────────┘                     └────────┬────────┘
                   │                                       │
                   ▼                                       ▼
          ┌─────────────────┐                     ┌─────────────────┐
          │ Survey or       │                     │ Company Website │
          │ Interview?      │                     │ (auto-analyze)  │
          └────────┬────────┘                     └────────┬────────┘
                   │                                       │
        ┌──────────┴──────────┐                            ▼
        │                     │                   ┌─────────────────┐
        ▼                     ▼                   │ What's your     │
┌───────────────┐   ┌───────────────┐             │ goal?           │
│   Surveys     │   │  Interviews   │             │ - Record calls  │
└───────┬───────┘   └───────┬───────┘             │ - Upload past   │
        │                   │                     │ - Win/Loss      │
        ▼                   ▼                     │ - Competitive   │
┌───────────────┐   ┌───────────────┐             └────────┬────────┘
│ Company       │   │ Company       │                      │
│ Website       │   │ Website       │                      ▼
└───────┬───────┘   └───────┬───────┘             ┌─────────────────┐
        │                   │                     │ Quick Action:   │
        ▼                   ▼                     │ - Test record   │
┌───────────────┐   ┌───────────────┐             │ - Upload file   │
│ Research Goal │   │ Research Goal │             │ - Connect tool  │
│ + Generate    │   │ + Generate    │             └────────┬────────┘
│ Questions     │   │ Questions     │                      │
└───────┬───────┘   └───────┬───────┘                      │
        │                   │                              │
        ▼                   ▼                              ▼
┌───────────────┐   ┌───────────────┐             ┌─────────────────┐
│ Survey Setup  │   │ Upload/Record │             │   Processing    │
│ + Multimedia  │   │               │             │   + Dashboard   │
│ Options       │   │               │             │                 │
└───────┬───────┘   └───────┬───────┘             └─────────────────┘
        │                   │
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│ Share Link    │   │  Processing   │
└───────────────┘   └───────────────┘
```

---

## What We're NOT Showing Yet

### Deferred to Post-Onboarding

| Concept | Why Defer | When to Introduce |
|---------|-----------|-------------------|
| **Lenses** | Abstract concept; requires data context | After first insights appear |
| **Themes** | Need evidence to cluster | After 3+ conversations processed |
| **Insights** | Builds on themes | After themes are established |
| **People/Personas** | Secondary to core workflow | When viewing individual evidence |
| **Opportunities** | Sales-specific, advanced | After win/loss patterns emerge |
| **Tasks** | Action-oriented, not discovery | After insights are actionable |

### Progressive Disclosure Strategy

```
Onboarding          First Week           Power User
─────────────────────────────────────────────────────

Goal → Method       "Try a lens on       "Create custom
→ Quick Win         this interview"      lens templates"

                    "We found a          "Configure
                    theme in your        theme alerts"
                    responses"

                    "Meet your           "Build persona
                    first persona"       segments"
```

---

## Multimedia Survey Promotion Strategy

### Current Problems

1. **Hidden terminology**: "Ask Links" doesn't convey survey capabilities
2. **Video opt-in friction**: Users don't know video is possible
3. **Voice mode buried**: Experimental badge discourages use
4. **No preview/demo**: Users can't see what video responses look like

### Proposed Solutions

#### 1. Rename "Ask Links" → "Surveys" Everywhere

| Current | Proposed |
|---------|----------|
| "Ask Links" | "Surveys" |
| "Create Ask Link" | "Create Survey" |
| "Ask Link responses" | "Survey responses" |

#### 2. Video Response Gallery in Onboarding

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  See what video responses look like                                 │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  ▶              │  │  ▶              │  │  ▶              │     │
│  │ [Thumbnail 1]   │  │ [Thumbnail 2]   │  │ [Thumbnail 3]   │     │
│  │                 │  │                 │  │                 │     │
│  │ "I love how..." │  │ "My biggest..." │  │ "Watch me..."   │     │
│  │ 0:47            │  │ 1:23            │  │ 0:58            │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
│  Video responses capture emotion, context, and demonstrations       │
│  that text alone can't convey.                                      │
│                                                                     │
│                    [ Enable Video Responses ]                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3. Smart Defaults

| Setting | Default | Rationale |
|---------|---------|-----------|
| Video responses | **Enabled** | Higher engagement, richer data |
| Response mode | Form | Most familiar, lowest friction |
| Voice mode | Visible but off | Experimental; show capability |
| Identity mode | Identified (email) | Enables follow-up, linking |

#### 4. Contextual Nudges

Show these at key moments:

- **After 5 text-only responses**: "Want richer feedback? Enable video responses."
- **On question with low completion**: "Video prompts increase completion by 23%"
- **When creating UX research survey**: "Tip: Enable video to see users demonstrate workflows"

---

## Implementation Recommendations

### Phase 1: Immediate Wins (1-2 weeks)

1. **Rename Ask Links → Surveys** throughout UI
2. **Add Research/Sales fork** as first onboarding step
3. **Move company context before research goal**
4. **Default video responses to ON**

### Phase 2: Enhanced Flow (2-4 weeks)

1. **Build dedicated Sales onboarding path**
2. **Create video response gallery preview**
3. **Implement progressive lens/theme disclosure**
4. **Add contextual multimedia nudges**

### Phase 3: Optimization (4-6 weeks)

1. **A/B test path completion rates**
2. **Track video enablement conversion**
3. **Measure time-to-first-insight by path**
4. **Iterate on Sales path goals**

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Onboarding completion rate | ~60% | 80%+ |
| Time to first insight | 8+ minutes | < 5 minutes |
| Survey creation rate | Low | 3x increase |
| Video response enablement | ~10% | 50%+ |
| Research/Sales path clarity | N/A | 90%+ correct path selection |
| Skip-to-dashboard rate | High | < 15% |

---

## Appendix: Wireframe Annotations

### Mobile Considerations

- All cards should be single-column on mobile
- Video preview thumbnails should be swipeable
- Voice mode recording should work on mobile browsers
- QR code for survey sharing should be prominently displayed

### Accessibility Notes

- All multimedia content needs captions/transcripts
- Video recording should have audio-only fallback
- High contrast mode for all path selection cards
- Screen reader announcements for async processing

### Edge Cases

| Scenario | Handling |
|----------|----------|
| User wants both research + sales | Allow project type selection per project |
| User has no website | Skip auto-analysis, use manual input |
| User already has recordings | Detect from file system, offer import |
| User is evaluating tool | Add "Just exploring" tertiary option |

---

## Mermaid Flow Diagrams

### Level 1: Simple Onboarding Flow (First 5 Minutes)

This is the streamlined entry experience - get users to their first "aha moment" fast.

```mermaid
flowchart TD
    subgraph entry["🚀 Entry Point"]
        START((Start)) --> INTENT{What brings<br/>you here?}
    end

    subgraph research["🔬 Research Path"]
        INTENT -->|Research| METHOD{How do you<br/>want to learn?}
        METHOD -->|Surveys| SURVEY_CTX[Enter company<br/>website]
        METHOD -->|Interviews| INT_CTX[Enter company<br/>website]

        SURVEY_CTX --> SURVEY_GOAL[What do you want<br/>to learn?]
        INT_CTX --> INT_GOAL[What do you want<br/>to learn?]

        SURVEY_GOAL --> SURVEY_CREATE[Create survey<br/>+ enable video]
        INT_GOAL --> INT_QUESTIONS[AI generates<br/>questions]

        SURVEY_CREATE --> SHARE[📤 Share link]
        INT_QUESTIONS --> RECORD{Record or<br/>upload?}
        RECORD -->|Record| LIVE[🎤 Live recording]
        RECORD -->|Upload| UPLOAD[📁 Upload file]
    end

    subgraph sales["💼 Sales Path"]
        INTENT -->|Sales| SALES_CTX[Enter company<br/>website]
        SALES_CTX --> SALES_GOAL{What's your<br/>goal?}
        SALES_GOAL -->|Record calls| SALES_RECORD[🔗 Connect<br/>Zoom/Meet/Teams]
        SALES_GOAL -->|Upload past| SALES_UPLOAD[📁 Upload<br/>recordings]
        SALES_GOAL -->|Win/Loss| SALES_WINLOSS[📁 Upload won<br/>& lost deals]
        SALES_GOAL -->|Competitive| SALES_COMP[📁 Upload calls<br/>with competitors]
    end

    subgraph firstvalue["✨ First Value"]
        SHARE --> WAIT_RESPONSES[Wait for<br/>responses]
        LIVE --> PROCESS[⚙️ Processing...]
        UPLOAD --> PROCESS
        SALES_RECORD --> WAIT_CALLS[Wait for<br/>next call]
        SALES_UPLOAD --> PROCESS
        SALES_WINLOSS --> PROCESS
        SALES_COMP --> PROCESS

        WAIT_RESPONSES --> FIRST_EVIDENCE[🎉 First evidence<br/>extracted!]
        PROCESS --> FIRST_EVIDENCE
        WAIT_CALLS --> FIRST_EVIDENCE
    end

    style entry fill:#e8f4f8,stroke:#0ea5e9
    style research fill:#f0fdf4,stroke:#22c55e
    style sales fill:#fefce8,stroke:#eab308
    style firstvalue fill:#fdf4ff,stroke:#a855f7
```

---

### Level 2: After First Content (Day 1-3)

Once users have their first evidence, introduce the core value props progressively.

```mermaid
flowchart TD
    subgraph trigger["📬 Content Triggers"]
        EVIDENCE[First evidence<br/>extracted] --> NOTIFY[🔔 Notification:<br/>"We found insights!"]
        RESPONSES[3+ survey<br/>responses] --> THEME_TRIGGER[🔔 "Patterns<br/>emerging"]
        CALLS[2+ calls<br/>processed] --> PERSON_TRIGGER[🔔 "Meet your<br/>contacts"]
    end

    subgraph assistant["🤖 AI Assistant Introduction"]
        NOTIFY --> ASSISTANT_PROMPT["💬 Ask me anything<br/>about your data"]
        ASSISTANT_PROMPT --> ASK_EXAMPLE["Try: 'What are<br/>customers saying<br/>about pricing?'"]
        ASK_EXAMPLE --> ASSISTANT_RESPONSE[AI synthesizes<br/>across all evidence]
        ASSISTANT_RESPONSE --> ASSISTANT_HABIT[User learns to<br/>query naturally]
    end

    subgraph evidence["📋 Evidence Dashboard"]
        NOTIFY --> VIEW_EVIDENCE[View evidence<br/>cards]
        VIEW_EVIDENCE --> FILTER_EVIDENCE[Filter by person,<br/>source, date]
        FILTER_EVIDENCE --> UNDERSTAND_RECEIPTS["💡 Aha: Evidence = <br/>verifiable quotes"]
    end

    subgraph themes["🏷️ Themes Discovery"]
        THEME_TRIGGER --> AUTO_THEME[AI clusters<br/>similar evidence]
        AUTO_THEME --> VIEW_THEMES[View theme<br/>cards]
        VIEW_THEMES --> THEME_DRILL[Click theme →<br/>see all evidence]
        THEME_DRILL --> UNDERSTAND_THEMES["💡 Aha: Themes = <br/>patterns across data"]
    end

    subgraph people["👤 People/CRM"]
        PERSON_TRIGGER --> VIEW_PEOPLE[See people<br/>mentioned]
        VIEW_PEOPLE --> PERSON_PROFILE[Click person →<br/>all their quotes]
        PERSON_PROFILE --> LINK_CONTACT["💡 Aha: CRM = <br/>evidence per person"]
    end

    style trigger fill:#fef3c7,stroke:#f59e0b
    style assistant fill:#dbeafe,stroke:#3b82f6
    style evidence fill:#f0fdf4,stroke:#22c55e
    style themes fill:#fce7f3,stroke:#ec4899
    style people fill:#e0e7ff,stroke:#6366f1
```

---

### Level 3: Power User Features (Week 2+)

As users build content and habits, progressively reveal advanced capabilities.

```mermaid
flowchart TD
    subgraph lenses["🔍 Lenses Introduction"]
        EVIDENCE_HABIT[User regularly<br/>views evidence] --> LENS_PROMPT["💡 Tip: Try a<br/>lens on this call"]
        LENS_PROMPT --> LENS_EXPLAIN["Lenses extract<br/>specific angles:<br/>BANT, empathy, etc."]
        LENS_EXPLAIN --> APPLY_LENS[Apply lens<br/>to interview]
        APPLY_LENS --> LENS_RESULTS[See structured<br/>extraction]
        LENS_RESULTS --> LENS_COMPARE[Compare across<br/>multiple calls]
        LENS_COMPARE --> CUSTOM_LENS["⚡ Power: Create<br/>custom lens"]
    end

    subgraph insights["💡 Insights & Reports"]
        THEME_HABIT[User views<br/>themes regularly] --> INSIGHT_PROMPT["💡 Ready to create<br/>an insight?"]
        INSIGHT_PROMPT --> CREATE_INSIGHT[Bundle themes +<br/>evidence]
        CREATE_INSIGHT --> INSIGHT_REPORT[Generate<br/>shareable report]
        INSIGHT_REPORT --> EXPORT_INSIGHT["📤 Export to<br/>Notion/Slides"]
    end

    subgraph crm["📊 CRM & Opportunities"]
        SALES_CALLS[5+ sales calls<br/>processed] --> OPP_PROMPT["💡 Track this<br/>as opportunity?"]
        OPP_PROMPT --> CREATE_OPP[Create<br/>opportunity]
        CREATE_OPP --> LINK_EVIDENCE[Link supporting<br/>evidence]
        LINK_EVIDENCE --> OPP_STAGE[Track deal<br/>stages]
        OPP_STAGE --> WINLOSS[Win/Loss<br/>analysis]
    end

    subgraph automation["⚡ Automation & Scale"]
        POWER_USER[Regular<br/>usage] --> PERSONA_PROMPT["💡 Create a<br/>persona segment?"]
        PERSONA_PROMPT --> CREATE_PERSONA[Define persona<br/>criteria]
        CREATE_PERSONA --> PERSONA_FILTER[Filter all data<br/>by persona]

        POWER_USER --> ALERT_PROMPT["💡 Set up<br/>theme alerts?"]
        ALERT_PROMPT --> CREATE_ALERT[Alert when theme<br/>mentioned]

        POWER_USER --> INTEGRATE_PROMPT["💡 Connect to<br/>Slack/Notion?"]
        INTEGRATE_PROMPT --> INTEGRATIONS[Set up<br/>integrations]
    end

    style lenses fill:#fef3c7,stroke:#f59e0b
    style insights fill:#dbeafe,stroke:#3b82f6
    style crm fill:#f0fdf4,stroke:#22c55e
    style automation fill:#fce7f3,stroke:#ec4899
```

---

### Complete User Journey: From Zero to Power User

```mermaid
flowchart LR
    subgraph day0["Day 0: Onboarding"]
        direction TB
        A1[Choose path:<br/>Research or Sales]
        A2[Set company<br/>context]
        A3[Define goal]
        A4[First action:<br/>survey/upload/record]
        A1 --> A2 --> A3 --> A4
    end

    subgraph day1["Day 1-3: First Value"]
        direction TB
        B1[🎉 First evidence]
        B2[💬 Try Assistant]
        B3[👀 Browse evidence]
        B4[👤 See people]
        B1 --> B2
        B1 --> B3
        B1 --> B4
    end

    subgraph week1["Week 1: Patterns"]
        direction TB
        C1[🏷️ Themes emerge]
        C2[📊 Filter & search]
        C3[➕ Add more data]
        C1 --> C2 --> C3
    end

    subgraph week2["Week 2+: Power Features"]
        direction TB
        D1[🔍 Apply lenses]
        D2[💡 Create insights]
        D3[📈 CRM/Opps]
        D4[👥 Personas]
        D5[⚡ Automations]
        D1 --> D2
        D2 --> D3
        D3 --> D4
        D4 --> D5
    end

    day0 --> day1 --> week1 --> week2

    style day0 fill:#e8f4f8,stroke:#0ea5e9
    style day1 fill:#f0fdf4,stroke:#22c55e
    style week1 fill:#fefce8,stroke:#eab308
    style week2 fill:#fdf4ff,stroke:#a855f7
```

---

### Assistant Usage Patterns

How users interact with the AI assistant at different stages.

```mermaid
flowchart TD
    subgraph early["🌱 Early Stage (0-5 evidence)"]
        E1["'What did Sarah say<br/>about pricing?'"]
        E2["'Summarize my<br/>last interview'"]
        E3["'What questions<br/>should I ask next?'"]
    end

    subgraph growing["🌿 Growing Stage (5-20 evidence)"]
        G1["'What patterns are<br/>emerging about UX?'"]
        G2["'Compare what<br/>startups vs enterprises say'"]
        G3["'What objections<br/>come up most?'"]
    end

    subgraph mature["🌳 Mature Stage (20+ evidence)"]
        M1["'Create a report on<br/>pricing feedback'"]
        M2["'What changed since<br/>last quarter?'"]
        M3["'Which personas<br/>are most interested in X?'"]
        M4["'Prepare me for<br/>my call with Acme'"]
    end

    subgraph actions["🎯 Assistant Actions"]
        SEARCH[Search across<br/>all evidence]
        SYNTHESIZE[Synthesize<br/>patterns]
        GENERATE[Generate<br/>reports/emails]
        RECOMMEND[Recommend<br/>next steps]
    end

    early --> SEARCH
    growing --> SEARCH
    growing --> SYNTHESIZE
    mature --> SEARCH
    mature --> SYNTHESIZE
    mature --> GENERATE
    mature --> RECOMMEND

    style early fill:#fef3c7,stroke:#f59e0b
    style growing fill:#bbf7d0,stroke:#22c55e
    style mature fill:#c7d2fe,stroke:#6366f1
    style actions fill:#fce7f3,stroke:#ec4899
```

---

### Lens Usage Flow

When and how users discover and apply lenses.

```mermaid
flowchart TD
    subgraph discovery["🔍 Lens Discovery"]
        INTERVIEW[View processed<br/>interview] --> SUGGEST["💡 'Try the BANT<br/>lens on this call'"]
        SUGGEST --> EXPLAIN["Lenses = structured<br/>extraction templates"]
    end

    subgraph apply["📋 Apply Lens"]
        EXPLAIN --> CHOOSE{Choose lens}
        CHOOSE -->|BANT| BANT["Budget, Authority,<br/>Need, Timeline"]
        CHOOSE -->|Empathy Map| EMPATHY["Think, Feel,<br/>Say, Do"]
        CHOOSE -->|Jobs-to-be-Done| JTBD["Job, Context,<br/>Outcome"]
        CHOOSE -->|Win/Loss| WINLOSS["Why won,<br/>Why lost"]
        CHOOSE -->|Custom| CUSTOM["Define your<br/>own fields"]
    end

    subgraph results["📊 Lens Results"]
        BANT --> EXTRACT[AI extracts<br/>structured data]
        EMPATHY --> EXTRACT
        JTBD --> EXTRACT
        WINLOSS --> EXTRACT
        CUSTOM --> EXTRACT

        EXTRACT --> VIEW_RESULTS[View filled<br/>lens card]
        VIEW_RESULTS --> COMPARE[Compare across<br/>interviews]
        COMPARE --> SPOT_GAPS["💡 Spot gaps:<br/>'3/10 calls have<br/>budget info'"]
    end

    subgraph scale["⚡ Scale Usage"]
        SPOT_GAPS --> AUTO_APPLY["Auto-apply lens<br/>to all new calls"]
        AUTO_APPLY --> AGGREGATE["Aggregate view:<br/>All BANT data"]
        AGGREGATE --> EXPORT["Export to<br/>CRM/spreadsheet"]
    end

    style discovery fill:#fef3c7,stroke:#f59e0b
    style apply fill:#dbeafe,stroke:#3b82f6
    style results fill:#f0fdf4,stroke:#22c55e
    style scale fill:#fce7f3,stroke:#ec4899
```

---

### CRM Integration Flow

How evidence connects to opportunities and deal tracking.

```mermaid
flowchart TD
    subgraph capture["📥 Capture"]
        CALL[Sales call<br/>recorded] --> PROCESS[⚙️ Process &<br/>transcribe]
        PROCESS --> EXTRACT[Extract<br/>evidence]
        EXTRACT --> PERSON[Link to<br/>person/contact]
    end

    subgraph enrich["🔗 Enrich"]
        PERSON --> EXISTING{Existing<br/>opportunity?}
        EXISTING -->|Yes| LINK_OPP[Link evidence<br/>to opportunity]
        EXISTING -->|No| CREATE_OPP[Create new<br/>opportunity]
        CREATE_OPP --> LINK_OPP
    end

    subgraph track["📊 Track"]
        LINK_OPP --> OPP_VIEW[View opportunity<br/>with all evidence]
        OPP_VIEW --> TIMELINE[See conversation<br/>timeline]
        OPP_VIEW --> KEY_QUOTES[Highlight key<br/>quotes]
        OPP_VIEW --> STAGE[Update deal<br/>stage]
    end

    subgraph analyze["📈 Analyze"]
        STAGE --> WINLOSS_BUCKET{Won or<br/>lost?}
        WINLOSS_BUCKET -->|Won| WON_ANALYSIS["Analyze: What<br/>worked?"]
        WINLOSS_BUCKET -->|Lost| LOST_ANALYSIS["Analyze: What<br/>blocked?"]
        WON_ANALYSIS --> PATTERNS[Pattern recognition<br/>across deals]
        LOST_ANALYSIS --> PATTERNS
        PATTERNS --> PLAYBOOK["💡 Build winning<br/>playbook"]
    end

    subgraph action["🎯 Action"]
        PLAYBOOK --> COACH["Coach reps on<br/>winning patterns"]
        PLAYBOOK --> ALERT["Alert on<br/>at-risk deals"]
        PLAYBOOK --> PREP["Prep for calls<br/>with context"]
    end

    style capture fill:#e8f4f8,stroke:#0ea5e9
    style enrich fill:#fef3c7,stroke:#f59e0b
    style track fill:#f0fdf4,stroke:#22c55e
    style analyze fill:#dbeafe,stroke:#3b82f6
    style action fill:#fce7f3,stroke:#ec4899
```

---

### Feature Unlock Timeline

Visual representation of progressive disclosure based on user activity.

```mermaid
gantt
    title Feature Unlock Timeline
    dateFormat X
    axisFormat %s

    section Onboarding
    Choose path (Research/Sales)     :done, 0, 1
    Company context                  :done, 1, 2
    First survey/upload              :done, 2, 3

    section Day 1
    View first evidence              :active, 3, 4
    Browse evidence dashboard        :4, 5
    Try AI Assistant                 :5, 6

    section Week 1
    See auto-generated themes        :7, 8
    View people/contacts             :8, 9
    Filter & search                  :9, 10

    section Week 2
    Apply first lens                 :12, 13
    Create insight report            :13, 14
    Create opportunity (Sales)       :14, 15

    section Power User
    Custom lenses                    :18, 19
    Persona segments                 :19, 20
    Integrations & alerts            :20, 21
```

---

### Decision Tree: What Should User Do Next?

```mermaid
flowchart TD
    START{What's your<br/>situation?}

    START -->|"I have no data yet"| NO_DATA
    START -->|"I have some evidence"| SOME_DATA
    START -->|"I have lots of data"| LOTS_DATA

    subgraph NO_DATA["🌱 No Data Yet"]
        ND1{Research or<br/>Sales?}
        ND1 -->|Research| ND_RESEARCH{Qualitative or<br/>quantitative?}
        ND_RESEARCH -->|"Deep understanding"| REC_INTERVIEW["→ Record/upload<br/>interviews"]
        ND_RESEARCH -->|"Scale & speed"| REC_SURVEY["→ Create video<br/>survey"]
        ND1 -->|Sales| ND_SALES{Have past<br/>recordings?}
        ND_SALES -->|Yes| REC_UPLOAD["→ Upload past<br/>calls"]
        ND_SALES -->|No| REC_CONNECT["→ Connect Zoom<br/>for next call"]
    end

    subgraph SOME_DATA["🌿 Some Evidence (5-20)"]
        SD1{What do you<br/>want to do?}
        SD1 -->|"Find patterns"| REC_THEMES["→ Check Themes<br/>page"]
        SD1 -->|"Ask questions"| REC_ASSISTANT["→ Use AI<br/>Assistant"]
        SD1 -->|"Track contacts"| REC_PEOPLE["→ View People<br/>page"]
        SD1 -->|"Get more data"| REC_MORE["→ Add more<br/>conversations"]
    end

    subgraph LOTS_DATA["🌳 Lots of Data (20+)"]
        LD1{What's your<br/>goal?}
        LD1 -->|"Extract structure"| REC_LENS["→ Apply lenses<br/>to calls"]
        LD1 -->|"Share findings"| REC_INSIGHT["→ Create insight<br/>report"]
        LD1 -->|"Track deals"| REC_OPP["→ Create<br/>opportunities"]
        LD1 -->|"Segment users"| REC_PERSONA["→ Build persona<br/>segments"]
        LD1 -->|"Automate"| REC_AUTO["→ Set up alerts<br/>& integrations"]
    end

    style NO_DATA fill:#fef3c7,stroke:#f59e0b
    style SOME_DATA fill:#bbf7d0,stroke:#22c55e
    style LOTS_DATA fill:#c7d2fe,stroke:#6366f1
```

---

## References

- [Current Onboarding Spec](./onboarding-spec.md)
- [Unified Setup V2 Voice-First](./unified-setup-v2-voice-first.md)
- [Unified Onboarding UI Spec](./unified-onboarding-ui-spec.md)
