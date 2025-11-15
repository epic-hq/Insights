# Voice Agent Options: LiveKit vs. Mastra Realtime

## Current LiveKit voice intake (shipped)
- The `/project-chat` widget now mints a LiveKit token via `POST /a/:accountId/:projectId/api/project-chat/voice-turn` and uses it to attach the AI listener to the same WebRTC room as the participant.
- A dedicated control service (`scripts/voice-agent/agent.ts`) joins the room on demand and boots the LiveKit Agent runtime with AssemblyAI Slam-1 STT, OpenAI for dialog + extraction, ElevenLabs for speech, and a silence-based turn detector so the AI waits for the user to finish speaking.
- Every confirmed user turn is summarized into either the discovery or post-sales schema and pushed over LiveKit data channels (`form_update`, `summary`, `turn`) so the widget’s preview + persistence stay synchronized until all required slots are filled and the AI emits a completion summary.
- Environment is managed via `VOICE_AGENT_*` variables plus the LiveKit/AssemblyAI/OpenAI/ElevenLabs secrets documented in `docs/voice-agent.md`.

## What Mastra’s realtime stack provides
- `@mastra/core` exposes a `MastraVoice` base class with optional listening/speech models and a `realtimeConfig` hook so a provider can open a WebSocket/WebRTC session, stream audio, and emit `speaking`/`writing` events for downstream tools. The base class also surfaces helpers for instructions, tools, and speaker metadata, which map to the broader Mastra agent runtime you already use elsewhere.
- The companion `CompositeVoice` lets you combine separate providers for input, output, and realtime transport. When a realtime provider is present it becomes the single point handling `.connect()`, `.send()`, `.answer()`, `.addInstructions()`, and event wiring; otherwise Mastra falls back to whichever standalone STT or TTS providers you assign.
- Because Mastra treats realtime voice as another agent component, you can mount the same workflow/tools the project chat agent already exposes (e.g., saving structured results to Supabase) while layering speech transport capabilities on top.

## Implementation effort for the Mastra alternative
1. **Realtime provider** – Implement or adopt a `MastraVoice` realtime provider that speaks the APIs from `node_modules/@mastra/core/dist/chunk-42VT5WOB.js` (connect, send, answer, addInstructions, addTools, event handlers). LiveKit can still serve as the media plane, but Mastra would expect the provider to translate LiveKit audio frames into whatever STT/LLM/TTS stack you configure.
2. **Session orchestration** – Instead of the bespoke `scripts/voice-agent` server, hook Mastra’s dev/deploy runtime so the `/project-chat` API triggers a Mastra agent that owns the realtime voice connection (similar to how text chat already streams to Mastra). We would still need token minting + room bootstrap logic.
3. **Form synchronization** – Keep the LiveKit data channel payloads or replace them with Mastra’s voice events. Either way the widget must listen for structured updates and completions to keep the intake UI in sync.

## Pros and cons
### LiveKit voice agent (current)
**Pros**
- End-to-end pipeline already implemented and documented, including turn detection, schema updates, and integration with our existing widget + storage layer.
- Uses the LiveKit Agent SDK, so streaming, STT, LLM, and TTS wiring are proven and configurable per session.
- Separate control server keeps production concerns (resource allocation, secrets) isolated from the Remix app.

**Cons**
- Duplication of business logic: discovery/post-sales extraction lives in the standalone script, not in the Mastra agents that already power text workflows.
- Any new behaviors (tools, telemetry, evals) must be re-implemented in the LiveKit agent rather than reusing Mastra’s abstractions.
- Two runtimes to operate (Remix + LiveKit script) with their own deployment surface and secrets.

### Mastra realtime voice option
**Pros**
- Shares the same Agent + Workflow infrastructure we already run (`app/mastra/*`), so tools, memories, and telemetry stay consistent between text and voice surfaces.
- Composite voice abstraction means we could mix providers (e.g., keep AssemblyAI + ElevenLabs) while letting Mastra own the streaming loop/event dispatch.
- Native event hooks (`speaking`, `writing`, `error`) give us structured state that could flow directly into UI or analytics without custom LiveKit data messages.

**Cons**
- Requires building or sourcing a realtime provider that satisfies the MastraVoice interface (connect/send/answer/etc.); no such provider ships in our repo today.
- The existing widget/session APIs expect LiveKit data messages, so we would still need custom glue code (or dual pipelines) even if Mastra drives the agent logic.
- Mastra’s realtime module is newer and less battle-tested for prolonged, interruption-free discovery calls compared to LiveKit’s agent stack.

### Mastra + Google Gemini speech-to-speech
The [Mastra voice docs](https://mastra.ai/docs/voice/speech-to-speech) ship a Gemini-powered `GeminiVoice` provider that handles STT, LLM reasoning, and TTS from a single Google API surface. It streams microphone audio directly to Gemini’s realtime endpoint while emitting `speaking` + `writing` events to the Mastra runtime.

**What we would need to adapt for the `/project-chat` flow**
1. **Browser input path** – instead of using the local Node microphone like the example, the widget would keep streaming audio through LiveKit so we can maintain shared rooms + data channels. On the backend we would translate LiveKit PCM frames into the `MastraGeminiVoice` input stream (Mastra uses the WebRTC `connect` helper behind the scenes, so we would adapt their `navigator.mediaDevices.getUserMedia` references to LiveKit’s server-side audio frames).
2. **Reduced vendor stack** – Gemini provides streaming STT, LLM, and speech synthesis in one API key. We would drop AssemblyAI, OpenAI, and ElevenLabs secrets in favor of Google Cloud credentials, though LiveKit remains necessary for multi-party audio and the existing widget wiring.
3. **Structured slot filling** – Mastra agents can still run our discovery/post-sales workflows; we would convert the LiveKit `form_update` payloads into Mastra workflow outputs or continue to broadcast data-channel updates sourced from Mastra events.

**Pros**
- Lowest vendor count (LiveKit + Google Cloud only) and one billing surface for STT/LLM/TTS.
- Gemini’s speech-to-speech model is tuned to maintain conversational cadence, so we may be able to relax the custom turn detector logic.
- Mastra already exports a ready-to-use `GeminiVoice`, so we avoid writing a provider from scratch.

**Cons**
- Google Gemini realtime is still in preview and enforces region restrictions plus project-level quotas; we would need VPC access to the Gemini API as well as new compliance reviews.
- Audio still has to exit the browser via WebRTC -> LiveKit -> Mastra -> Gemini. The example code assumes direct browser ↔ Gemini websockets, so we must ensure the extra hops keep latency acceptable.
- Gemini speech currently supports fewer configurable voices compared to ElevenLabs, so matching our existing persona set could be difficult.

### Recommendation
- If reducing the vendor stack and centralizing on Mastra workflows is the priority, piloting the Gemini voice provider inside a feature flag is worthwhile. We could keep LiveKit in place for transport while swapping the backend agent to Mastra + Gemini, allowing us to evaluate latency and transcription quality without deleting the working LiveKit agent.
- If stability and predictable voice characteristics matter more (e.g., for demos), stick with the current LiveKit pipeline until Gemini’s realtime SLA matures and the compliance work for Google Cloud is approved.
