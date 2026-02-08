# People Pipeline Integration for Realtime Evidence Extraction

**Bead**: Insights-32v
**Date**: 2026-02-07
**Status**: Analysis Complete

---

## Executive Summary

The realtime evidence extraction path (desktop recording → GPT-4o-mini) currently produces evidence with wrong or missing speaker labels because it doesn't leverage our existing people identification infrastructure. Meanwhile, the batch processing pipeline (BAML → trigger.dev) has a robust, battle-tested system for:

1. **Speaker identification** via `Person` class with `person_key`, `speaker_label`, `person_name`, `role`
2. **People database** with rich schema (title, company, role, contact_info, etc.)
3. **Automatic linking** of people to interviews, organizations, and facets
4. **Person matching** and deduplication
5. **Segment inference** (job_function, seniority_level from title)

**Recommendation**: Adopt the exact same `Person`/`person_key` pattern from BAML in the realtime path, enabling seamless merging when batch analysis runs.

---

## Current Architecture Analysis

### 1. BAML Pipeline (The Working Pattern)

**File**: `baml_src/extract_evidence.baml`

**Person Class**:
```typescript
class Person {
  person_key string         // "participant-1", "interviewer-1" (deterministic)
  speaker_label string?     // "SPEAKER A", "Richard Moy" (literal transcript label)
  person_name string?       // "John Smith" (common name)
  inferred_name string?     // Preferred name from context
  role string?              // participant | interviewer | observer | customer | sales_rep
}
```

**How it works**:
1. LLM identifies every human speaker → creates `Person` entries
2. Every `EvidenceTurn` references `person_key` (REQUIRED field)
3. Prompt explicitly instructs: *"Identify every human speaker. Populate the `people` array with person_key, display_name, inferred_name, role."*
4. Trigger.dev orchestrator takes extracted `people` → creates/updates records in database

**Key insight**: The `person_key` is a **stable identifier** throughout the extraction. Evidence → People linking is explicit and traceable.

### 2. People Database Schema

**Table**: `people` (from `app/database.types.ts`)

```typescript
{
  id: uuid
  account_id: uuid
  project_id: uuid
  name: string              // Display name
  firstname: string
  lastname: string
  title: string            // Job title → used for segment inference
  company: string
  role: string             // Their role in conversation
  person_type: string      // 'internal' for team members
  primary_email: string
  primary_phone: string
  contact_info: JSON       // Platform-specific IDs

  // Enrichment fields
  job_function: string     // Auto-inferred from title
  seniority_level: string  // Auto-inferred from title
  linkedin_url: string
  industry: string

  // Relations
  people_organizations     // Links to organizations table
  person_facet            // Links to facet mentions
  interview_people        // Junction: which interviews they participated in
}
```

**Auto-triggered workflows**:
- When `title` is set → `inferSegmentsTask` (trigger.dev) fills `job_function` and `seniority_level`
- People are automatically linked to interviews via `interview_people` junction table
- Facet mentions reference `person_id` for attribution

### 3. Desktop Finalize Interview (Current Implementation)

**File**: `app/routes/api.desktop.interviews.finalize.ts`

**People handling**:
```typescript
// Desktop sends:
people: Array<{ person_key: string, person_name: string }>

// Backend logic:
for (const person of people) {
  // 1. Try fuzzy match by name
  const existingPeople = await supabase
    .from("people")
    .select("id, name")
    .ilike("name", `%${person.person_name}%`)

  if (existingPeople.length > 0) {
    peopleMap.set(person.person_key, existingPeople[0].id)
  } else {
    // 2. Create new person
    const newPerson = await supabase.from("people").insert({
      account_id,
      project_id,
      name: person.person_name,
      source: "desktop_meeting",
    })
    peopleMap.set(person.person_key, newPerson.id)
  }
}
```

**Limitation**: This only runs at meeting END. Realtime evidence extraction has no access to this mapping during the meeting.

### 4. Realtime Evidence Extraction (Current Gap)

