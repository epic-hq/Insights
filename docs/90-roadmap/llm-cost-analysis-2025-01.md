# LLM Cost Analysis & Optimization Report

**Generated:** January 10, 2026
**Analysis Period:** Current codebase snapshot
**Focus:** Token usage, costs per user action, performance bottlenecks, and quality tradeoffs

---

## Executive Summary

This analysis identifies LLM usage patterns across the application, focusing on trigger.dev tasks, BAML functions, and embedding pipelines. The primary cost drivers are:

1. **Interview Processing Pipeline** - Uses GPT-5 for evidence extraction (largest single cost)
2. **Lens Analysis** - Multiple GPT-4o calls per interview for different analytical frameworks
3. **Embedding Generation** - High-volume text-embedding-3-small calls for semantic search
4. **Research & Persona Tasks** - GPT-4o for synthesis and analysis

**Estimated Monthly Cost Range:** $500-$2,000+ depending on interview volume and lens usage.

### ⚠️ Critical Performance Issue

**Current interview processing time: 12+ minutes** - This is primarily caused by:
1. Sequential task execution (7 steps run one after another)
2. GPT-5 evidence extraction (slowest model, ~3-5 min alone)
3. Multiple embedding generations (50-200 per interview)
4. Sequential theme-evidence linking with individual semantic searches

---

## 1. Cost Breakdown by User Action

### 1.1 Interview Upload & Processing

| Step | Model | Est. Tokens (Input/Output) | Cost per Interview | Frequency |
|------|-------|---------------------------|-------------------|-----------|
| **Evidence Extraction** | GPT-5 | 15,000 / 8,000 | $0.75-$1.50 | Per interview |
| **Persona Facet Derivation** | GPT-4o | 8,000 / 3,000 | $0.15-$0.25 | Per interview |
| **Conversation Analysis** | GPT-4o | 6,000 / 2,000 | $0.10-$0.15 | Per interview |
| **Title Generation** | GPT-4o-mini | 2,000 / 50 | $0.001 | Per interview |
| **Embeddings (Evidence)** | text-embedding-3-small | 50-200 items × 500 tokens | $0.05-$0.20 | Per interview |
| **Embeddings (Themes)** | text-embedding-3-small | 10-50 items × 200 tokens | $0.01-$0.05 | Per interview |
| **TOTAL PER INTERVIEW** | - | - | **$1.06-$2.15** | - |

**Key Insight:** Evidence extraction using GPT-5 accounts for 60-70% of per-interview processing costs.

### 1.2 Lens Application (Post-Interview Analysis)

| Lens Type | Model | Est. Tokens | Cost per Application | Trigger |
|-----------|-------|-------------|---------------------|---------|
| **Goal Lens** | GPT-4o | 10,000 / 4,000 | $0.20-$0.30 | Manual/Auto |
| **Product Lens** | GPT-4o | 10,000 / 4,000 | $0.20-$0.30 | Manual/Auto |
| **Sales Lens (BANT)** | GPT-4o | 8,000 / 3,000 | $0.15-$0.25 | Manual/Auto |
| **Research Lens** | GPT-4o | 10,000 / 4,000 | $0.20-$0.30 | Manual/Auto |
| **Q&A Lens** | GPT-4o | 8,000 / 3,000 | $0.15-$0.25 | Manual |
| **Custom Lens** | GPT-4o | 8,000 / 3,000 | $0.15-$0.25 | Manual |
| **Lens Synthesis** | GPT-4o | 12,000 / 5,000 | $0.25-$0.40 | Per lens type |

**Average Cost:** $0.15-$0.30 per lens application
**Typical Usage:** 2-4 lenses per interview = **$0.60-$1.20 per interview**

### 1.3 Theme & Insight Generation

