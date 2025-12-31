# Realtime Analysis Proposal

**Status:** Future Enhancement (v2+)
**Author:** Claude
**Date:** December 2025

## Executive Summary

This document outlines a potential enhancement to process meeting transcripts in realtime during recording, rather than waiting for post-upload batch processing. This would enable in-meeting coaching and instant evidence surfacing.

## Current Architecture (Batch Processing)

```
Recording ends → Upload to Recall → Webhook → Download to R2 → Trigger.dev → BAML Analysis
                                                                    ↓
                                                              5-10 min delay
```

## Proposed Architecture (Realtime + Batch)

```
During recording:
  transcript.data → Buffer (2-3 min) → Lightweight Evidence Detector → Stream to UI
                                                                          ↓
                                                                   Provisional Insights

After recording:
  Upload → Webhook → Full BAML Analysis → Verified Evidence + Themes
```

## What Recall Provides in Realtime

| Event | Data | Latency |
| ----- | ---- | ------- |
| `transcript.data` | Confirmed utterances with speaker | ~3s (low latency mode) |
| `transcript.partial_data` | In-progress speech | <1s |
| `participant_events.join` | Speaker name, ID, host status | Instant |
| `participant_events.speech_on` | Who is speaking | Instant |

The realtime transcript quality is identical to post-processing when using "accurate" mode.

## Proposed Implementation

### Phase 1: Evidence Detector (Lightweight)

Create a streaming evidence detector that runs during recording:

```typescript
interface RealtimeEvidence {
  type: 'pain_point' | 'feature_request' | 'competitor_mention' | 'quote';
  text: string;
  speaker: string;
  confidence: number;
  timestamp: number;
}

class RealtimeEvidenceDetector {
  private buffer: TranscriptEntry[] = [];
  private readonly BUFFER_SIZE = 50; // ~2-3 minutes of conversation

  async process(entry: TranscriptEntry): Promise<RealtimeEvidence[]> {
    this.buffer.push(entry);
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.shift();
    }

    // Run lightweight detection every N entries
    if (this.buffer.length % 5 === 0) {
      return await this.detectEvidence();
    }
    return [];
  }

  private async detectEvidence(): Promise<RealtimeEvidence[]> {
    // Use smaller/faster model (e.g., gpt-4o-mini)
    // Simpler prompt focused on detection, not full extraction
    // Return provisional evidence for UI display
  }
}
```

### Phase 2: In-Meeting Coaching UI

Display provisional insights during recording:

```
┌────────────────────────────────────────────────────────────────┐
│ ○ ○ ○   Recording • 12:34                                      │
├────────────────────────────────────────────────────────────────┤
│ John: The main issue is our current tool is too slow...        │
│ Sarah: Can you tell me more about how that affects your team?  │
│ John: Well, we spend about 2 hours per day just waiting...     │
│                                                            ▼   │
├────────────────────────────────────────────────────────────────┤
│ 💡 Insights (live)                                             │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 🔴 Pain Point: "tool is too slow" - John                   │ │
│ │ 📊 Quantified: "2 hours per day" impact                    │ │
│ └────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│   [⏹️ Stop Recording]                                          │
└────────────────────────────────────────────────────────────────┘
```

### Phase 3: Coaching Prompts

Based on detected patterns, suggest questions:

```
┌────────────────────────────────────────────────────────────────┐
│ 💬 Suggested Question                                          │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ "What would happen if you could cut that 2 hours to        │ │
│ │  10 minutes?"                                               │ │
│ └────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## Pros & Cons

### Pros

| Benefit | Impact |
| ------- | ------ |
| **Instant insights** | Users see evidence as it's spoken, not 5-10 min after call |
| **In-meeting coaching** | Could prompt "ask about pricing" when competitor mentioned |
| **Differentiated UX** | No other tool shows analyzed insights during the call |
| **Reduced latency** | Skip upload → webhook → download chain for first insights |
| **Offline resilience** | If upload fails, we still have local analysis |

### Cons

| Drawback | Mitigation |
| -------- | ---------- |
| **Engineering effort** | Start with simple keyword detection, evolve to LLM |
| **Context limitations** | Buffer enough context (2-3 min), mark as "provisional" |
| **Cost increase** | Use cheaper model (gpt-4o-mini), batch every 5 utterances |
| **Accuracy trade-off** | Full BAML still runs post-call; realtime is supplementary |
| **Complexity** | Keep realtime simple; heavy lifting stays in batch pipeline |

## Cost Analysis

### Current (Batch Only)

- Recall transcription: $0.15/hr
- AssemblyAI: $0.15/hr (can be eliminated - see below)
- BAML analysis: ~$0.10/hr (one call per interview)

**Total: $0.25-0.40/hr per interview**

### With Realtime (Estimate)

- Recall transcription: $0.15/hr
- Realtime detection: ~$0.05/hr (gpt-4o-mini, every 5 utterances)
- BAML analysis: ~$0.10/hr (unchanged)

**Total: $0.30/hr per interview** (assuming AssemblyAI eliminated)

## Recommendation

### Skip for v1

Realtime analysis is compelling but not essential for launch. Focus on:

1. Getting the batch pipeline working end-to-end
2. Eliminating AssemblyAI costs by using Recall transcript
3. Validating user adoption of desktop app

### Consider for v2

Once v1 is stable and users are recording meetings:

1. Add simple keyword-based detection (competitors, pricing, pain words)
2. Display provisional insights in sidebar
3. Gather user feedback on usefulness
4. Evolve to LLM-based detection if valuable

## Technical Prerequisites

Before implementing realtime analysis:

- [ ] Batch pipeline working with Recall transcript (skip AssemblyAI)
- [ ] Evidence extraction BAML prompts stabilized
- [ ] Desktop app stable with real user recordings
- [ ] Metrics on post-processing latency (is 5-10 min actually a problem?)

## References

- [DESIGN.md](./DESIGN.md) - Current architecture
- [meeting-agent-spec.md](./meeting-agent-spec.md) - Backend integration spec
- [Recall.ai Realtime Events](https://docs.recall.ai/docs/desktop-sdk) - SDK documentation
