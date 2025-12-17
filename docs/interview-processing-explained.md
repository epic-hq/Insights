# Interview Processing: How It Works

## Simple Explanation (8th Grade Level)

When you upload an interview recording, our system does three main things:

### 1. **Listen and Write Down** (Transcription)
First, we convert your audio/video into text - like having someone type out everything that was said. This gives us a written transcript of the conversation.

### 2. **Find Important Moments** (Evidence Extraction)
Next, we read through the transcript and pull out the important parts - like when someone says they're frustrated, what they want to achieve, or how they currently do things. We call these important moments "evidence." Each piece of evidence is like a highlighted quote with context.

### 3. **Understand the Person** (Facet Analysis)
Finally, we look at all the evidence together to understand who the person is - what motivates them, what problems they face, what they value, and how they behave. We organize this into "facets" (personality traits and characteristics) that help you understand your users better.

Think of it like this:
- **Transcription** = Writing down what someone said
- **Evidence** = Highlighting the important parts
- **Facets** = Understanding who they are based on what they said

---

## Technical Overview

### Architecture

The interview processing pipeline has **3 phases**:

```
Phase 0: Transcription (AssemblyAI)
   ↓
Phase 1: Evidence Extraction (BAML + GPT-4)
   ↓
Phase 2: Persona Synthesis (BAML + GPT-4)
   ↓
Database: Store everything
```

### Phase 0: Transcription

**Input:** Audio/video file  
**Output:** Formatted transcript with speaker labels and timestamps  
**Technology:** AssemblyAI API

**What happens:**
1. Upload media file to AssemblyAI
2. Wait for transcription to complete
3. Download formatted transcript with:
   - Speaker labels (SPEAKER 1, SPEAKER 2, etc.)
   - Timestamps for each utterance
   - Chapter markers (if available)
4. Store in `interviews.transcript_formatted`

### Phase 1: Evidence Extraction

**Input:** Formatted transcript + facet catalog  
**Output:** Evidence units + people + facet mentions  
**Technology:** BAML (BoundaryML) + GPT-4  
**File:** `baml_src/extract_evidence.baml`

**What happens:**
1. **Identify People**: Extract all speakers from transcript
   - Assign stable `person_key` (e.g., "participant-1", "interviewer-1")
   - Infer names and roles when possible
   - Detect organizations and segments

2. **Extract Evidence Units**: Slice transcript into meaningful chunks
   - Each unit = 2-5 sentences expressing one idea
   - Include: gist (headline), chunk (context), verbatim (quote)
   - Tag with: topic, anchors (timestamps), confidence
   - Link to speaker via `person_key`

3. **Identify Facet Mentions**: Tag evidence with facet types
   - Match against facet catalog (goals, pains, workflows, etc.)
   - Record: kind_slug, value, confidence
   - Link to evidence unit via index

4. **Store in Database**:
   - Insert people records → `people` table
   - Insert evidence → `evidence` table (embeddings generated async via queue)
   - Insert facet mentions → `evidence_facet` table (junction)
   - Link evidence to people → `interview_people` table (junction)

   > **Note:** Evidence embeddings are generated asynchronously via DB trigger → pgmq queue → edge function. This happens within ~1 minute of insertion. See `supabase/schemas/50_queues.sql` for the trigger definition.

**Key Data Structure:**
```typescript
{
  people: [
    {
      person_key: "participant-1",
      display_name: "SPEAKER 2",
      inferred_name: "Sarah",
      role: "participant"
    }
  ],
  evidence: [
    {
      person_key: "participant-1",
      gist: "Frustrated with manual data entry",
      chunk: "I spend 3 hours every day copying data...",
      verbatim: "It's so tedious and error-prone",
      facet_mentions: [
        { kind_slug: "pain", value: "manual data entry" },
        { kind_slug: "workflow", value: "daily reporting" }
      ]
    }
  ]
}
```