**File**: `app/routes/api.desktop.realtime-evidence.ts`

**Current prompt** (lines 111-130):
```
Extract specific insights from this conversation transcript...

RULES:
- If speaker is unknown, omit speaker_label.
```

**Problem**: The LLM receives raw transcript like:
```
Richard Moy: I'm struggling with calendar integration
SPEAKER 2: Have you tried using Zapier?
```

The LLM has **no context** about:
- Who Richard Moy is (interviewer? participant? logged-in user?)
- Whether "Richard Moy" is the canonical name or should be "Rich"
- That "SPEAKER 2" might have a real name from Recall SDK participant events

**Result**: Evidence comes back with:
- `speaker_label: "Richard Moy"` (could be wrong person)
- `speaker_label: "SPEAKER 2"` (unhelpful)
- `speaker_label: null` (missing)

---

## Recall SDK Speaker Data (Desktop Source)

**From spec**: `docs/features/desktop-speaker-identification.md`

**What desktop receives from Recall**:

```json
{
  "event": "transcript.data",
  "data": {
    "participant": {
      "id": 123,
      "name": "Richard Moy",
      "email": null,
      "is_host": true,
      "platform": "google-meet"
    }
  }
}
```

**What desktop currently does** (`desktop/src/main.js`):
1. Line ~2284: `processParticipantJoin()` → stores `meeting.participants[]`
2. Line ~2888: `processTranscriptData()` → extracts `participant.name`, falls back to "Speaker X"
3. Line ~2727: `performEvidenceExtraction()` → formats as `{ speaker, text }`, sends to API

**What desktop DOESN'T do yet**:
- Build a `knownSpeakers` roster (name, role, email)
- Pass `knownSpeakers` to `/api/desktop/realtime-evidence`
- Seed with logged-in user context as "interviewer"

---

## Recommended Integration Approach

### Strategy: Adopt BAML Person Pattern in Realtime Path

**Core principle**: Use the same `Person` class structure in realtime extraction so evidence can be seamlessly merged when batch analysis runs.

### Phase 1: Desktop - Build Known Speakers Roster

**File**: `desktop/src/main.js`

**Changes**:
1. Add `knownSpeakers` map to `activeMeetingIds[windowId]`
2. Seed with logged-in user:
   ```js
   knownSpeakers['self'] = {
     name: userContext.name,
     email: userContext.email,
     role: 'interviewer',
     isHost: true,
   }
   ```
3. Update `processParticipantJoin()` to populate `knownSpeakers[participantId]`
4. Update `processTranscriptData()` to use `participant.id` for name lookup:
   ```js
   const participantId = evt.data.data.participant?.id
   if (participantId && knownSpeakers[participantId]) {
     speaker = knownSpeakers[participantId].name
   }
   ```

**Output**: Desktop now maintains a roster of all meeting participants with their real names and roles.

### Phase 2: API - Pass Known Speakers to Evidence Extraction

**File**: `app/routes/api.desktop.realtime-evidence.ts`

**Request schema** (line 55):
```typescript
interface RealtimeEvidenceRequest {
  utterances: Array<{ speaker: string; text: string }>
  existingEvidence?: string[]
  knownSpeakers?: Array<{    // NEW
    name: string
    role?: string              // 'interviewer' | 'participant' | 'host'
    email?: string
  }>
  interviewId?: string
}
```

**Prompt injection** (after line 118):
```typescript
const speakersContext = knownSpeakers?.length
  ? `
KNOWN PARTICIPANTS IN THIS MEETING:
${knownSpeakers.map(s => `- ${s.name}${s.role ? ` (${s.role})` : ''}`).join('\n')}

IMPORTANT: Use these exact names for speaker_label when attributing evidence.
Match transcript speaker labels to known participants above.
Identify their role (interviewer vs participant) for person_key generation.
`
  : ''
```

