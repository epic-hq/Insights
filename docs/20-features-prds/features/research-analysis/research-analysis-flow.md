# Research Analysis Flow Diagram

## Visual Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                         RESEARCH GOAL                            │
│  "Identify monetization model for meeting place app"            │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DECISION QUESTIONS (DQs)                      │
│  Strategic business decisions to make                            │
│                                                                   │
│  Example: "What monetization model should we adopt?"            │
│                                                                   │
│  OUTPUT: Strategic Insight + Recommended Actions                 │
│  • "Adopt freemium model with premium interview features"       │
│  • Actions: [Develop free tier, Create premium tier, ...]      │
└─────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │ (synthesized from)
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                   RESEARCH QUESTIONS (RQs)                       │
│  Specific questions to investigate                               │
│                                                                   │
│  Example: "What features are users willing to pay for?"         │
│                                                                   │
│  OUTPUT: Evidence-Based Findings                                 │
│  • "Users willing to pay for interview tools (5 mentions)"      │
│  • "Users value event connections (3 mentions)"                 │
│  • "Current tools seen as overpriced (4 mentions)"              │
└─────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │ (aggregated from)
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                    INTERVIEW PROMPTS                             │
│  Natural questions asked during interviews                       │
│                                                                   │
│  Example: "Tell me about tools you currently pay for..."        │
│  Example: "What would make you willing to pay for this app?"    │
└─────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │ (collected from)
                                 │
