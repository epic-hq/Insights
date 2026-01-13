# Processing Tier Selection - PRD

> **Status:** Planned | **Estimated:** 3-4 days
> **Created:** January 2026
> **Related:** [LLM Cost Analysis](../../../70-roadmap/llm-cost-analysis-2025-01.md)

## Problem Statement

Interview processing currently takes **12+ minutes** using GPT-5 for evidence extraction. This creates:

1. **Poor UX** - Users wait too long for results
2. **High costs** - GPT-5 is ~20x more expensive than GPT-4o
3. **No user control** - One-size-fits-all approach doesn't match varied use cases

### Current State

| Metric | Value |
|--------|-------|
| Processing time | 12-15 minutes |
| Cost per interview | $1.06-$2.15 |
| Model used | GPT-5 (always) |
| User control | None |

### Target State

| Metric | Standard Tier | Enhanced Tier |
|--------|---------------|---------------|
| Processing time | 5-7 minutes | 12-15 minutes |
| Cost per interview | $0.30-$0.65 | $1.06-$2.15 |
| Model used | GPT-4o | GPT-5 |
| Credits consumed | 1 credit | 3 credits |

---

## User Stories

### Primary User Story

> As a researcher uploading an interview, I want to choose between fast processing and enhanced analysis, so I can balance speed vs. quality based on my needs.

### Secondary User Stories

1. **As a sales team member**, I want quick processing for call recordings so I can review them the same day.
2. **As a UX researcher**, I want enhanced analysis for critical research interviews so I don't miss subtle behavioral signals.
3. **As an account admin**, I want to see credit usage per processing tier so I can manage team costs.

---

## Feature Requirements

### Must Have (MVP)

- [ ] **Processing tier selection at upload time** - Toggle between Standard/Enhanced
- [ ] **Default to Standard** - Faster, cheaper option is the default
- [ ] **Credit consumption tracking** - 1 credit (Standard) vs 3 credits (Enhanced)
- [ ] **Tier indicator on interview** - Show which tier was used after processing
- [ ] **Model routing in pipeline** - Route to GPT-4o or GPT-5 based on selection

### Should Have (v1.1)

- [ ] **Project-level default** - Set default tier per project
- [ ] **Re-process option** - Upgrade existing interview to Enhanced tier
- [ ] **Usage dashboard** - View credit consumption by tier
- [ ] **Tier comparison tooltip** - Explain differences in UI

### Could Have (Future)

- [ ] **Auto-tier selection** - Recommend tier based on interview characteristics
- [ ] **Tier-specific pricing** - Different subscription tiers get different defaults
- [ ] **Batch tier selection** - Apply tier to multiple uploads at once

---

## UX Design

### Upload Flow - Tier Selection

```
┌─────────────────────────────────────────────────────────┐
│  Upload Interview                                        │
│                                                          │
│  [Drop file here or click to browse]                    │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  Processing Mode                                         │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ ● Standard                              1 credit    ││
│  │   Fast processing (5-7 min)                         ││
│  │   Good for sales calls, quick reviews               ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ ○ Enhanced                              3 credits   ││
│  │   Deep analysis (12-15 min)                         ││
│  │   Better for research interviews, complex topics    ││
│  │   • More accurate speaker attribution               ││
│  │   • Deeper behavioral signal extraction             ││
│  │   • Recommended for 3+ participants                 ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│                                    [Upload & Process]   │
└─────────────────────────────────────────────────────────┘
```

### Interview Detail - Tier Badge

```
┌─────────────────────────────────────────────────────────┐
│  Interview with Jane Doe                                │
│  📅 Jan 10, 2026 · 32 min · [Standard ⚡]              │
│                                                          │
│  [Upgrade to Enhanced] ← Only shown for Standard tier   │
└─────────────────────────────────────────────────────────┘
```

### Upgrade Confirmation Modal

```
┌─────────────────────────────────────────────────────────┐
│  Upgrade to Enhanced Analysis?                          │
│                                                          │
│  This will re-process the interview with deeper         │
│  analysis. Your existing insights will be preserved     │
│  and enhanced.                                          │
│                                                          │
│  ⏱️ Processing time: ~12-15 minutes                     │
│  💳 Additional cost: 2 credits                          │
│                                                          │
│                        [Cancel]  [Upgrade (+2 credits)] │
└─────────────────────────────────────────────────────────┘
```

---

## Quality Tradeoffs

### What Enhanced Tier Provides

| Capability | Standard (GPT-4o) | Enhanced (GPT-5) |
|------------|-------------------|------------------|
| Structured output validity | 95% | 98% |
| Facet extraction recall | 80% | 90% |
| Timestamp accuracy | 85% | 95% |
| Speaker attribution | 90% | 95% |
| Empathy map depth | Adequate | Rich |

### When to Recommend Enhanced

- Complex multi-speaker interviews (3+ participants)
- Long interviews (60+ minutes)
- Research-critical conversations
- Technical/domain-specific topics
- Enterprise tier accounts

### When Standard is Sufficient

- Sales calls and demos
- Support conversations
- Quick feedback sessions
- Short interviews (<30 min)
- High-volume processing needs

---

## Success Metrics

### Primary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Standard tier adoption | 70%+ | % of uploads using Standard |
| Average processing time | <7 min | Mean time for Standard tier |
| Cost per interview | <$0.50 | Average across all tiers |
| User satisfaction | No decrease | NPS/CSAT scores |

### Secondary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Upgrade rate | 10-20% | % of Standard → Enhanced upgrades |
| Re-process requests | <5% | % of users requesting re-analysis |
| Support tickets | No increase | Tier-related support volume |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Quality complaints on Standard | High | Clear expectation setting in UI; easy upgrade path |
| Decision fatigue | Medium | Smart defaults; minimal UI complexity |
| Credit confusion | Medium | Clear credit display; usage dashboard |
| Upgrade abuse | Low | Rate limit re-processing; credit cost |

---

## Out of Scope

- Automatic tier selection based on content analysis
- Per-question or per-section tier selection
- Tier selection for non-interview content (assets, documents)
- Custom model selection beyond Standard/Enhanced
- Tier-based pricing changes (handled separately)

---

## Dependencies

- **Usage tracking system** - Must track credits consumed per tier
- **BAML client routing** - Ability to select model at runtime
- **Trigger.dev task updates** - Pass tier through orchestrator

---

## Related Documents

- [LLM Cost Analysis Report](../../../70-roadmap/llm-cost-analysis-2025-01.md)
- [Interview Processing Architecture](../../../10-architecture/interview-processing/)
- [Usage-Based Billing Plan](../../../70-roadmap/) (pending)
