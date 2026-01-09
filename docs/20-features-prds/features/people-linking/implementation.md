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

When uploading media, person linking supports multiple people:

### 1. Multiple Person Selection (`personIds` URL param)

```typescript
// User selects one or more people from multi-select dropdown
// Passed as comma-separated IDs
const personIdsParam = url.searchParams.get("personIds")
const personIds = personIdsParam ? personIdsParam.split(",").filter(Boolean) : []
```

### 2. Legacy Single Person (backwards compatible)

```typescript
// Also supports single personId or entityId for backwards compatibility
const personId = url.searchParams.get("personId")
const entityId = formData.get("entityId")?.toString()
```

### Resolution Logic

```typescript
// Resolve linked people from URL params
const personIds: string[] = personIdsParam
  ? personIdsParam.split(",").filter(Boolean)
  : personIdParam
    ? [personIdParam]
    : entityIdParam
      ? [entityIdParam]
      : []
```

### Interview Creation with Multiple People

```typescript
const { data: interview } = await adminDb
  .from("interviews")
  .insert({
    // ... other fields
    participant_pseudonym: linkedPeople[0]?.name || "Participant 1",
  })
  .select()
  .single()

// Create interview_people junction records for all linked people
for (const personId of personIds) {
  await supabase.from("interview_people").insert({
    interview_id: interview.id,
    person_id: personId,
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
- Assigning speakers to existing people via searchable dropdown
- Creating new people inline via "Create new person..." option
- Adding participants who weren't detected as speakers via search-first "Add Participant" dialog
- Setting `transcript_key` for speaker mapping

#### Add Participant Dialog (Search-First Pattern)

The "Add Participant" button opens a dialog with search-first UX:

1. **Search Mode (Default)**: Shows a searchable list of existing people in the project
   - Type to filter people by name
   - Click a person to add them as a participant
   - "Create new person..." option at bottom to switch modes

2. **Create Mode**: Form to create a new person
   - Fields: First name, Last name, Organization, Title
   - Voice input support for name entry
   - "← Back to search" button to return to search mode

This pattern prioritizes reusing existing people over creating duplicates.

### NoteViewer People Linking

**File:** `app/features/interviews/components/NoteViewer.tsx`

Notes (voice memos, text notes) display linked people with:
- Badges showing linked people names with remove buttons
- "Add Person" popover to search and select existing people
- Inline option to create new people

### Action Handler

**File:** `app/features/interviews/pages/detail.tsx` (action function)

Supports multiple intents:
- `add-participant` / `link-person` - Link existing or create new person
- `remove-participant` - Unlink a person from the interview
- `assign-participant` - Update speaker mapping

```typescript
case "add-participant":
case "link-person": {
  const createPerson = formData.get("create_person")?.toString() === "true"
  let personId = formData.get("personId")?.toString()

  // If creating new person, do that first
  if (createPerson) {
    const personName = formData.get("person_name")?.toString()?.trim()
    const { data: newPerson } = await supabase
      .from("people")
      .insert({ account_id, project_id, firstname, lastname })
      .select()
      .single()
    personId = newPerson.id
  }

  await supabase.from("interview_people").insert({
    interview_id: interviewId,
    person_id: personId,
    project_id: projectId,
    role: "participant",
  })
}
```

## Realtime Recording People Linking

### InterviewCopilot Display

**File:** `app/features/realtime/components/InterviewCopilot.tsx`

During realtime recording, linked people names are displayed:
- Fetches people details from `personIds` prop on mount
- Shows "Recording with:" badge list of linked people names
- People are passed via URL params from UploadScreen

### Realtime Finalize

**File:** `app/routes/api.interviews.realtime-finalize.tsx`

When finalizing a realtime recording:
- Accepts `personIds` array in request body
- Creates `interview_people` junction records for each person
- Triggers batch API re-transcription for proper speaker diarization

```typescript
const personIdsArray = Array.isArray(personIds) ? personIds : []
for (const personId of personIdsArray) {
  await supabase.from("interview_people").insert({
    interview_id: interviewId,
    person_id: personId,
    project_id: projectId,
    role: "participant",
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

---

## People Deduplication

The deduplication system identifies and merges duplicate person records while preserving all relationship data.

### API Endpoint

**File:** `app/features/people/api/deduplicate.tsx`

Supports three actions via POST:

| Action | Description |
|--------|-------------|
| `find` | Scans for duplicate groups, returns candidates without changes |
| `merge` | Merges specified duplicateIds into primaryId |
| `auto-merge` | Automatically merges high-confidence duplicates (dryRun: true by default) |

### Duplicate Detection Strategies

**File:** `app/features/people/deduplicate.ts`

Duplicates are detected using multiple strategies with confidence levels:

| Strategy | Match Criteria | Example |
|----------|----------------|---------|
| `email` | Exact primary_email match | "john@acme.com" appears twice |
| `linkedin` | Exact linkedin_url match | Same LinkedIn profile linked twice |
| `name_company` | Normalized name + company | "John Smith" + "ACME Inc" |
| `firstname_company` | First name + company (catches partial names) | "John" and "John Smith" both at "ACME" |
| `placeholder_name` | Generic names like "Participant 1", "Speaker 2" | Groups all placeholder names together |

```typescript
// Placeholder name detection
function isPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return false
  const normalized = normalize(name)
  return /^(participant|speaker|interviewee|respondent|user|person|unknown)\s*\d*$/i.test(normalized)
}
```

### Merge Process

When merging duplicates, all relationships are transferred to the primary record:

1. **interview_people** - Interview associations
2. **evidence_people** - Evidence links
3. **person_facet** - Facet data (uses composite key: person_id + facet_account_id)
4. **people_personas** - Persona associations (uses composite key: person_id + persona_id)
5. **people_organizations** - Organization links
6. **asset_people** - Asset associations

```typescript
// Example: Transfer people_personas (composite primary key)
for (const pp of existingPersonaLinks) {
  await supabase.from("people_personas").delete()
    .eq("person_id", duplicateId)
    .eq("persona_id", pp.persona_id)

  await supabase.from("people_personas").insert({
    person_id: primaryId,
    persona_id: pp.persona_id,
  })
}
```

After relationship transfer, duplicate records are deleted.

### Inline Editing Conflict Handling

**File:** `app/features/people/api/update-inline.tsx`

When inline editing triggers a unique constraint violation (name + company already exists), a 409 response guides users to use deduplication:

```typescript
if (errorMessage.includes("uniq_people_account_name") ||
    errorMessage.includes("duplicate key")) {
  return Response.json(
    { error: "A person with this name already exists at this company. Use the deduplication feature to merge duplicate records." },
    { status: 409 }
  )
}
```