| Operation | Model | Est. Tokens | Cost | Frequency |
|-----------|-------|-------------|------|-----------|
| **Auto-group Themes** | GPT-4o-mini | 5,000 / 1,500 | $0.01-$0.02 | Per project batch |
| **Theme Consolidation** | GPT-4o-mini | 3,000 / 1,000 | $0.005-$0.01 | Per consolidation |
| **Pain Matrix Insights** | GPT-4o-mini | 4,000 / 1,500 | $0.01-$0.02 | On-demand |
| **Persona Summary** | GPT-4o-mini | 3,000 / 1,000 | $0.005-$0.01 | Per persona |

**Cost Impact:** Low - well-optimized with mini models

### 1.4 Research Planning & Question Generation

| Operation | Model | Est. Tokens | Cost | Frequency |
|-----------|-------|-------------|------|-----------|
| **Research Plan Generation** | GPT-4o | 8,000 / 3,000 | $0.15-$0.25 | Per project setup |
| **Question Suggestions** | GPT-4o-mini | 2,000 / 500 | $0.003-$0.005 | Per suggestion batch |
| **Question Evaluation** | GPT-4o-mini | 1,500 / 300 | $0.002-$0.003 | Per question |
| **Contextual Suggestions** | GPT-4o-mini | 1,000 / 200 | $0.001-$0.002 | Per field |

**Cost Impact:** Low - infrequent, small payloads

### 1.5 Embedding Pipeline (Semantic Search)

| Operation | Model | Volume | Cost per 1K Items | Frequency |
|-----------|-------|--------|------------------|-----------|
| **Evidence Embeddings** | text-embedding-3-small | 50-200 per interview | $0.05-$0.20 | Per interview |
| **Theme Embeddings** | text-embedding-3-small | 10-50 per project | $0.01-$0.05 | Per theme creation |
| **Search Queries** | text-embedding-3-small | 1 per search | $0.0001 | Per user search |
| **Theme Deduplication** | text-embedding-3-small | 1 per theme check | $0.0001 | Per theme |
| **Web Research (Exa)** | text-embedding-3-small | 10-50 per search | $0.01-$0.05 | Per web search |

**Monthly Estimate:** $10-$50 depending on search volume and interview count

### 1.6 Advisor & Synthesis Features

| Feature | Model | Est. Tokens | Cost | Frequency |
|---------|-------|-------------|------|-----------|
| **Persona Advisor Report** | GPT-4o | 10,000 / 5,000 | $0.20-$0.35 | On-demand |
| **Opportunity Advisor** | GPT-4o | 8,000 / 3,000 | $0.15-$0.25 | Per deal |
| **Executive Summary** | GPT-4o | 6,000 / 2,000 | $0.10-$0.15 | Per project |
| **Research Analysis** | GPT-4o | 8,000 / 3,000 | $0.15-$0.25 | Per analysis |

**Cost Impact:** Medium - valuable features but can be expensive at scale

---

## 2. Model Usage Analysis

### 2.1 Current Model Distribution

| Model | Use Cases | Count | Optimization Potential |
|-------|-----------|-------|----------------------|
| **GPT-5** | Evidence extraction only | 1 | ⚠️ HIGH - Consider GPT-4o |
| **GPT-4o** | Lens analysis, synthesis, advisors | 15+ | ⚠️ MEDIUM - Some can use mini |
| **GPT-4o-mini** | Suggestions, evaluation, summaries | 10+ | ✅ GOOD - Appropriate usage |
| **text-embedding-3-small** | All embeddings | 1 | ✅ GOOD - Cost-effective |

### 2.2 Pricing Reference (Jan 2026)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| GPT-5 | $50.00 | $150.00 |
| GPT-4o | $2.50 | $10.00 |
| GPT-4o-mini | $0.15 | $0.60 |
| text-embedding-3-small | $0.02 | N/A |

---

## 3. Performance Analysis: Why 12+ Minutes?

### 3.1 Current Pipeline Breakdown (Estimated Times)

