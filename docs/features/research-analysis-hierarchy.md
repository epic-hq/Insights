# Research Analysis Hierarchy

## Overview

The research analysis system follows a clear hierarchical structure that prevents duplicate content and ensures proper synthesis from evidence to strategic insights.

## Hierarchy Structure

```
Goal (What we want to achieve)
  ↓
Decision Questions (Strategic decisions to make)
  ↓
Research Questions (Specific questions to answer DQs)
  ↓
Interview Prompts (Actual questions asked in interviews)
  ↓
Evidence (Quotes and observations from interviews)
```

## Three-Phase Analysis Process

### Phase 1: Evidence → Research Questions

**Purpose:** Link raw evidence to specific research questions

**Process:**
- AI analyzes each piece of evidence (verbatim quotes, observations)
- Links evidence ONLY to Research Questions (not Decision Questions)
- Provides relationship (supports/refutes/neutral) and confidence score
- Generates brief summary of what the evidence tells us

**Output Example:**
```typescript
{
  evidence_id: "ev-123",
  links: [{
    question_id: "rq-456",
    question_kind: "research",
    relationship: "supports",
    confidence: 0.85,
    answer_summary: "User mentioned willingness to pay for interview tools",
    rationale: "Quote: 'I'd definitely pay for something that helps me run better interviews'"
  }]
}
```

### Phase 2: Research Question Answers (Evidence-Based Findings)

**Purpose:** Synthesize evidence into specific findings for each research question

**Process:**
- For each Research Question, aggregate all linked evidence
- Generate 2-5 specific, evidence-based findings
- Track which evidence IDs support each finding
- Provide confidence based on evidence strength and agreement
- Explain reasoning connecting evidence to findings

**Output Example:**
```typescript
{
  research_question_id: "rq-456",
  findings: [
    "Users are willing to pay for interview assistance tools (5 mentions across 3 interviews)",
    "Users value connections made at events (3 mentions, medium confidence)",
    "Users feel current tools are overpriced (4 mentions, high confidence)"
  ],
  evidence_ids: ["ev-123", "ev-124", "ev-125"],
  confidence: 0.82,
  reasoning: "Strong evidence from multiple interviews showing consistent willingness to pay for tools that assist with interviews"
}
```

**Key Characteristics:**
- ✅ Specific, evidence-based statements
- ✅ Include mention counts and confidence levels
- ✅ Direct quotes or paraphrased evidence
- ❌ NOT strategic recommendations
- ❌ NOT synthesized insights

### Phase 3: Decision Question Answers (Strategic Synthesis)

**Purpose:** Synthesize research findings into strategic insights that answer business decisions

**Process:**
- For each Decision Question, aggregate findings from its Research Questions
- Generate ONE strategic insight (not a list of evidence)
- Extract key findings that inform this decision
- Track which Research Question IDs contributed
- Provide confidence based on research question coverage
- Explain reasoning connecting research findings to strategic answer
- Recommend 2-4 specific actions

**Output Example:**
```typescript
{
  decision_question_id: "dq-789",
  strategic_insight: "Adopt freemium model with premium interview assistance features",
  supporting_findings: [
    "Users willing to pay for interview tools",
    "Event networking valued but secondary",
    "Price sensitivity exists but value trumps cost"
  ],
  research_question_ids: ["rq-456", "rq-457"],
  confidence: 0.78,
  reasoning: "Research findings show clear willingness to pay for interview features, with value perception outweighing cost concerns. Event features can serve as upsell opportunities.",
  recommended_actions: [
    "Develop core interview features for free tier",
    "Create premium tier with advanced interview assistance",
    "Add event networking as premium upsell",
    "Price based on value delivery, not cost savings"
  ]
}
```

**Key Characteristics:**
- ✅ High-level strategic answer
- ✅ Synthesized from research findings (not raw evidence)
- ✅ Actionable recommendations
- ✅ Business-focused language
- ❌ NOT raw evidence quotes
- ❌ NOT just a list of findings

## Data Flow

```typescript
// 1. Evidence linked to Research Questions
Evidence → RQ Links (with confidence, relationship)

// 2. Research Questions answered with findings
RQ + Evidence → RQ Answers (findings, evidence_ids, reasoning)

// 3. Decision Questions answered with strategic insights
DQ + RQ Answers → DQ Answers (strategic_insight, supporting_findings, actions)
```

## Database Storage

### project_answers Table

Stores both RQ and DQ answers with proper hierarchy:

