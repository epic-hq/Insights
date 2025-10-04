# Research Analysis Quick Reference

## TL;DR

The research analysis system now properly synthesizes insights in a hierarchy:
- **Evidence** → **RQ Findings** → **DQ Strategic Insights** → **Actions**
- No more duplicate content between Decision Questions and Research Questions
- Each level has appropriate content for its purpose

## What Changed?

### Before ❌
```
DQ: "What monetization model?"
• Users willing to pay for tools
• Users value event connections

RQ: "What features will users pay for?"
• Users willing to pay for tools        ← DUPLICATE
• Users value event connections         ← DUPLICATE
```

### After ✅
```
DQ: "What monetization model?"
Strategic Insight: "Adopt freemium model with premium interview features"
Actions: [Develop free tier, Create premium tier, Add event upsell]

RQ: "What features will users pay for?"
Findings: "Users willing to pay for interview tools (5 mentions, high confidence)"
Evidence: [Links to 5 specific quotes]
```

## Three Levels of Content

### 1. Evidence (Raw Data)
- **What:** Verbatim quotes and observations from interviews
- **Example:** "I'd definitely pay for something that helps me run better interviews"
- **Purpose:** Raw data to support findings

### 2. Research Question Answers (Evidence-Based Findings)
- **What:** Specific findings synthesized from evidence
- **Example:** "Users willing to pay for interview tools (5 mentions across 3 interviews)"
- **Purpose:** Answer specific research questions with evidence support
- **Characteristics:**
  - Include mention counts
  - Show confidence levels
  - Reference evidence
  - Specific, not strategic

### 3. Decision Question Answers (Strategic Insights)
- **What:** High-level strategic answers synthesized from RQ findings
- **Example:** "Adopt freemium model with premium interview features"
- **Purpose:** Answer business decisions with actionable recommendations
- **Characteristics:**
  - ONE strategic insight (not a list)
  - Synthesized from research findings
  - Include recommended actions
  - Business-focused language

## Content Guidelines

### ✅ Good RQ Answer (Evidence-Based)
```
Findings:
• Users willing to pay for interview assistance tools (5 mentions, high confidence)
• Price sensitivity exists but value trumps cost (4 mentions, medium confidence)
• Event networking valued as secondary benefit (3 mentions, medium confidence)

Evidence: [ev-1, ev-2, ev-3, ev-4, ev-5]
Reasoning: "Strong evidence from multiple interviews showing consistent willingness 
to pay for tools that assist with interviews, with value perception outweighing 
cost concerns."
```

### ✅ Good DQ Answer (Strategic Synthesis)
```
Strategic Insight:
"Adopt freemium model with premium interview assistance features"

Supporting Findings:
• Users willing to pay for interview tools
• Value perception trumps cost concerns
• Event networking valued but secondary

Recommended Actions:
1. Develop core interview features for free tier
2. Create premium tier with advanced interview assistance
3. Add event networking as premium upsell
4. Price based on value delivery, not cost savings

Reasoning: "Research findings show clear willingness to pay for interview features, 
with value perception outweighing cost concerns. Event features can serve as upsell 
opportunities rather than core offering."
```

### ❌ Bad DQ Answer (Just Listing Evidence)
```
• Users mentioned they would pay for tools
• Some users talked about events
• Price was mentioned several times
```
**Why bad:** This is just listing evidence, not providing strategic insight

### ❌ Bad RQ Answer (Too Strategic)
```
Findings:
• We should adopt a freemium model
• Premium features should focus on interviews
```
**Why bad:** This is strategic recommendation (DQ-level), not evidence-based findings

## Data Flow

```
Interview → Evidence → RQ Answer → DQ Answer → Goal Achievement
   ↓           ↓           ↓            ↓
 Quotes    Findings   Strategic    Actions
                       Insight
```

## API Usage

### Trigger Analysis
```typescript
const formData = new FormData()
formData.append("projectId", projectId)
formData.append("customInstructions", "Focus on monetization insights")
formData.append("minConfidence", "0.6")

const response = await fetch("/api/analyze-research-evidence", {
  method: "POST",
  body: formData
})
```