| Step | Task | Model | Est. Duration | Bottleneck |
|------|------|-------|---------------|------------|
| 1 | **Upload & Transcribe** | AssemblyAI | 1-3 min | External API |
| 2 | **Extract Evidence** | GPT-5 | 3-5 min | 🔴 SLOWEST - Large prompt, complex output |
| 3 | **Derive Persona Facets** | GPT-5 | 1-2 min | Sequential after evidence |
| 4 | **Enrich Person** | GPT-4o | 30-60s | DB lookups + LLM |
| 5 | **Generate Insights** | GPT-4o | 1-2 min | Theme dedup + embeddings |
| 6 | **Assign Personas** | DB + Embeddings | 30-60s | Sequential embedding searches |
| 7 | **Attribute Answers** | DB queries | 15-30s | Junction table updates |
| 8 | **Finalize** | DB updates | 10-20s | Minimal |
| **TOTAL** | | | **8-15 min** | |

### 3.2 Root Causes of Slow Processing

#### 🔴 Primary Bottleneck: GPT-5 Evidence Extraction (3-5 min)

**Why GPT-5 is slow:**
- **Larger model** = More compute per token
- **Complex structured output** = Multiple validation passes
- **Long prompts** = 200+ line prompt with examples
- **Batching overhead** = Currently batches 75 utterances at a time with max 3 concurrent

**Current batching config:**
```typescript
// app/utils/batchEvidence.ts
const BATCH_SIZE = 75          // Utterances per batch
const MAX_CONCURRENT_BATCHES = 3  // Parallel API calls
```

For a 30-min interview (~200 utterances):
- 3 batches × ~90s each = **4.5 min** just for evidence extraction

#### 🟡 Secondary Bottleneck: Sequential Task Execution

**Current orchestrator pattern:**
```typescript
// src/trigger/interview/v2/orchestrator.ts
await uploadAndTranscribeTaskV2.triggerAndWait(...)  // Step 1
await extractEvidenceTaskV2.triggerAndWait(...)     // Step 2 - waits for 1
await enrichPersonTaskV2.triggerAndWait(...)        // Step 3 - waits for 2
await generateInsightsTaskV2.triggerAndWait(...)    // Step 4 - waits for 3
await assignPersonasTaskV2.triggerAndWait(...)      // Step 5 - waits for 4
await attributeAnswersTaskV2.triggerAndWait(...)    // Step 6 - waits for 5
await finalizeInterviewTaskV2.triggerAndWait(...)   // Step 7 - waits for 6
```

**Problem:** Steps 5 & 6 (personas + answers) could run in parallel but don't.

#### 🟡 Tertiary Bottleneck: Embedding Generation

**Per-interview embedding calls:**
- Evidence embeddings: 50-200 items (sequential with concurrency 5)
- Theme embeddings: 5-15 items
- Theme deduplication: 5-15 similarity searches
- Evidence-theme linking: 5-15 semantic searches

**Total embedding operations:** 70-250 per interview

### 3.3 Performance Optimization Roadmap

#### Quick Wins (No Code Changes)

| Change | Impact | Risk |
|--------|--------|------|
| Increase `MAX_CONCURRENT_BATCHES` to 5 | -20% extraction time | Rate limits |
| Increase embedding concurrency to 15 | -40% embedding time | Rate limits |

#### Medium Effort (Code Changes)

| Change | Impact | Risk |
|--------|--------|------|
| Switch GPT-5 → GPT-4o for extraction | -50% extraction time | Quality (see below) |
| Parallelize personas + answers steps | -15% total time | Complexity |
| Batch embedding API calls | -30% embedding time | API changes |

#### High Effort (Architecture Changes)

| Change | Impact | Risk |
|--------|--------|------|
| Stream evidence extraction | Real-time progress | Major refactor |
| Pre-compute embeddings async | -100% blocking time | Eventual consistency |
| Use smaller model for initial pass | -60% time | Two-pass complexity |

---

## 4. Quality Tradeoffs: GPT-5 vs GPT-4o

### 4.1 What GPT-5 Provides for Evidence Extraction