### Phase 2: Persona Synthesis

**Input:** Evidence units + facet mentions  
**Output:** Synthesized persona facets  
**Technology:** BAML + GPT-4  
**File:** `baml_src/transcript-analysis/2.derive_persona_facets.baml`

**What happens:**
1. **Group by Person**: Cluster all evidence by `person_key`

2. **Identify Patterns**: Look for recurring themes
   - Consistent attitudes
   - Stated values
   - Behavioral habits
   - Motivations

3. **Promote to Traits**: Elevate mentions to stable characteristics
   - Merge similar mentions
   - Calculate confidence based on frequency
   - Link to supporting evidence

4. **Store in Database**:
   - Insert facets → `person_facet` table
   - Link to facet definitions → `facet_account` table (via `facet_account_id`)
   - Link to evidence → via `evidence_id`

**Key Data Structure:**
```typescript
{
  persona_facets: [
    {
      person_key: "participant-1",
      kind_slug: "motivation",
      value: "values efficiency and automation",
      facet_account_id: 123, // Links to existing facet
      evidence_refs: [0, 3, 7], // Indices of supporting evidence
      confidence: 0.9,
      reasoning: "Mentioned automation 3 times..."
    }
  ]
}
```

---

## Database Schema

### Core Tables

**`people`** - Individual participants
- `id` (PK)
- `name`, `description`, `segment`
- `account_id`, `project_id`

**`evidence`** - Important moments from interviews
- `id` (PK)
- `gist`, `chunk`, `verbatim`
- `topic`, `anchors`, `confidence`
- `account_id`, `project_id`

**`facet_account`** - Facet definitions (traits, characteristics)
- `id` (PK)
- `kind_id` → `facet_kind_global.id`
- `label`, `slug`, `synonyms`
- `is_active` (controls visibility in new processing)
- `account_id`

**`person_facet`** - Links people to their traits
- `person_id` → `people.id`
- `facet_account_id` → `facet_account.id`
- `evidence_id` → `evidence.id` (supporting evidence)
- `confidence`, `source`, `noted_at`

**`evidence_facet`** - Links evidence to facet types
- `evidence_id` → `evidence.id`
- `facet_account_id` → `facet_account.id`
- `kind_slug`, `label`

### Junction Tables

**`interview_people`** - Links interviews to participants
- `interview_id` → `interviews.id`
- `person_id` → `people.id`
- `transcript_key` (matches `person_key` from BAML)
- `display_name`, `role`

---

## Key Concepts

### Facets

**What are facets?**
Facets are reusable labels for describing people. Think of them as tags or characteristics.

**Types of facets (kinds):**
- **goal** - What they want to achieve
- **pain** - Problems they face
- **workflow** - How they do things
- **motivation** - What drives them
- **value** - What they care about
- **skill** - What they're good at
- **preference** - What they like/dislike
- **constraint** - Limitations they face

**Facet Lifecycle:**
1. **Extraction**: LLM identifies facet mentions in evidence
2. **Matching**: Check if facet exists in catalog
3. **Creation**: If new, create with `is_active = false`
4. **Activation**: User reviews and activates useful facets
5. **Reuse**: Active facets appear in future interview processing

### Evidence Facet Kinds (`evidenceFacetKinds`)

**Purpose:** Categorize evidence for empathy map and research answers

**How it works:**
- Each evidence unit is tagged with facet kinds (e.g., ["pain", "workflow"])
- These tags determine which research question category the evidence belongs to
- Used to populate empathy map sections (Pains, Goals, Says, Does, etc.)

**Example:**
```typescript
// Evidence unit about manual data entry
evidenceFacetKinds[0] = ["pain", "workflow"]
// → This evidence goes into "Pains" section of empathy map
// → Also linked to "What are their pain points?" research question
```

