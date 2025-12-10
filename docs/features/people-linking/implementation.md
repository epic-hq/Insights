# People Linking Implementation

Technical implementation details for the people-linking feature.

## Database Schema

### `interview_people` Junction Table

```sql
CREATE TABLE interview_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'participant',        -- participant, interviewer, observer
  transcript_key TEXT,                     -- AssemblyAI speaker label: "SPEAKER A", "SPEAKER B"
  display_name TEXT,                       -- Optional override for this interview
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(interview_id, person_id)
);
```

### `people` Table (relevant fields)

```sql
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,                            -- Organization name
  segment TEXT,                            -- User segment/category
  description TEXT,
  contact_info JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Upload Flow Person Resolution

**File:** `app/routes/api.onboarding-start.tsx`

When uploading media, person linking happens in two ways:

### 1. Existing Person Selection (`personId` URL param)

```typescript
// User selects existing person from dropdown
const personId = url.searchParams.get("personId")
```

### 2. New Contact Creation (`entityId` form data)

```typescript
// User creates new contact via dialog, entityId is the new person's ID
const entityId = formData.get("entityId")?.toString()
```

### Resolution Logic

```typescript
// Resolve linked person from either source
let linkedPerson = null
const personIdToResolve = personId || entityId

if (personIdToResolve) {
  const { data: person } = await supabase
    .from("people")
    .select("id, name, project_id, company")
    .eq("id", personIdToResolve)
    .maybeSingle()

  linkedPerson = person
}
```

### Interview Creation with Person Link

```typescript
const { data: interview } = await adminDb
  .from("interviews")
  .insert({
    // ... other fields
    participant_pseudonym: linkedPerson?.name || "Participant 1",
    person_id: linkedPerson?.id || undefined,  // Direct FK link
  })
  .select()
  .single()

