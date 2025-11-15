# Project Voice Agent

This service powers the `/project-chat` voice intake experience. It pairs the LiveKit WebRTC session used by the client widget with a streaming agent that listens for turns, generates replies, and keeps the discovery/post-sales forms in sync.

## Architecture

1. **Client session** – the UI hits `POST /a/:accountId/:projectId/api/project-chat/voice-turn` to mint a LiveKit token. The handler also notifies the agent control service with the session metadata.
2. **Agent control** – `scripts/voice-agent/agent.ts` exposes a small HTTP API (`POST /sessions`). When called, it asks the LiveKit agent runtime to join the target room using a service token.
3. **Realtime pipeline** – once connected, the agent wires AssemblyAI Slam-1 for streaming transcription, OpenAI (configurable via `VOICE_AGENT_MODEL`) for dialogue + structured extraction, ElevenLabs for TTS, and a timeout-based turn detector so the AI waits for user pauses.
4. **Structured updates** – every confirmed user turn is summarised into the discovery or post-sales schema. Updates are published over LiveKit’s data channel (`form_update`, `summary`, and `turn` messages), which the widget merges into the live form preview and snapshot persistence.
5. **Completion** – when all required fields are filled, the agent thanks the user and emits a `summary` message with `completed: true`. The front-end closes the loop and saves the last snapshot into Supabase.

## Running locally

```bash
pnpm install
pnpm run voice-agent
```

Environment variables used by the agent:

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `ASSEMBLYAI_API_KEY`
- `OPENAI_API_KEY` (used by both the LiveKit realtime LLM and the structured extraction prompt)
- `ELEVEN_API_KEY`, `ELEVEN_VOICE_ID`
- `VOICE_AGENT_MODEL` (default `gpt-4o-mini`)
- `VOICE_AGENT_TURN_SILENCE_SECONDS` (controls the turn detector timeout)
- `VOICE_AGENT_CONTROL_SECRET` (shared secret for the `/sessions` endpoint)
- `VOICE_AGENT_PORT` / `VOICE_AGENT_CONTROL_URL` (where the control server listens)

Configure the widget with `VOICE_AGENT_CONTROL_URL` so the API route can wake the agent service per session.

## Considering a Mastra + Gemini alternative
We also evaluated Mastra’s `GeminiVoice` provider from [their speech-to-speech guide](https://mastra.ai/docs/voice/speech-to-speech). That path would keep LiveKit for browser streaming but hand off transcription, LLM reasoning, and TTS to Google Gemini via Mastra’s realtime runtime. See `docs/voice-agent-options.md` for a detailed comparison of the trade-offs (vendor count, latency, voice quality, and compliance work) before we decide whether to replace the current LiveKit agent.