### Response Structure
```typescript
{
  success: true,
  runId: "run-123",
  globalGoalSummary: "Overall progress toward research goal",
  recommendedActions: ["Action 1", "Action 2"],
  summary: {
    evidenceAnalyzed: 25,
    evidenceLinked: 20,
    answersCreated: 8,
    answersUpdated: 2
  },
  questionSummaries: [
    {
      question_id: "rq-456",
      question_kind: "research",
      confidence: 0.82,
      summary: "• Finding 1\n• Finding 2"
    },
    {
      question_id: "dq-789",
      question_kind: "decision",
      confidence: 0.78,
      summary: "Strategic insight here",
      next_steps: "• Action 1\n• Action 2"
    }
  ]
}
```

## Database Schema

### project_answers Table
```sql
-- RQ Answer
INSERT INTO project_answers (
  project_id,
  research_question_id,
  decision_question_id,  -- Parent DQ
  answer_text,           -- Evidence-based findings
  analysis_summary,
  confidence,
  origin
) VALUES (
  'proj-1',
  'rq-456',
  'dq-789',
  '• Users willing to pay (5 mentions)',
  'Evidence-based findings',
  0.82,
  'analysis'
);

-- DQ Answer
INSERT INTO project_answers (
  project_id,
  decision_question_id,
  answer_text,           -- Strategic insight
  analysis_summary,
  analysis_next_steps,   -- Recommended actions
  confidence,
  origin
) VALUES (
  'proj-1',
  'dq-789',
  'Adopt freemium model with premium features',
  'Strategic insight synthesized from research',
  '• Develop free tier\n• Create premium tier',
  0.78,
  'analysis'
);
```

### project_answer_evidence Table
```sql
-- Links evidence to RQ answers only
INSERT INTO project_answer_evidence (
  project_id,
  answer_id,    -- RQ answer ID
  evidence_id,
  relationship,
  confidence,
  payload
) VALUES (
  'proj-1',
  'ans-123',
  'ev-1',
  'supports',
  0.85,
  '{"run_id": "run-1", "rationale": "Direct quote about willingness to pay"}'
);
```

## Common Questions

### Q: Why can't evidence link directly to Decision Questions?
**A:** Evidence is too granular for strategic decisions. It must first be synthesized into findings (RQ level), then those findings inform strategic insights (DQ level).

### Q: What if I have evidence that seems to answer a DQ directly?
**A:** Link it to the relevant RQ first. The AI will then synthesize that RQ finding into the DQ answer.

### Q: How do I know if my DQ answer is good?
**A:** Ask: "Is this a strategic insight or just a list of evidence?" Good DQ answers provide ONE clear strategic direction with actionable steps.

### Q: Can one piece of evidence support multiple RQs?
**A:** Yes! Evidence can link to multiple RQs with different confidence levels and relationships.

### Q: What confidence threshold should I use?
**A:** Default is 0.6 (60%). Increase for higher quality but fewer links, decrease for more coverage but lower confidence.

## Troubleshooting

### Issue: DQ and RQ showing same content
**Solution:** Check if AI is properly synthesizing. DQs should have strategic insights, not evidence bullets.

### Issue: No DQ answers generated
**Solution:** Ensure RQs are properly linked to DQs via `decision_question_id` field.

### Issue: Low confidence scores
**Solution:** May need more evidence or clearer research questions. Review evidence quality and RQ specificity.

### Issue: Missing evidence links
**Solution:** Check `minConfidence` threshold. Lower it to see more links, or improve evidence quality.

## Best Practices

1. **Write Clear Research Questions** - Specific RQs lead to better evidence matching
2. **Link RQs to DQs** - Ensure every RQ has a `decision_question_id`
3. **Quality Evidence** - Rich, detailed quotes produce better findings
4. **Review AI Output** - Check that synthesis is appropriate for each level
5. **Iterate** - Use custom instructions to guide AI toward better synthesis

## Files to Reference

- **Full Documentation:** `/docs/features/research-analysis-hierarchy.md`
- **Visual Diagrams:** `/docs/diagrams/research-analysis-flow.md`
- **Implementation:** `/app/features/research/analysis/runEvidenceAnalysis.server.ts`
- **BAML Schema:** `/baml_src/research_analysis.baml`

## Quick Commands

```bash
# Regenerate BAML client after schema changes
pnpm run baml-generate

# Run development server
pnpm run dev

# Test analysis API
curl -X POST http://localhost:5173/api/analyze-research-evidence \
  -F "projectId=your-project-id" \
  -F "minConfidence=0.6"
```
