# Question-Grouped Analysis

*Feature Spec: High Priority*
*Source: Looppanel competitive analysis*

## Overview

Instead of viewing lens analyses grouped by interview (current), enable a view that groups responses by interview question across all interviews. This enables instant cross-interview pattern detection.

## Why This Matters

From Looppanel's approach:
> "Question-Grouped Analysis: All notes organized by interview question (brilliant)"

**User Problem**: When analyzing 10+ interviews, finding patterns requires mentally correlating responses across separate interview views. This is slow and error-prone.

**Solution**: Show all answers to each question together, with AI-identified patterns.

## Current State

**File**: `app/features/lenses/pages/aggregated-generic.tsx`

Currently renders:
```
├── Interview 1 Card
│   └── GenericLensView (all sections)
├── Interview 2 Card
│   └── GenericLensView (all sections)
└── Interview 3 Card
    └── GenericLensView (all sections)
```

For Q&A lenses specifically (`qa-summary` template), each interview has:
- `qa_pairs[]` array with `question`, `answer`, `topic`, `confidence`
- `unanswered_questions[]`
- `key_takeaways[]`

## Proposed Design

### View Toggle

Add toggle at top of aggregated view:

```
┌────────────────────────────────────────────────┐
│  [By Interview ▼] [By Question]                │
└────────────────────────────────────────────────┘
```

### Question-Grouped Layout

```
┌─────────────────────────────────────────────────────┐
│ Q: What's your biggest challenge?                   │
│ ─────────────────────────────────────────────────── │
│ ┌─ Interview 1 (Sarah, VP Eng) ───────────────────┐ │
│ │ "Scaling our team while maintaining quality..."  │ │
│ │ [2:34] View in interview →                       │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌─ Interview 2 (Marcus, CTO) ─────────────────────┐ │
│ │ "Integration complexity with legacy systems..." │ │
│ │ [4:12] View in interview →                       │ │
│ └──────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ AI Pattern ─────────────────────────────────────┐ │
│ │ 🔍 Scaling concerns appear in 8/10 interviews.   │ │
│ │    Technical debt is a common sub-theme.         │ │
│ └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Question Matching Challenge

Interview questions aren't always asked identically. Need to:
1. **Normalize questions** - Group similar questions together
2. **Use topic tags** - Q&A lens already extracts `topic` field
3. **AI clustering** - Group by semantic similarity

**Approach**: Start with exact question matching + topic grouping. Add AI clustering later.

## Implementation Plan

### Phase 1: Basic Question Grouping

1. **Add view toggle** to `aggregated-generic.tsx`
2. **Extract all Q&A pairs** across interviews
3. **Group by exact question text** (or topic)
4. **Render grouped view** with interview attribution

```tsx
// Pseudo-code for grouping
const groupByQuestion = (analyses: AggregatedAnalysis[]) => {
  const grouped = new Map<string, {
    question: string;
    topic: string;
    answers: Array<{
      interviewId: string;
      interviewTitle: string;
      participant: string;
      answer: string;
      evidenceIds: string[];
    }>;
  }>();

  for (const analysis of analyses) {
    const qaPairs = analysis.analysis_data.qa_pairs || [];
    for (const pair of qaPairs) {
      const key = pair.topic || pair.question;
      // ... group by key
    }
  }

  return grouped;
};
```

### Phase 2: AI Pattern Detection

1. **Add pattern analysis** to synthesis task
2. **Per-question patterns** in addition to overall synthesis
3. **Discrepancy detection** - flag contradicting answers

### Phase 3: Semantic Clustering

1. **Embed questions** using embeddings API
2. **Cluster similar questions** even if worded differently
3. **Smart grouping** for interviews with different question sets

## Technical Considerations

### Template Compatibility

This feature works best with:
- `qa-summary` lens (has structured Q&A pairs)
- Custom lenses with question/answer fields

For non-Q&A lenses, fall back to interview-grouped view.

### Performance

With 50+ interviews:
- Lazy load answers per question
- Virtualize long lists
- Cache grouped data

### Traceability

Every answer must link to:
- Source interview
- Timestamp in transcript
- Evidence ID for playback

## Success Metrics

1. **Time to find patterns** - Should be 10x faster than scrolling interviews
2. **Pattern accuracy** - AI-identified patterns validated by users
3. **Feature adoption** - % of aggregated views using question-grouped mode

## Files to Modify

| File | Change |
|------|--------|
| `app/features/lenses/pages/aggregated-generic.tsx` | Add view toggle, grouped rendering |
| `app/features/lenses/components/QuestionGroupedView.tsx` | New component |
| `src/trigger/lens/synthesizeLensSummary.ts` | Add per-question patterns |

## Priority

**HIGH** - This is a key competitive differentiator from analysis-only tools.

---

*Created: 2025-01-02*
*Status: Planned*