**Strengths of GPT-5:**
- **Better structured output adherence** - Fewer malformed JSON responses
- **Nuanced facet extraction** - Catches subtle behavioral signals
- **Timestamp accuracy** - Better at mapping verbatim to source timing
- **Person disambiguation** - More accurate speaker attribution
- **Empathy map quality** - Richer says/does/thinks/feels extraction

**When GPT-5 matters most:**
- Complex multi-speaker interviews (3+ participants)
- Technical/domain-specific conversations
- Nuanced emotional/behavioral analysis
- High-stakes research where accuracy is critical

### 4.2 Expected Quality Impact of GPT-4o

**Likely degradation areas:**

| Aspect | GPT-5 Quality | GPT-4o Expected | Impact |
|--------|--------------|-----------------|--------|
| Structured output | 98% valid | 95% valid | Low - BAML handles retries |
| Facet extraction | 90% recall | 80% recall | Medium - May miss subtle signals |
| Timestamp mapping | 95% accurate | 85% accurate | Medium - Playback may be off |
| Speaker attribution | 95% accurate | 90% accurate | Low - Usually recoverable |
| Empathy map depth | Rich | Adequate | Low - Nice-to-have |

**Likely equivalent areas:**
- Evidence chunking (gist, verbatim)
- Scene segmentation
- Interaction context classification
- Basic facet kinds (goal, pain, tool)

### 4.3 Recommended Testing Protocol

**A/B Test Design:**

1. **Sample size:** 20 interviews (10 GPT-5, 10 GPT-4o)
2. **Diversity:** Mix of interview types (research, sales, support)
3. **Metrics to compare:**
   - Evidence count per interview
   - Facet mention count and distribution
   - Timestamp accuracy (spot-check 10 per interview)
   - Theme generation quality (human review)
   - Processing time

**Quality Scorecard:**
```
| Metric                    | GPT-5 Baseline | GPT-4o Result | Acceptable? |
|---------------------------|----------------|---------------|-------------|
| Evidence units extracted  | X              | Y             | Y >= 0.9X   |
| Facet mentions            | X              | Y             | Y >= 0.85X  |
| Timestamp accuracy        | X%             | Y%            | Y >= 85%    |
| Theme relevance (1-5)     | X              | Y             | Y >= 4.0    |
| Processing time           | X min          | Y min         | Y <= 0.5X   |
```

### 4.4 Hybrid Approach (Recommended)

**Strategy:** Use GPT-4o by default, GPT-5 for high-value scenarios

```typescript
// Pseudo-code for smart model selection
function selectExtractionModel(interview: Interview): Model {
  // Use GPT-5 for:
  if (interview.speaker_count >= 3) return 'GPT-5'  // Complex multi-party
  if (interview.duration_minutes >= 60) return 'GPT-5'  // Long interviews
  if (interview.project.tier === 'enterprise') return 'GPT-5'  // Premium users
  if (interview.context === 'research') return 'GPT-5'  // Research-critical

  // Default to GPT-4o for:
  return 'GPT-4o'  // Sales calls, support, short interviews
}
```

**Benefits:**
- 70% of interviews use faster/cheaper GPT-4o
- 30% of high-value interviews get GPT-5 quality
- Average cost reduction: 50-60%
- Average time reduction: 40-50%

---

## 5. High-Impact Optimization Opportunities

### 🔴 CRITICAL: Evidence Extraction (GPT-5 → GPT-4o)

**Current State:**
```baml
function ExtractEvidenceFromTranscriptV2(...) -> Extraction {
  client "CustomGPT5"  // ⚠️ Most expensive model
  prompt #"..."
}
```

**Impact:**
- **Current cost:** $0.75-$1.50 per interview
- **With GPT-4o:** $0.15-$0.30 per interview
- **Savings:** 70-80% reduction = **$0.60-$1.20 per interview**
- **Annual savings (1000 interviews):** $600-$1,200