```typescript
// Research Question Answer
{
  id: "ans-123",
  project_id: "proj-1",
  research_question_id: "rq-456",
  decision_question_id: "dq-789", // Parent DQ
  question_text: "What features are users willing to pay for?",
  answer_text: "• Users are willing to pay for interview tools (5 mentions)\n• Users value event connections (3 mentions)",
  analysis_summary: "Specific findings from evidence",
  analysis_rationale: "Evidence-based reasoning",
  confidence: 0.82,
  origin: "analysis"
}

// Decision Question Answer
{
  id: "ans-124",
  project_id: "proj-1",
  decision_question_id: "dq-789",
  research_question_id: null, // No direct RQ
  question_text: "What monetization model should we adopt?",
  answer_text: "Adopt freemium model with premium interview features",
  analysis_summary: "Strategic insight synthesized from research",
  analysis_rationale: "How research findings lead to this decision",
  analysis_next_steps: "• Develop core features\n• Create premium tier",
  confidence: 0.78,
  origin: "analysis"
}
```

### project_answer_evidence Table

Links evidence to answers (RQ answers only):

```typescript
{
  project_id: "proj-1",
  answer_id: "ans-123", // RQ answer
  evidence_id: "ev-123",
  relationship: "supports",
  confidence: 0.85,
  payload: {
    run_id: "run-1",
    rationale: "Direct quote about willingness to pay"
  }
}
```

## UI Display

### Decision Questions Section

Shows strategic insights with supporting research:

```
Decision Question: "What monetization model should we adopt?"

Strategic Insight:
• Adopt freemium model with premium interview assistance features

Reasoning:
Research findings show clear willingness to pay for interview features, with 
value perception outweighing cost concerns. Event features can serve as upsell.

Recommended Actions:
1. Develop core interview features for free tier
2. Create premium tier with advanced interview assistance
3. Add event networking as premium upsell
4. Price based on value delivery, not cost savings

Supporting Research: (Links to RQ answers)
```

### Research Questions Section

Shows evidence-based findings:

```
Research Question: "What features are users willing to pay for?"

Findings:
• Users are willing to pay for interview assistance tools (5 mentions, high confidence)
• Users value connections made at events (3 mentions, medium confidence)
• Users feel current tools are overpriced (4 mentions, high confidence)

Evidence: (Links to specific quotes)
```

## Benefits

1. **No Duplicate Content:** DQs show strategic insights, RQs show evidence-based findings
2. **Clear Hierarchy:** Evidence → RQ Findings → DQ Insights → Actions
3. **Proper Synthesis:** AI synthesizes at each level instead of copying
4. **Traceability:** Can trace from strategic decision → research findings → raw evidence
5. **Actionable:** DQ answers include specific recommended actions
6. **Evidence-Based:** RQ answers show specific evidence support

## Implementation Files

- **BAML Schema:** `/baml_src/research_analysis.baml`
  - `ResearchQuestionAnswer` class
  - `DecisionQuestionAnswer` class
  - `LinkEvidenceToResearchStructure` function with 3-phase instructions

- **TypeScript Logic:** `/app/features/research/analysis/runEvidenceAnalysis.server.ts`
  - Processes BAML response
  - Creates proper answer hierarchy
  - Stores in database with correct relationships

- **API Route:** `/app/routes/api.analyze-research-evidence.tsx`
  - Triggers analysis
  - Returns hierarchical results

## Example Complete Flow

**Goal:** "Identify monetization model for meeting place app"

**Decision Question:** "What monetization model should we adopt?"

**Research Questions:**
1. "What features are users willing to pay for?"
2. "How do users perceive value vs. cost?"

**Interview Prompts:**
1. "Tell me about tools you currently pay for..."
2. "What would make you willing to pay for this app?"

**Evidence (from interviews):**
- "I'd definitely pay for something that helps me run better interviews" (supports RQ1)
- "Price matters less than whether it actually works" (supports RQ2)
- "Current tools are overpriced for what they do" (refutes RQ2)

**RQ1 Answer (Evidence-Based):**
- Findings: "Users willing to pay for interview tools (5 mentions)"
- Evidence IDs: [ev-1, ev-2, ev-3]
- Confidence: 0.85

**DQ Answer (Strategic Synthesis):**
- Insight: "Adopt freemium model with premium interview features"
- Supporting Findings: ["Users willing to pay for interview tools", "Value trumps cost"]
- Actions: ["Develop free tier", "Create premium tier", "Price on value"]
- Confidence: 0.78

This creates a clear, non-duplicative hierarchy from raw evidence to strategic decisions.