┌─────────────────────────────────────────────────────────────────┐
│                         EVIDENCE                                 │
│  Raw quotes and observations from interviews                     │
│                                                                   │
│  • "I'd definitely pay for something that helps me run better   │
│    interviews" - Participant A                                   │
│  • "Price matters less than whether it actually works" - P.B    │
│  • "Current tools are overpriced for what they do" - P.C        │
└─────────────────────────────────────────────────────────────────┘
```

## Three-Phase Analysis Process

```
┌─────────────────────────────────────────────────────────────────┐
│                        PHASE 1                                   │
│              Evidence → Research Questions                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Input:  Evidence items (quotes, observations)                   │
│  Output: Evidence links to RQs                                   │
│                                                                   │
│  ┌──────────────┐                                                │
│  │  Evidence 1  │ ──┐                                            │
│  └──────────────┘   │                                            │
│                     ├──→ RQ1 (confidence: 0.85, supports)        │
│  ┌──────────────┐   │                                            │
│  │  Evidence 2  │ ──┤                                            │
│  └──────────────┘   │                                            │
│                     └──→ RQ2 (confidence: 0.72, refutes)         │
│  ┌──────────────┐                                                │
│  │  Evidence 3  │ ────→ RQ1 (confidence: 0.91, supports)         │
│  └──────────────┘                                                │
│                                                                   │
│  AI Task: Link each evidence to relevant RQs only                │
│           (NOT to Decision Questions directly)                   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PHASE 2                                   │
│         Research Question Answers (Findings)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Input:  RQ + Linked Evidence                                    │
│  Output: Evidence-based findings                                 │
│                                                                   │
│  RQ1: "What features are users willing to pay for?"             │
│                                                                   │
│  Evidence: [ev-1, ev-3] (2 pieces, high confidence)             │
│                                                                   │
│  Findings:                                                        │
│  • "Users willing to pay for interview tools (5 mentions)"      │
│  • "Users value event connections (3 mentions)"                 │
│  • "Current tools seen as overpriced (4 mentions)"              │
│                                                                   │
│  Confidence: 0.82                                                 │
│  Reasoning: "Strong evidence from multiple interviews..."        │
│                                                                   │
│  AI Task: Synthesize evidence into specific findings             │
│           Include mention counts and confidence levels           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PHASE 3                                   │
│       Decision Question Answers (Strategic Insights)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Input:  DQ + RQ Answers (findings)                              │
│  Output: Strategic insight + actions                             │
│                                                                   │
│  DQ: "What monetization model should we adopt?"                 │
│                                                                   │
│  RQ Findings:                                                     │
│  • RQ1: Users willing to pay for interview tools                │
│  • RQ2: Value perception trumps cost concerns                   │
│                                                                   │
│  Strategic Insight:                                               │
│  "Adopt freemium model with premium interview features"         │
│                                                                   │
│  Supporting Findings:                                             │
│  • Users willing to pay for interview tools                     │
│  • Event networking valued but secondary                        │
│  • Value trumps cost in decision-making                         │
│                                                                   │
│  Recommended Actions:                                             │
│  1. Develop core interview features for free tier               │
│  2. Create premium tier with advanced assistance                │
│  3. Add event networking as premium upsell                      │
│  4. Price based on value delivery, not cost savings             │
│                                                                   │
│  Confidence: 0.78                                                 │
│  Reasoning: "Research findings show clear willingness..."        │
│                                                                   │
│  AI Task: Synthesize RQ findings into strategic answer           │
│           Provide actionable recommendations                     │
└─────────────────────────────────────────────────────────────────┘
```

## Data Storage Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    project_answers Table                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  RQ Answer (Evidence-Based):                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ id: ans-123                                             │    │
│  │ research_question_id: rq-456                           │    │
│  │ decision_question_id: dq-789 (parent)                  │    │
│  │ answer_text: "• Users willing to pay (5 mentions)\n    │    │
│  │               • Users value events (3 mentions)"       │    │
│  │ analysis_summary: "Evidence-based findings"            │    │
│  │ confidence: 0.82                                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                           │                                       │
│                           │ (linked via)                          │
│                           ▼                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │        project_answer_evidence Table                    │    │
│  │  ┌──────────────────────────────────────────────┐      │    │
│  │  │ answer_id: ans-123                            │      │    │
│  │  │ evidence_id: ev-1                             │      │    │
│  │  │ confidence: 0.85                              │      │    │
│  │  │ relationship: "supports"                      │      │    │
│  │  └──────────────────────────────────────────────┘      │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                   │
│  DQ Answer (Strategic Synthesis):                                │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ id: ans-124                                             │    │
│  │ decision_question_id: dq-789                           │    │
│  │ research_question_id: null (no direct RQ)              │    │
│  │ answer_text: "Adopt freemium model..."                 │    │
│  │ analysis_summary: "Strategic insight"                  │    │
│  │ analysis_next_steps: "• Develop free tier\n           │    │
│  │                       • Create premium tier"           │    │
│  │ confidence: 0.78                                        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## UI Display Comparison

### ❌ BEFORE (Duplicate Content)

```
┌─────────────────────────────────────────────────────────────────┐
│ Decision Question: "What monetization model?"                   │
├─────────────────────────────────────────────────────────────────┤
│ • Users are willing to pay for tools                            │
│ • Users value connections at events                             │
│ • Users feel current tools are overpriced                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Research Question: "What features will users pay for?"          │
├─────────────────────────────────────────────────────────────────┤
│ • Users are willing to pay for tools            ❌ DUPLICATE    │
│ • Users value connections at events             ❌ DUPLICATE    │
│ • Users feel current tools are overpriced       ❌ DUPLICATE    │
└─────────────────────────────────────────────────────────────────┘
```

### ✅ AFTER (Proper Hierarchy)

```
┌─────────────────────────────────────────────────────────────────┐
│ Decision Question: "What monetization model?"                   │
├─────────────────────────────────────────────────────────────────┤
│ Strategic Insight:                                               │
│ • Adopt freemium model with premium interview features          │
│                                                                   │
│ Reasoning:                                                        │
│ Research findings show clear willingness to pay for interview   │
│ features, with value perception outweighing cost concerns.      │
│                                                                   │
│ Recommended Actions:                                             │
│ 1. Develop core interview features for free tier                │
│ 2. Create premium tier with advanced assistance                 │
│ 3. Add event networking as premium upsell                       │
│ 4. Price based on value delivery                                │
│                                                                   │
│ [Supporting Research: RQ1, RQ2] ──────────────────────┐         │
└─────────────────────────────────────────────────────────│─────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Research Question: "What features will users pay for?"          │
├─────────────────────────────────────────────────────────────────┤
│ Findings:                                                         │
│ • Users willing to pay for interview tools (5 mentions, high)   │
│ • Users value event connections (3 mentions, medium)            │
│ • Current tools seen as overpriced (4 mentions, high)           │
│                                                                   │
│ [Evidence: 5 quotes] ────────────────────────────────┐          │
└─────────────────────────────────────────────────────────│──────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ Evidence                                                          │
├─────────────────────────────────────────────────────────────────┤
│ "I'd definitely pay for something that helps me run better      │
│ interviews" - Participant A                                      │
│                                                                   │
│ "Price matters less than whether it actually works" - P.B       │
│                                                                   │
│ "Current tools are overpriced for what they do" - P.C           │
└─────────────────────────────────────────────────────────────────┘
```

## Key Differences

| Aspect | Before | After |
|--------|--------|-------|
| **DQ Content** | Raw evidence bullets | Strategic insight + actions |
| **RQ Content** | Same as DQ (duplicate) | Evidence-based findings |
| **Synthesis** | None (copying) | Proper synthesis at each level |
| **Traceability** | Unclear | Clear: DQ → RQ → Evidence |
| **Actionability** | Low | High (specific recommendations) |
| **Reasoning** | Missing | Explicit at each level |

## Benefits Summary

1. ✅ **No Duplication** - Each level has unique, appropriate content
2. ✅ **Clear Purpose** - DQs answer strategic questions, RQs show findings
3. ✅ **Proper Synthesis** - AI synthesizes instead of copying
4. ✅ **Traceability** - Can drill down from decision to evidence
5. ✅ **Actionable** - DQs include specific next steps
6. ✅ **Well-Reasoned** - Explicit reasoning at each level