// Also create interview_people junction record
if (linkedPerson?.id) {
  await adminDb.from("interview_people").insert({
    interview_id: interview.id,
    person_id: linkedPerson.id,
    project_id: projectId,
    role: "participant",
  })
}
```

## Speaker Label Mapping

### AssemblyAI Speaker Labels

AssemblyAI's speaker diarization produces labels like:
- `SPEAKER A`
- `SPEAKER B`
- `SPEAKER C`

These are stored in `interview_people.transcript_key` to map speakers to people.

### BAML Evidence Extraction

**File:** `baml_src/extract_evidence.baml`

The AI extraction uses a `Person` class:

```baml
class Person {
  speaker_label string @description("AssemblyAI speaker label, e.g., 'SPEAKER A'")
  person_key string @description("Deterministic slug: 'participant-1', 'interviewer-1'")
  name string? @description("Inferred name if mentioned in transcript")
  role string @description("participant, interviewer, etc.")
}
```

### Linking Evidence to People

When evidence is extracted, `speaker_label` can be matched to `interview_people.transcript_key`:

```typescript
// Find person for a speaker label
const participant = participants.find(
  p => p.transcript_key === evidence.person?.speaker_label
)
```

## Post-Upload Linking

### ManagePeopleAssociations Component

**File:** `app/features/interviews/components/ManagePeopleAssociations.tsx`

Provides UI for:
- Viewing current speaker-to-person mappings
- Assigning speakers to existing people
- Creating new people and linking them
- Setting `transcript_key` for speaker mapping

### Action Handler

**File:** `app/features/interviews/pages/detail.tsx` (action function)

```typescript
case "linkParticipant": {
  const personId = formData.get("personId")?.toString()
  const transcriptKey = formData.get("transcriptKey")?.toString()
  const role = formData.get("role")?.toString() || "participant"

  await supabase.from("interview_people").upsert({
    interview_id: interviewId,
    person_id: personId,
    project_id: projectId,
    role,
    transcript_key: transcriptKey,
  }, {
    onConflict: "interview_id,person_id"
  })
}
```

## Interview Detail Display

**File:** `app/features/interviews/pages/detail.tsx`

### Fetching Participants

Uses `getInterviewParticipants` from `app/features/interviews/db.ts`:

```typescript
const { data: participants } = await getInterviewParticipants({
  supabase,
  projectId,
  interviewId,
})
```

### Display Logic

```tsx
{participants.map((participant) => {
  const person = participant.people
  const displayName = person?.name || participant.display_name || "Participant"

  return (
    <div key={participant.id}>
      {person?.id ? (
        <Link to={routes.people.detail(person.id)}>
          {displayName}
        </Link>
      ) : (
        <span>{displayName}</span>
      )}
      {person?.company && (
        <span className="text-muted-foreground">({person.company})</span>
      )}
    </div>
  )
})}
```

### Fallback Display

When no `interview_people` records exist:

```tsx
{interview.participant_pseudonym &&
 interview.participant_pseudonym !== "Anonymous" &&
 interview.participant_pseudonym !== "Participant 1" && (
  <span>{interview.participant_pseudonym}</span>
)}
```

## Database Queries

### Get Interview Participants

**File:** `app/features/interviews/db.ts`

```typescript
export const getInterviewParticipants = async ({
  supabase,
  projectId,
  interviewId,
}) => {
  return await supabase
    .from("interview_people")
    .select(`
      role,
      id,
      transcript_key,
      display_name,
      people(
        project_id,
        id,
        name,
        segment,
        company,
        description,
        contact_info,
        people_personas (
          persona_id,
          personas (id, name, color_hex)
        )
      )
    `)
    .eq("project_id", projectId)
    .eq("interview_id", interviewId)
}
```

## Troubleshooting

### Person Not Linked During Upload

**Symptom:** User creates new contact during upload but person isn't linked.

**Cause:** The `entityId` from the new contact dialog wasn't being resolved.

**Fix:** Modified `api.onboarding-start.tsx` to check both `personId` (URL param) and `entityId` (form data).

### Speaker Labels Not Showing

**Symptom:** Transcript has speaker labels but they're not mapped to people.

**Cause:** `interview_people.transcript_key` not populated.

**Fix:** Use ManagePeopleAssociations UI to map speakers, or ensure upload flow sets transcript_key when creating interview_people records.

### Display Shows "Participant 1"

**Symptom:** Generic name shown instead of actual person name.

**Cause:** Either:
1. No `interview_people` record exists
2. The linked person has no name
3. `participant_pseudonym` wasn't set properly

**Fix:** Check that person resolution happened during upload and that the person record has a name.

## Future Improvements

### Option C: Simplify the Data Model (Medium Refactor)

The current system has three overlapping speaker identification systems:

| Source | Example | Purpose |
|--------|---------|---------|
| **AssemblyAI** | `SPEAKER A`, `SPEAKER B` | Raw transcript diarization labels |
| **BAML AI extraction** | `participant-1`, `interviewer-1` | Deterministic slugs generated during evidence extraction |
| **User-entered** | `Athena Sees` | Actual person names from upload or manual linking |

**Proposed simplification:**

1. Drop `transcript_key` field or make it AssemblyAI-only
2. Use `person_key` from BAML evidence extraction as the primary linking mechanism
3. Simplify `interview_people` to just: `interview_id`, `person_id`, `role`
4. Auto-create `interview_people` records during evidence extraction when AI identifies speakers
5. Store BAML's `person_key` mapping in a new `evidence_speakers` table

**Files to modify:**
- `supabase/schemas/` - Schema changes
- `baml_src/extract_evidence.baml` - Update Person class
- `src/trigger/interview/v2/generateInsights.ts` - Auto-create mappings
- `app/features/interviews/components/ManagePeopleAssociations.tsx` - Simplified UI

### Option D: Auto-Link on Evidence Extraction

During the `generateInsights` Trigger.dev task, when AI extracts `Person` entities:

1. If `inferred_name` matches an existing person in the project → auto-link via `interview_people`
2. If no match, create placeholder `interview_people` records with role/display_name from AI
3. Link evidence to speakers via `evidence_people` junction

This removes the manual linking burden and ensures every interview has speaker records after processing.

**Implementation steps:**
1. In `generateInsights.ts`, after evidence extraction:
   - Query existing people for name matches
   - Create/upsert `interview_people` records for each detected speaker
   - Store speaker → evidence mapping
2. Update `ManagePeopleAssociations` to show auto-detected speakers for review
3. Add "merge speakers" functionality for when AI creates duplicates

### Other Improvements

- **Auto-detection of speaker names** - Use transcript content to infer names when speakers introduce themselves
- **Bulk speaker mapping** - Map multiple interviews at once for recurring participants
- **Speaker voice fingerprinting** - Match speakers across interviews by voice characteristics
- **Interview templates** - Pre-define expected participants for recurring interview types