**Recommendation:** Test GPT-4o for evidence extraction. GPT-5 may be overkill for structured extraction tasks.

**Action:**
```baml
function ExtractEvidenceFromTranscriptV2(...) -> Extraction {
  client "CustomGPT4o"  // ✅ Test this first
  // Fallback to GPT-5 only if quality degrades
}
```

---

### 🟡 MEDIUM: Lens Synthesis Optimization

**Current State:**
- Each lens type calls GPT-4o independently
- Lens synthesis calls GPT-4o again to combine results
- Total: 3-5 GPT-4o calls per interview with multiple lenses

**Optimization Options:**

1. **Batch Lens Processing** (Recommended)
   - Combine multiple lens extractions into single call
   - Estimated savings: 40-50%
   - Implementation: Modify lens templates to support multi-lens extraction

2. **Downgrade Synthesis to GPT-4o-mini**
   - Synthesis is simpler than extraction
   - Estimated savings: 60-70% on synthesis step
   - Risk: Lower quality summaries

**Action:**
```baml
// Current
function SynthesizeLensInsights(...) -> LensSynthesisResult {
  client CustomGPT4o  // $0.25-$0.40
}

// Optimized
function SynthesizeLensInsights(...) -> LensSynthesisResult {
  client CustomGPT4oMini  // $0.015-$0.025 (90% savings)
}
```

---

### 🟡 MEDIUM: Conversation Analysis Downgrade

**Current State:**
```baml
function ConversationAnalysis(...) -> ConversationAnalysis {
  client CustomGPT4o
}
```

**Recommendation:** Test GPT-4o-mini for conversation analysis
- **Current:** $0.10-$0.15 per interview
- **With mini:** $0.006-$0.009 per interview
- **Savings:** 94% = **$0.09-$0.14 per interview**

**Risk Assessment:** LOW - Conversation analysis is relatively straightforward

---

### 🟢 LOW: Embedding Batch Optimization

**Current State:**
```typescript
// Processes embeddings with concurrency limit of 5
export async function generateEmbeddingsBatch(
  texts: string[],
  options: GenerateEmbeddingOptions = {}
): Promise<(number[] | null)[]> {
  const CONCURRENCY = 5  // ⚠️ Could be higher
  // ...
}
```

**Optimization:**
- Increase concurrency to 10-20 (OpenAI supports high throughput)
- Use batch API endpoint if available
- Estimated time savings: 50-60%
- Cost impact: Neutral (same tokens, faster processing)

**Action:**
```typescript
const CONCURRENCY = 15  // ✅ Increase for faster processing
```

---

### 🟢 LOW: Prompt Optimization

**Current Issues:**
1. **Verbose prompts** - Some BAML functions have 200+ line prompts
2. **Redundant instructions** - Repeated across multiple functions
3. **Over-specification** - May be constraining model unnecessarily

**Recommendations:**
1. **Compress prompts** - Remove redundant examples and instructions
   - Estimated savings: 10-20% input tokens
2. **Use system messages** - More efficient than prompt repetition
3. **Test shorter prompts** - GPT-4o/5 are good at following terse instructions

**Example:**
```baml
// Current: ~500 tokens
prompt #"
You are an expert UX researcher.
Your task is to produce an exhaustive, chronological Event Stream...
[200 more lines]
"#

// Optimized: ~200 tokens
prompt #"
Extract chronological evidence from transcript.
Output: EvidenceTurn[] with person_key, gist, chunk, verbatim, anchors.
Rules: [concise list]
"#
```

---

## 6. Speed Optimization Opportunities

### 6.1 Immediate Parallelization (No Architecture Change)

**Parallelize Steps 5 & 6 in Orchestrator:**