**Schema update** (line 19):
```typescript
const EvidenceSchema = z.object({
  people: z.array(
    z.object({
      person_key: z.string(),      // "participant-1", "interviewer-1"
      speaker_label: z.string(),   // "Richard Moy", "SPEAKER 2"
      person_name: z.string(),     // Canonical name
      role: z.enum(['interviewer', 'participant', 'observer']).optional(),
    })
  ),
  evidence: z.array(
    z.object({
      person_key: z.string(),      // NEW: reference to people array
      speaker_label: z.string().optional(),
      gist: z.string(),
      // ... rest unchanged
    })
  ),
})
```

**Why this works**:
1. LLM sees "Richard Moy (interviewer)" in context → generates `person_key: "interviewer-1"`
2. Evidence references `person_key` instead of raw `speaker_label`
3. Matches exact pattern from BAML pipeline

### Phase 3: Finalize Interview - Enhanced Person Resolution

**File**: `app/routes/api.desktop.interviews.finalize.ts`

**Current logic** (lines 141-176):
- Fuzzy match by name via `ilike`
- Create new person if no match

**Enhancement**:
```typescript
// Desktop now sends enhanced people array:
people: Array<{
  person_key: string,
  person_name: string,
  role: string,
  email?: string,              // NEW from Recall
  platform?: string,           // NEW: "google-meet", "zoom"
  platform_user_id?: string,   // NEW: Recall participant ID
}>

// Backend resolution with better matching:
for (const person of people) {
  let personId: string | null = null

  // 1. Try email match first (most reliable)
  if (person.email) {
    const byEmail = await supabase
      .from("people")
      .select("id")
      .eq("account_id", account_id)
      .eq("primary_email", person.email)
      .single()
    if (byEmail.data) personId = byEmail.data.id
  }

  // 2. Try platform_user_id match (for repeat meetings)
  if (!personId && person.platform_user_id) {
    const byPlatform = await supabase
      .from("people")
      .select("id")
      .eq("account_id", account_id)
      .contains("contact_info", {
        [person.platform]: { user_id: person.platform_user_id }
      })
      .single()
    if (byPlatform.data) personId = byPlatform.data.id
  }

  // 3. Fallback to fuzzy name match
  if (!personId) {
    const byName = await supabase
      .from("people")
      .select("id")
      .eq("account_id", account_id)
      .ilike("name", `%${person.person_name}%`)
      .limit(1)
    if (byName.data?.[0]) personId = byName.data[0].id
  }

  // 4. Create new person with enriched data
  if (!personId) {
    const newPerson = await supabase.from("people").insert({
      account_id,
      project_id,
      name: person.person_name,
      primary_email: person.email,
      role: person.role,
      person_type: person.role === 'interviewer' ? 'internal' : null,
      contact_info: person.platform_user_id ? {
        [person.platform]: { user_id: person.platform_user_id }
      } : null,
      source: "desktop_meeting",
    }).select("id").single()

    personId = newPerson.data.id
  }

  peopleMap.set(person.person_key, personId)
}
```

**Benefits**:
- Email matching enables cross-meeting person identity
- Platform user ID enables repeat meeting detection
- Creates richer person records from the start

### Phase 4: Realtime Evidence Persistence - Link to People

**File**: `app/routes/api.desktop.realtime-evidence.ts` (lines 150+)

**Current**: Evidence is persisted but not linked to people

**Enhancement**:
```typescript
// After extracting evidence (line 150+)
const people = result.people
const peopleMap = new Map<string, string>() // person_key -> person_id

// Resolve people incrementally during meeting
for (const person of people) {
  // Try to find/create person (simplified version of finalize logic)
  const { data: existing } = await supabase
    .from("people")
    .select("id")
    .eq("account_id", account_id)
    .ilike("name", `%${person.person_name}%`)
    .single()

  if (existing) {
    peopleMap.set(person.person_key, existing.id)
  } else {
    // Create provisional person record
    const { data: newPerson } = await supabase
      .from("people")
      .insert({
        account_id,
        project_id,
        name: person.person_name,
        role: person.role,
        person_type: person.role === 'interviewer' ? 'internal' : null,
        source: "desktop_realtime",
      })
      .select("id")
      .single()

    if (newPerson) {
      peopleMap.set(person.person_key, newPerson.id)
    }
  }
}

// When persisting evidence, link to person
for (const ev of evidence) {
  const personId = peopleMap.get(ev.person_key)

  await supabase.from("evidence").insert({
    // ... existing fields ...
    person_id: personId,  // NEW: link to people table
    person_key: ev.person_key,  // NEW: keep for batch merge
  })
}
```