**Category Mapping:**
```typescript
const categoryAlias = new Map([
  ["pain", "pains"],
  ["frustration", "pains"],
  ["goal", "goals"],
  ["motivation", "goals"],
  ["workflow", "behaviors"],
  ["habit", "behaviors"],
  ["demographic", "demographics"],
])
```

### Person Keys

**What is a `person_key`?**
A stable identifier for each speaker in the transcript (e.g., "participant-1", "interviewer-1").

**Why do we need it?**
- Transcripts use generic labels like "SPEAKER 1", "SPEAKER 2"
- We need consistent IDs to link evidence across the interview
- `person_key` stays the same even if speaker labels change

**Flow:**
```
Transcript: "SPEAKER 2: I'm frustrated..."
   ↓
Phase 1: Assign person_key = "participant-1"
   ↓
Database: Create person record, store person_key in interview_people.transcript_key
   ↓
Phase 2: Use person_key to group facets by person
   ↓
Final: Link facets to person_id via person_key lookup
```

---

## Code Flow

### Entry Points

**1. Upload Flow** (New interview)
- Route: `/api/upload-file`
- Triggers: `uploadMediaAndTranscribe` (Trigger.dev task)
- Calls: `processInterview.server.ts`

**2. Retry Analysis** (Re-process existing interview)
- Route: `/api/analysis-retry`
- Calls: `createAndProcessAnalysisJob()`
- Calls: `processInterview.server.ts`

**3. Webhook Flow** (AssemblyAI callback)
- Route: `/api/assemblyai-webhook`
- Triggers: `extractEvidenceAndPeople` (Trigger.dev task)
- Calls: `processInterview.server.ts`

### Main Processing Function

**File:** `app/utils/processInterview.server.ts`

**Function:** `extractEvidenceAndPeopleCore()`

**Steps:**
1. Load facet catalog from database
2. Call BAML Phase 1: Extract evidence + people
3. Store evidence in database, capture IDs
4. Build facet lookup map
5. Process facet mentions, create/match facets
6. Call BAML Phase 2: Synthesize persona facets
7. Create person records in database
8. Link evidence to people
9. Store persona facets with evidence links
10. Return results

**Key Variables:**
- `participantByKey` - Map of person_key → participant data
- `personIdByKey` - Map of person_key → database person.id
- `facetLookup` - Map of kind+label → facet metadata
- `personaFacetsByPersonKey` - Map of person_key → synthesized facets
- `evidenceFacetKinds` - Array of kind slugs per evidence unit

---

## Current Issues & Solutions

### Issue 1: Facets Only for Primary Participant

**Problem:** All facets are assigned to "Person 0" instead of their actual speakers.

**Root Cause:** When `person_key` from Phase 2 doesn't match `personIdByKey`, code was falling back to `primaryPersonId`.

**Solution:** 
- Changed line 1376 to skip facets without matching person records
- Added debug logging to identify mismatches
- Need to verify BAML is extracting all speakers correctly

**Code Change:**
```typescript
// Before
const personId = personIdByKey.get(personKey) || primaryPersonId

// After
const personId = personIdByKey.get(personKey)
if (!personId) {
  consola.warn(`⚠️  Skipping facets for person_key "${personKey}"`)
  continue
}
```

### Issue 2: Inactive Facets Not Showing

**Problem:** Person detail pages showed "ID:661" instead of facet labels.

**Root Cause:** `getFacetCatalog()` filtered out `is_active = false` facets.

**Solution:** Include all facets in catalog for display purposes.

**Code Change:**
```typescript
// Before
for (const row of accountRows ?? []) {
  if (row.is_active === false) continue // ❌ Hid inactive facets
  entries.set(row.id, { ... })
}

// After
for (const row of accountRows ?? []) {
  // Include all facets for display
  entries.set(row.id, { ... })
}
```

### Issue 3: Evidence Count Not Updating

**Status:** Should auto-update via revalidation (line 745 in detail.tsx)