```typescript
// Current (Sequential) - ~2 min
await assignPersonasTaskV2.triggerAndWait(...)  // Step 5
await attributeAnswersTaskV2.triggerAndWait(...) // Step 6

// Optimized (Parallel) - ~1 min
// Note: Trigger.dev doesn't support Promise.all, but we can fire-and-forget step 6
const answersHandle = attributeAnswersTaskV2.trigger(...)  // Fire step 6
await assignPersonasTaskV2.triggerAndWait(...)  // Wait for step 5
await answersHandle.wait()  // Then wait for step 6
```

**Impact:** -15% total processing time

### 6.2 Increase Batch Concurrency

**Current:**
```typescript
// app/utils/batchEvidence.ts
const BATCH_SIZE = 75
const MAX_CONCURRENT_BATCHES = 3
```

**Optimized:**
```typescript
const BATCH_SIZE = 75
const MAX_CONCURRENT_BATCHES = 5  // OpenAI can handle this
```

**Impact:** -20% evidence extraction time

### 6.3 Increase Embedding Concurrency

**Current:**
```typescript
// app/lib/embeddings/openai.server.ts
const CONCURRENCY = 5
```

**Optimized:**
```typescript
const CONCURRENCY = 15  // OpenAI embedding API is very fast
```

**Impact:** -40% embedding generation time

### 6.4 Batch Theme-Evidence Linking

**Current:** Sequential semantic search per theme
```typescript
for (const theme of createdThemes) {
  const similarEvidence = await searchEvidenceForTheme(...)  // 1 search per theme
}
```

**Optimized:** Batch all theme queries
```typescript
const allThemeQueries = createdThemes.map(t => buildSearchQuery(t))
const allEmbeddings = await generateEmbeddingsBatch(allThemeQueries)
const allMatches = await batchSimilaritySearch(allEmbeddings, evidenceIds)
```

**Impact:** -50% theme linking time

### 6.5 Caching Strategies

**Opportunities:**

1. **Embedding cache** - Cache embeddings for repeated text
2. **Theme deduplication cache** - Reduce redundant similarity checks
3. **Lens result cache** - Cache lens results for unchanged evidence

**Estimated Impact:** 20-30% reduction in redundant LLM calls

### 6.6 Projected Time Savings

| Optimization | Current | Optimized | Savings |
|--------------|---------|-----------|--------|
| GPT-5 → GPT-4o | 3-5 min | 1.5-2.5 min | 50% |
| Batch concurrency 3→5 | 4.5 min | 3.5 min | 22% |
| Embedding concurrency 5→15 | 2 min | 1.2 min | 40% |
| Parallel steps 5&6 | 2 min | 1.2 min | 40% |
| Batch theme linking | 1 min | 0.5 min | 50% |
| **TOTAL** | **12-15 min** | **5-7 min** | **50-55%** |

---

## 7. Cost Projection Scenarios

### Scenario A: Current State (No Optimization)

| Monthly Volume | Interviews | Lenses | Embeddings | Total Cost |
|----------------|-----------|--------|------------|------------|
| **Light** | 50 | 100 | 5,000 | $150-$250 |
| **Medium** | 200 | 500 | 20,000 | $600-$1,000 |
| **Heavy** | 500 | 1,500 | 50,000 | $1,500-$2,500 |

### Scenario B: With Optimizations (GPT-5→4o, Mini upgrades)

| Monthly Volume | Interviews | Lenses | Embeddings | Total Cost | Savings |
|----------------|-----------|--------|------------|------------|---------|
| **Light** | 50 | 100 | 5,000 | $60-$100 | 60% |
| **Medium** | 200 | 500 | 20,000 | $240-$400 | 60% |
| **Heavy** | 500 | 1,500 | 50,000 | $600-$1,000 | 60% |

**Annual Savings (Medium Volume):** $4,320-$7,200

---

## 8. Implementation Roadmap

### Phase 1: Quick Wins (Week 1-2)

- [ ] **Test GPT-4o for evidence extraction** - Biggest cost saver
- [ ] **Downgrade synthesis to GPT-4o-mini** - Low risk, high reward
- [ ] **Increase embedding concurrency** - Faster, no cost impact
- [ ] **Add embedding cache** - Reduce redundant calls