**Why this matters**:
- Evidence is attributed to people even during live meeting
- When batch analysis runs, it can merge using `person_key` matching
- No orphaned evidence

---

## Data Flow Diagram

### Before (Current)

```
Recall SDK → Desktop → Utterances → Realtime API → GPT-4o-mini → Evidence
                                                          ↓
                                            speaker_label: "SPEAKER 2" ❌
```

### After (Proposed)

```
Recall SDK → Desktop → knownSpeakers roster
              ↓              ↓
          Utterances → knownSpeakers → Realtime API → GPT-4o-mini
                                                          ↓
                                                  People[] + Evidence[]
                                                  person_key: "participant-1" ✅
                                                          ↓
                                                  Find/Create People
                                                          ↓
                                                  Link Evidence → person_id
```

### Batch Merge (Existing Orchestrator)

```
Interview (status: complete) → Trigger.dev Orchestrator
                                     ↓
                              BAML Extraction
                              (full transcript)
                                     ↓
                              People[] + Evidence[]
                              person_key: "participant-1"
                                     ↓
                            Match realtime evidence
                            by person_key + gist similarity
                                     ↓
                            Merge/deduplicate
                            Enrich with facets
```

---

## Implementation Checklist

### Desktop (`desktop/src/main.js`)

- [ ] Add `knownSpeakers` map to meeting state
- [ ] Seed with logged-in user as "interviewer"
- [ ] Update `processParticipantJoin()` to populate roster
- [ ] Update `processTranscriptData()` to use `participant.id` lookup
- [ ] Pass `knownSpeakers` in `extractRealtimeEvidence()` API call
- [ ] Subscribe to `participant_events.update` and `.leave`
- [ ] Handle name changes mid-meeting (Guest → Real Name)

### Server (`app/routes/api.desktop.realtime-evidence.ts`)

- [ ] Add `knownSpeakers` to request schema
- [ ] Inject speakers context into LLM prompt
- [ ] Update response schema to include `Person[]` with `person_key`
- [ ] Update `EvidenceSchema` to require `person_key` on evidence
- [ ] Implement person resolution logic (find/create)
- [ ] Link evidence to `person_id` when persisting

### Finalize (`app/routes/api.desktop.interviews.finalize.ts`)

- [ ] Accept enhanced people array (email, platform_user_id, role)
- [ ] Implement email-based matching
- [ ] Implement platform_user_id matching
- [ ] Store `contact_info` JSONB with platform identifiers
- [ ] Set `person_type='internal'` for interviewers
- [ ] Trigger segment inference if title is present

### Recall Token (`app/routes/api.desktop.recall-token.ts`)

- [ ] Subscribe to `participant_events.leave`
- [ ] Subscribe to `participant_events.update`

---

## Testing Plan

### Test Case 1: Solo Call (Single Speaker)

**Setup**: User starts Google Meet alone

**Expected**:
- `knownSpeakers['self'] = { name: "Richard Moy", role: "interviewer" }`
- Evidence: `person_key: "interviewer-1"`, `speaker_label: "Richard Moy"`
- Database: Person created with `role='interviewer'`, `person_type='internal'`

### Test Case 2: Two-Person Call

**Setup**: User + 1 external participant