**If not working:**
- Check browser console for errors
- Verify `progressInfo.isComplete` is true
- Check if loader is being called
- Try hard refresh (Cmd+Shift+R)

---

## Testing & Debugging

### Debug Logging

When you run "Retry Analysis", watch for these console logs:

```
📋 Phase 1 extracted 2 people from transcript
👥 Processing 2 participants for person records
  - Creating person record for "participant-1" (role: participant)
  - Creating person record for "interviewer-1" (role: interviewer)
🎯 Processing facets for 2 person_keys
  - personaFacetsByPersonKey has keys: ["participant-1", "interviewer-1"]
  - participantByKey has keys: ["participant-1", "interviewer-1"]
  - personIdByKey has keys: ["participant-1", "interviewer-1"]
✅ Phase 2 complete: Synthesized 15 persona facets for 2 people
```

**Warning to watch for:**
```
⚠️  Skipping facets for person_key "participant-2" - no matching person record found
```

This means Phase 2 is using a `person_key` that doesn't exist in Phase 1.

### Manual Verification

**Check people were created:**
```sql
SELECT id, name, role 
FROM people 
WHERE project_id = 'your-project-id'
ORDER BY created_at DESC;
```

**Check facets were assigned:**
```sql
SELECT p.name, fa.label, pf.confidence
FROM person_facet pf
JOIN people p ON p.id = pf.person_id
JOIN facet_account fa ON fa.id = pf.facet_account_id
WHERE pf.project_id = 'your-project-id'
ORDER BY p.name, fa.label;
```

**Check evidence was created:**
```sql
SELECT e.gist, ef.label as facet_label
FROM evidence e
LEFT JOIN evidence_facet ef ON ef.evidence_id = e.id
WHERE e.project_id = 'your-project-id'
ORDER BY e.created_at DESC
LIMIT 10;
```

---

## Future Improvements

### Short Term
1. **Fix multi-speaker facet assignment** - Ensure all speakers get their facets
2. **Add facet activation UI** - Let users toggle `is_active` flag
3. **Improve evidence categorization** - Better mapping to research questions

### Medium Term
1. **Centralize in Trigger.dev** - Move all processing to async tasks
2. **Fix index-based pairing** - Use evidence IDs instead of array indices
3. **Add facet merging UI** - Let users combine duplicate facets

### Long Term
1. **Real-time processing** - Show evidence as it's extracted
2. **Facet suggestions** - Recommend facets based on project context
3. **Cross-interview synthesis** - Identify patterns across multiple interviews

---

## Related Files

**BAML Schemas:**
- `baml_src/extract_evidence.baml` - Phase 1 extraction
- `baml_src/transcript-analysis/2.derive_persona_facets.baml` - Phase 2 synthesis

**Processing Logic:**
- `app/utils/processInterview.server.ts` - Main orchestration
- `app/utils/processInterviewAnalysis.server.ts` - Job management
- `app/lib/database/facets.server.ts` - Facet CRUD operations

**Database:**
- `supabase/schemas/12_core_tables.sql` - Table definitions
- `supabase/migrations/20251024154750_simplify_facets.sql` - Recent migration

**UI:**
- `app/features/interviews/pages/detail.tsx` - Interview detail page
- `app/features/people/pages/detail.tsx` - Person detail page
- `app/features/evidence/pages/index.tsx` - Evidence list page

**API Routes:**
- `app/routes/api.upload-file.tsx` - Upload handler
- `app/routes/api.analysis-retry.tsx` - Retry handler
- `app/routes/api.assemblyai-webhook.tsx` - Webhook handler

**Trigger.dev Tasks:**
- `src/trigger/interview/uploadMediaAndTranscribe.ts` - Phase 0
- `src/trigger/interview/extractEvidenceAndPeople.ts` - Phase 1 & 2
- `src/trigger/interview/analyzeThemesAndPersona.ts` - Phase 3 (themes)