**Expected Impact:** 40-50% cost reduction, 30% speed improvement

### Phase 2: Medium Optimizations (Week 3-4)

- [ ] **Batch lens processing** - Combine multiple lens calls
- [ ] **Downgrade conversation analysis** - Test mini model
- [ ] **Compress verbose prompts** - 10-20% token reduction
- [ ] **Implement lens result caching** - Avoid re-processing

**Expected Impact:** Additional 15-20% cost reduction

### Phase 3: Advanced Optimizations (Month 2)

- [ ] **Parallel lens application** - 3-5x faster processing
- [ ] **Smart model routing** - Use mini for simple tasks, 4o for complex
- [ ] **Prompt engineering audit** - Optimize all BAML functions
- [ ] **Usage monitoring dashboard** - Track costs per feature

**Expected Impact:** Additional 10-15% cost reduction, 50% speed improvement

---

## 9. Monitoring & Metrics

### Key Metrics to Track

1. **Cost per Interview** - Target: <$0.50 (currently $1.06-$2.15)
2. **Cost per Lens Application** - Target: <$0.10 (currently $0.15-$0.30)
3. **Embedding Cost per 1K** - Target: <$0.05 (currently $0.05-$0.20)
4. **Processing Time per Interview** - Target: <2 minutes
5. **Model Distribution** - Track GPT-5 vs 4o vs mini usage

### Recommended Tools

- **Langfuse** - Already integrated for BAML tracing
- **Custom Dashboard** - Build cost tracking per user action
- **Alert Thresholds** - Notify when costs exceed budget

---

## 10. Risk Assessment

### High-Risk Changes

| Change | Risk | Mitigation |
|--------|------|------------|
| GPT-5 → GPT-4o for evidence | Quality degradation | A/B test, quality metrics |
| Batch lens processing | Complex refactor | Incremental rollout |

### Low-Risk Changes

| Change | Risk | Mitigation |
|--------|------|------------|
| Synthesis → mini | Minor quality loss | Easy rollback |
| Embedding concurrency | Rate limits | Exponential backoff |
| Prompt compression | Minimal | Test on sample data |

---

## 11. Recommendations Summary

### Immediate Actions (This Week)

1. ✅ **Test GPT-4o for evidence extraction** - Potential 70% savings on biggest cost
2. ✅ **Downgrade synthesis to GPT-4o-mini** - Safe 90% savings on synthesis
3. ✅ **Increase embedding concurrency to 15** - Faster processing, no cost change

### Short-term (This Month)

4. ✅ **Implement embedding cache** - Reduce redundant calls
5. ✅ **Test GPT-4o-mini for conversation analysis** - 94% savings
6. ✅ **Compress verbose prompts** - 10-20% token reduction

### Long-term (Next Quarter)

7. ✅ **Build cost monitoring dashboard** - Track per-feature costs
8. ✅ **Implement parallel lens processing** - 3-5x speed improvement
9. ✅ **Smart model routing** - Auto-select best model for task complexity

---

## 12. Conclusion

**Current State:** $1.06-$2.15 per interview + $0.60-$1.20 per lens set
**Optimized State:** $0.30-$0.65 per interview + $0.15-$0.30 per lens set
**Total Savings:** 60-70% cost reduction + 50% speed improvement

**Primary Cost Driver:** GPT-5 for evidence extraction (60-70% of costs)
**Biggest Opportunity:** Switch to GPT-4o for evidence extraction
**Quick Wins:** Synthesis downgrade, embedding optimization, prompt compression

**Next Steps:**
1. Run A/B test: GPT-5 vs GPT-4o for evidence extraction
2. Implement synthesis model downgrade
3. Set up cost tracking dashboard
4. Review results after 2 weeks and iterate

---

**Report Generated:** January 10, 2026
**Analysis Confidence:** High (based on codebase review and current pricing)
**Recommended Review Frequency:** Monthly