**Expected**:
- `knownSpeakers['self']` + `knownSpeakers[participantId]`
- Evidence: `person_key: "interviewer-1"` and `person_key: "participant-1"`
- Database: 2 people created, linked to interview via `interview_people`

### Test Case 3: Late Joiner

**Setup**: Person joins 10 minutes into meeting

**Expected**:
- `participant_events.join` triggers `processParticipantJoin()`
- Desktop sends `knownSpeakers` with new person in next batch
- New evidence uses `person_key: "participant-2"`
- Person record created retroactively

### Test Case 4: Name Resolution

**Setup**: Participant starts as "Guest", then platform identifies them

**Expected**:
- `participant_events.update` updates `knownSpeakers[participantId].name`
- Future evidence uses resolved name
- At finalize, person record has correct canonical name

### Test Case 5: Batch Merge

**Setup**: Meeting ends, batch analysis runs

**Expected**:
- Orchestrator extracts `People[]` with same `person_key` values
- Realtime evidence matches batch evidence by `person_key`
- Deduplication works correctly
- Final `people` table has 1 record per unique person (not 2)

---

## Benefits of This Approach

### 1. **Leverages Existing Infrastructure**

- Reuses proven `Person` class from BAML
- Reuses people database schema and workflows
- Reuses segment inference (`inferSegmentsTask`)
- No new patterns to maintain

### 2. **Seamless Batch Merge**

- `person_key` is the stable identifier across realtime + batch
- Evidence attribution is consistent
- No manual reconciliation needed

### 3. **Rich Person Data from Day 1**

- Email, role, platform IDs captured upfront
- Enables cross-meeting identity
- Better CRM enrichment downstream

### 4. **Improved Evidence Quality**

- Speaker labels are accurate (real names, not "SPEAKER 2")
- Role identification (interviewer vs participant) is explicit
- Attribution is traceable

### 5. **Minimal Desktop Changes**

- Desktop already captures participants (`meeting.participants[]`)
- Just need to structure it into `knownSpeakers` roster
- Pass it to API as JSON

---

## Future Enhancements

### Recall Calendar Integration

**Spec reference**: Phase 4 in `desktop-speaker-identification.md`

- Use Recall Calendar V2 to map participants → calendar invite emails
- Auto-match to existing CRM contacts
- Doesn't work 100% of the time per Recall docs
- Defer to post-MVP

### Cross-Meeting Person Identity

- Use `platform_user_id` (e.g., Zoom `conf_user_id`) for stable identity
- Aggregate insights across multiple meetings with same person
- Build longitudinal profiles

### Automatic Internal Team Detection

- If `email` matches company domain → set `person_type='internal'`
- Surface in UI: "Team member" vs "External participant"

---

## Risks and Mitigations

### Risk 1: LLM Ignores Known Speakers

**Mitigation**:
- Use stronger prompt engineering (CRITICAL, IMPORTANT keywords)
- Test with GPT-4o instead of GPT-4o-mini if needed
- Validate output: check `person_key` references match `people[]`

### Risk 2: Person Deduplication Failures

**Mitigation**:
- Prioritize email matching over fuzzy name matching
- Store platform_user_id for repeat meeting detection
- Add manual merge UI for edge cases

### Risk 3: Privacy/Compliance

**Mitigation**:
- Get user consent before capturing participant emails
- Support anonymous participant mode (opt-out of name capture)
- Document data retention policies

---

## Conclusion

The realtime evidence extraction path should adopt the exact same `Person` pattern from BAML, enabling:

1. **Accurate speaker identification** using Recall SDK participant data + logged-in user context
2. **Seamless merging** with batch analysis via stable `person_key` identifiers
3. **Reuse of existing infrastructure** (people database, segment inference, facet linking)

**Implementation complexity**: Medium (2-3 days)
**Impact**: High (fixes core UX issue + enables rich CRM features)

**Next steps**: Implement Phase 1 (desktop roster) and Phase 2 (API integration) first, validate with test cases, then add Phase 3 (enhanced finalize) and Phase 4 (evidence linking).
