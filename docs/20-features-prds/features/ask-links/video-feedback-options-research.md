# Ask Links - Video Feedback Options Research

## Overview

Exploring options for collecting video feedback from respondents in Ask links. Currently we have Form and Chat modes - could we add a Video mode?

## Options Comparison

### Option A: Simple Video Recording (MediaRecorder API)

**How it works:**
- Respondent clicks "Record Video Response"
- Browser MediaRecorder API captures webcam + audio
- Video uploaded to Cloudflare R2 when done
- Similar to Loom, but embedded in our survey

**Pros:**
- Simple to implement (already have `use-media-recorder.ts` hook)
- No external service dependencies
- Low cost (just R2 storage)
- Works offline/async - respondent can record on their time

**Cons:**
- One-way communication (no interactivity)
- No real-time transcription
- Respondent talks to a blank screen
- May feel impersonal

**Cost:** ~$0.015/GB storage + bandwidth

---

### Option B: LiveKit AI Voice Agent (Current Setup)

**How it works:**
- Respondent joins LiveKit room
- AI voice agent asks questions conversationally
- Audio-only (current implementation)
- Can use Egress to record the conversation

**Pros:**
- Already implemented for internal use
- Interactive, conversational experience
- AI can probe deeper, ask follow-ups
- Natural language processing built-in

**Cons:**
- Audio-only (no video currently)
- Requires LiveKit Cloud infrastructure
- Real-time = must be synchronous
- Higher complexity for respondents (permissions, etc.)

**Cost:** LiveKit pricing (see below)

---

### Option C: LiveKit Video Room with AI Agent

**How it works:**
- Extend current voice agent to video rooms
- Respondent sees animated avatar or brand visual
- AI asks questions via voice, respondent answers
- Full video + audio recorded via Egress

**Pros:**
- Most engaging experience
- Interactive follow-up questions
- Video captures non-verbal cues
- Premium feel for respondents

**Cons:**
- Most complex to implement
- Highest cost (video bandwidth + egress)
- Requires good internet connection
- Privacy concerns (video of respondent)

**Cost:** LiveKit video pricing + egress recording fees

---

### Option D: Hybrid - Async Video + AI Review

**How it works:**
- Respondent records video response (Option A)
- After upload, AI agent reviews video
- AI extracts insights, generates summary
- Researcher gets structured output

**Pros:**
- Asynchronous (respondent's convenience)
- AI still provides intelligence layer
- Lower cost than real-time
- Privacy-friendly (video stays local until submitted)

**Cons:**
- No interactivity during recording
- Post-processing adds latency
- Requires transcription pipeline

**Cost:** R2 storage + transcription + LLM processing

---

## LiveKit Pricing Context

From [LiveKit Pricing](https://livekit.io/pricing):

| Plan | Monthly | Connection Mins | Notes |
|------|---------|-----------------|-------|
| Free | $0 | 5,000 | 60 min shared with recording |
| Ship | $50 | 150,000 | Good for MVP |
| Scale | $500 | More | Production apps |

**Egress (Recording):** Shares allocation with connection minutes. A 5-minute video call that's recorded = 10 minutes of usage.

---

## Existing Infrastructure

We already have:
- ✅ LiveKit agent (`agents/livekit/agent.ts`)
- ✅ Token endpoint (`app/routes/api.livekit-token.tsx`)
- ✅ Voice chat component (`ProjectStatusVoiceChat.tsx`)
- ✅ MediaRecorder hook (`use-media-recorder.ts`)
- ✅ R2 upload utilities (`r2.server.ts`)
- ✅ Transcription pipeline (AssemblyAI/Deepgram)

---

## Recommendation

**For MVP:** Start with **Option A (Simple Video Recording)**
- Fastest to ship
- Lowest cost
- Validates demand before investing in real-time

**Future Enhancement:** If video responses are popular, add **Option B (LiveKit Voice)**
- Upgrade voice agent for Ask-specific prompting
- Enable Egress recording
- Consider video later based on usage

**Long-term:** Consider **Option D (Hybrid)** if users want both async flexibility and AI intelligence.

---

## Questions to Answer

1. Do respondents want to be on video, or just audio?
2. Is interactivity (AI follow-ups) valuable for this use case?
3. What's the target response length? (30s? 2min? 5min?)
4. Privacy requirements - where can video be stored?

---

## Sources

- [LiveKit Pricing](https://livekit.io/pricing)
- [LiveKit Egress Overview](https://docs.livekit.io/home/egress/overview/)
- [Room Composite Egress](https://docs.livekit.io/home/egress/room-composite/)
- [LiveKit Cloud Billing](https://docs.livekit.io/deploy/admin/billing/)
