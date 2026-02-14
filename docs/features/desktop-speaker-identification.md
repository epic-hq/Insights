# Desktop Speaker Identification for Realtime Evidence Extraction

**Bead**: Insights-32v
**Status**: Spec complete, ready for implementation
**Related**: Insights-1yn (realtime evidence UX), Insights-4dj (evidence persistence), Insights-xph (desktop epic)

---

## Problem

During live desktop recording, the realtime evidence extraction (GPT-4o-mini via `/api/desktop/realtime-evidence`) produces evidence with wrong or missing speaker labels:

1. **Solo call**: User was the only speaker, but evidence came back with "Unknown" speaker label. The LLM had no context about who was speaking.
2. **Multi-speaker calls**: The LLM assigns generic labels or infers incorrectly because it only receives utterance text — no participant context.

The BAML-based pipeline in trigger.dev (`ExtractEvidenceFromTranscriptV2` in `baml_src/extract_evidence.baml`) already solves this by passing `SpeakerUtterance[]` with proper speaker labels and the `Person` class for identity. The realtime path should follow this same pattern.

---

## Recall SDK Speaker Data (Research)

### What the SDK provides in `transcript.data` events

```json
{
  "event": "transcript.data",
  "data": {
    "data": {
      "words": [{ "text": "...", "start_timestamp": { "relative": 1.23 } }],
      "participant": {
        "id": 123,
        "name": "Richard Moy",
        "email": null,
        "is_host": true,
        "platform": "google-meet",
        "extra_data": {}
      }
    }
  }
}
```

### `participant_events.join` event

```json
{
  "event": "participant_events.join",
  "data": {
    "data": {
      "participant": {
        "id": 123,
        "name": "Richard Moy",
        "email": null,
        "is_host": true,
        "platform": "google-meet",
        "extra_data": {}
      },
      "timestamp": { "absolute": "2026-02-06T10:00:00Z", "relative": 0 }
    }
  }
}
```

### Speaker Timeline Diarization (Default)

Recall uses the meeting platform's active speaker detection (Speaker Timeline Diarization) by default. This gives **real participant names** — not generic "Speaker 0/1/2" labels. Generic labels only appear with Machine Diarization (AssemblyAI/Deepgram speaker_labels mode), which we don't use.

### Platform-specific identifiers in `extra_data`

| Platform | Field | Description |
|----------|-------|-------------|
| Zoom | `conf_user_id` | Reliable cross-meeting identifier |
| Teams | `user_id` | Consistent Teams user ID |
| Webex | `webex_id` | Webex user identifier |
| Slack | `email` (nested) | Email in extra_data.slack |

### Email availability

Email is **not natively available** from most platforms. Requires Recall Calendar Integration (V1 or V2) which maps participants to calendar invite emails. Per their docs: "doesn't work 100% of the time." Plan as future enhancement.

### Additional events available

| Event | Description |
|-------|-------------|
| `participant_events.leave` | When someone exits |
| `participant_events.update` | Name/identity changes mid-meeting (e.g., "Guest" becomes real name) |
| `participant_events.speech_on/off` | Speaking activity tracking |
| `participant_events.webcam_on/off` | Camera status |

---

## Current Architecture

### Desktop (`desktop/src/main.js`)

| Function | Line | What it does |
|----------|------|-------------|
| `processParticipantJoin()` | ~2284 | Captures participant name/id/host/platform, stores on `meeting.participants[]` |
| `processTranscriptData()` | ~2888 | Extracts `participant.name` from transcript events, falls back to "Speaker X" / "Unknown Speaker" |
| `evidenceExtractionState` | ~2399 | Per-meeting state: `evidence[]`, `tasks[]`, `people[]`, `interviewId` |
| `performEvidenceExtraction()` | ~2727 | Formats utterances as `{ speaker, text }`, sends to API |
| `extractRealtimeEvidence()` | ~2433 | HTTP POST to `/api/desktop/realtime-evidence` |

### Server (`app/routes/api.desktop.realtime-evidence.ts`)

- Accepts `utterances: [{ speaker, text }]` and `existingEvidence: string[]`
- Calls `generateObject()` with GPT-4o-mini and Zod schema
- Prompt tells LLM to extract evidence — but **never tells it who the known speakers are**

### Recall token config (`app/routes/api.desktop.recall-token.ts`)

Currently subscribed events:
```js
events: ["transcript.data", "transcript.partial_data", "participant_events.join"]
```

### BAML Pipeline (trigger.dev) — The Pattern to Follow

- `baml_src/extract_evidence.baml`: `ExtractEvidenceFromTranscriptV2` takes `speaker_transcripts: SpeakerUtterance[]` (speaker + text + timing)
- `Person` class: `person_key`, `speaker_label`, `person_name`, `inferred_name`, `role`
- Prompt instructs: "Identify every human speaker. Populate the `people` array with person_key, display_name, inferred_name, role."
- `src/trigger/realtime/extractRealtimeEvidence.ts`: Calls BAML directly with speaker transcripts

---

## Implementation Plan

### Phase 1: Build Known-Speakers Roster

**File**: `desktop/src/main.js`

Add a `knownSpeakers` map to `activeMeetingIds[windowId]` tracking all identified participants:

```js
// At meeting creation (createMeetingNoteAndRecord)
global.activeMeetingIds[windowId].knownSpeakers = {};

// Seed with logged-in user
const userContext = await getUserContext();
if (userContext?.name) {
  global.activeMeetingIds[windowId].knownSpeakers['self'] = {
    name: userContext.name,
    email: userContext.email,
    role: 'interviewer',
    isHost: true,
  };
}
```

Update `processParticipantJoin()` to also add to `knownSpeakers`:

```js
global.activeMeetingIds[windowId].knownSpeakers[participantId] = {
  name: participantName,
  email: participantData.email || null,
  isHost: participantData.is_host,
  platform: participantData.platform,
  extraData: participantData.extra_data || {},
};
```

Enrich `processTranscriptData()` to use `participant.id` for name lookup:

```js
const participantId = evt.data.data.participant?.id;
const knownSpeakers = global.activeMeetingIds?.[windowId]?.knownSpeakers;
if (participantId && knownSpeakers?.[participantId]?.name) {
  speaker = knownSpeakers[participantId].name;
} else if (evt.data.data.participant?.name && ...) {
  speaker = evt.data.data.participant.name;
}
```

### Phase 2: Pass Known Speakers to Evidence Extraction

**File**: `desktop/src/main.js` — `performEvidenceExtraction()`

Gather known speakers from both `meeting.participants[]` and `knownSpeakers` map:

```js
const speakers = (meeting.participants || [])
  .filter(p => p.name && p.name !== 'Unknown Participant')
  .map(p => ({ name: p.name, role: p.isHost ? 'host' : 'participant' }));

// Add logged-in user if not already present
const userContext = await getUserContext();
if (userContext?.name && !speakers.find(s => s.name === userContext.name)) {
  speakers.push({ name: userContext.name, role: 'interviewer' });
}
```

Pass `knownSpeakers` to `extractRealtimeEvidence()` and include in API request body.

**File**: `app/routes/api.desktop.realtime-evidence.ts`

Accept `knownSpeakers` in request body:

```typescript
interface RealtimeEvidenceRequest {
  utterances: Array<{ speaker: string; text: string }>;
  existingEvidence?: string[];
  knownSpeakers?: Array<{ name: string; role?: string }>;
  // ... existing fields
}
```

Inject into prompt:

```
${knownSpeakers?.length ? `
KNOWN PARTICIPANTS IN THIS MEETING:
${knownSpeakers.map(s => `- ${s.name}${s.role ? ` (${s.role})` : ''}`).join('\n')}

IMPORTANT: Use these exact names for speaker_label when attributing evidence.
Match transcript speaker labels to known participants above.` : ''}
```

### Phase 3: Subscribe to Additional Participant Events

**File**: `app/routes/api.desktop.recall-token.ts`

```js
events: [
  "transcript.data",
  "transcript.partial_data",
  "participant_events.join",
  "participant_events.leave",
  "participant_events.update",
]
```

**File**: `desktop/src/main.js`

Handle new events in the realtime callback:

```js
else if (evt.event === "participant_events.leave") {
  await processParticipantLeave(evt);
}
else if (evt.event === "participant_events.update") {
  await processParticipantUpdate(evt);
}
```

- `processParticipantLeave()`: Mark participant inactive, update `meeting.participants[].status = 'left'`
- `processParticipantUpdate()`: Update name/email in both `meeting.participants[]` and `knownSpeakers` map — handles the common case where a platform initially reports "Guest" then resolves to a real name

### Phase 4: Enhance Finalization with Participant Data

**File**: `desktop/src/main.js` — `finalizeInterview()`

Merge `meeting.participants` (from Recall events) with `state.people` (from LLM extraction). Include platform-specific identifiers for future cross-meeting person matching:

```js
const participants = (meeting.participants || []).map(p => ({
  person_key: `recall-${p.id}`,
  person_name: p.name,
  platform: p.platform,
  is_host: p.isHost,
  platform_user_id: p.extraData?.conf_user_id || p.extraData?.user_id || null,
}));
```

---

## Future: Calendar Integration for Email-Based Identity

Recall supports Calendar Integration (V1/V2) mapping participants to calendar invite emails. Benefits:
- Auto-match to existing `people` records by email
- Cross-meeting identity (same person across calls)
- CRM enrichment (company, role)

Per Recall docs, this "doesn't work 100% of the time." Defer to future work.

---

## Files Summary

| File | Changes |
|------|---------|
| `desktop/src/main.js` | `knownSpeakers` roster on `activeMeetingIds`, enrich `processTranscriptData` with participant.id lookup, pass `knownSpeakers` in `performEvidenceExtraction`, add `processParticipantLeave/Update` handlers |
| `app/routes/api.desktop.realtime-evidence.ts` | Accept `knownSpeakers[]` in request, inject into GPT-4o-mini prompt |
| `app/routes/api.desktop.recall-token.ts` | Add `participant_events.leave` and `participant_events.update` to subscribed events |

## Testing

1. Solo call: Start Google Meet alone. Evidence `speaker_label` should be user's real name.
2. Two-person call: Both names should appear correctly in transcript and evidence.
3. Late joiner: Person joins mid-meeting. Their name should appear correctly in subsequent evidence.
4. Platform name resolution: If someone starts as "Guest", their name should update when the platform identifies them via `participant_events.update`.
5. Finalize: After meeting ends, `people` array in finalize call should include all participants with correct names.
