---
stepsCompleted: [1, 2]
inputDocuments:
  - docs/50-market/brand-brief.md
  - docs/20-features-prds/features/onboarding/adaptive-companion-spec-v2.md
  - docs/20-features-prds/features/onboarding/unified-onboarding-ui-spec.md
  - docs/20-features-prds/features/onboarding/adaptive-companion-spec.md
  - docs/20-features-prds/design/ui-style.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
focusArea: Agent-First Experience - Onboarding through Ongoing Use
---

# UX Design Specification: Agent-First Experience

**Author:** Rick
**Date:** March 2, 2026
**Focus:** Agent-centered layout paradigm — from first login through daily use

---

## 1. Product Context

### 1.1 Project Vision

UpSight is reimagining its core interaction model from a traditional nav-and-pages SaaS into an **agent-first experience** where the AI assistant (Uppy) is the primary interface. The agent occupies center stage on first login, guides users through onboarding via rich interactive components rendered inside the conversation, then transitions to a persistent side panel as users begin working — creating a two-column agent+canvas layout that becomes the default for daily use.

This isn't just an onboarding redesign. It's a paradigm shift: from "app with AI assistant" to "AI assistant with a canvas."

### 1.2 What's Being Replaced

| Current System | Status | Replacement |
|---|---|---|
| Steps to Wow (3-path picker + step guide) | **Deprecated** | Agent-driven first actions via rich chat cards |
| FeatureTour (swipeable slides) | **Deprecated** | Agent introduction in first conversation |
| OnboardingFlow (full-page multi-step) | **Deprecated** | Agent-guided setup conversation |
| JourneySidebarGroup (sidebar progress) | **Deprecated** | Agent-aware progress in chat + canvas |
| OnboardingWalkthrough (profile modal) | **Kept** | Stays as-is — collects profiling data (role, use case, company size) that informs the agent's first conversation |
| AIAssistantPanel (floating side panel) | **Evolved** | Becomes the persistent agent column in two-column layout |
| CanvasPanel (A2UI surface) | **Evolved** | Becomes the primary content canvas, enriched with new components |

### 1.3 Brand Alignment

- **Core Promise:** "Get your customers." — help users understand their customers deeply and take clear next steps
- **Voice:** Direct, Confident, Grounded, Useful
- **Core Value:** Understanding that leads to decisions. Not just evidence and receipts — clear next steps, synthesized understanding, and the feeling of being *helped* through complexity
- **Archetype:** The Trusted Operator — calm, experienced, not flashy. The person you want in the room when decisions get hard.
- **Agent personality:** Confident guide who helps you make sense of what you're hearing. Suggests clear next steps without being bossy. Warm but not performative.

### 1.4 Target Users

**Primary personas** (from brand brief):
- **Consultants / Fractional Execs**: Navigating complex stakeholder landscapes — multiple interviews, competing priorities, organizational politics. Need to synthesize fast and deliver clarity to clients. The agent should help them make sense of tangled stakeholder input and surface what matters.
- **Founders (5-30 people)**: Talk to customers constantly, insights trapped in their head. Need the product to capture and organize what they already know.
- **Post-Launch Founders**: Growth stalled, need to find signal in existing conversations fast. Highest urgency.
- **Product Leads (no research team)**: Own customer insight but lack time and tools. Need research infrastructure without the overhead.

**Common traits:**
- Tech-savvy but not power users
- Time-poor, need fast value
- Want to be evidence-driven but lack infrastructure
- 1-50 person teams
- Need to feel *helped*, not lectured

### 1.5 Key Design Challenges

1. **Blank chat → first impression**: The centered agent on first load must feel inviting, not empty. Suggestion badges give users immediate action options without requiring them to know what to type.
2. **Layout transition**: Agent center → agent+canvas must feel like progress, not breakage
3. **Agent authority vs. user agency**: Suggestions must feel like offers, not directives. "Here are some things we could do" energy.
4. **Chat vs. canvas boundary**: Clear mental model for what lives where
5. **Returning user experience**: Agent transitions from main character to persistent collaborator
6. **Mobile expression**: Agent-first paradigm needs a native mobile form
7. **Consultant complexity**: Stakeholder landscapes are messy — the agent needs to help organize, not just collect

### 1.6 Design Opportunities

1. **"The agent remembers"**: Context-aware greetings that build relationship over time. Returning users see progress, not a blank slate.
2. **Rich components as product signature**: Beautiful interactive cards that only appear through the agent — action suggestions, progress summaries, data visualizations
3. **Canvas as living workspace**: Agent updates canvas in real-time as you converse. The two columns become a collaborative workspace.
4. **Onboarding teaches the paradigm**: First session establishes the agent+canvas interaction model that carries through daily use
5. **Sense-making, not just data collection**: The agent doesn't just extract fields — it helps users see patterns, contradictions, and clear next steps across complex inputs
