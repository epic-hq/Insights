# People Pipeline Integration - REVISED ARCHITECTURE
## API-First Approach for Desktop → Web Communication

**Bead**: Insights-32v
**Date**: 2026-02-07
**Status**: Revised Specification (Post-Agent Review)
**Reviewers**: Winston (Architect), Amelia (Developer), Murat (Test Architect)

---

## Executive Summary

**Original Approach**: Have desktop mimic BAML pattern directly
**Revised Approach**: Desktop calls web app APIs; web app owns person resolution using proven Trigger.dev/BAML patterns

### Key Architectural Decisions

1. **Source of Truth**: Trigger.dev/BAML pipeline = proven, working pattern
2. **Desktop Role**: POC that should conform to web app standards via API calls
3. **Data Flow**: Desktop (Recall SDK) → Web APIs → Shared person resolution logic
4. **Primary Data Source**: Desktop captures richer participant data (email, platform IDs) from Recall SDK
5. **Code Sharing**: Extract `upsertPersonWithCompanyAwareConflict` into reusable module used by all paths

### Critical Findings from Agent Review

**Winston (Architecture)**:
- ❌ Current desktop uses raw insert instead of upsert → causes duplicate constraint violations
- ✅ Existing `upsertPersonWithCompanyAwareConflict` handles conflicts correctly
- ❌ Unique constraint on (name_hash + company + email) breaks when both emails are null

**Amelia (Development)**:
- ❌ Zero tests for `api.desktop.realtime-evidence.ts`
- ❌ `person_key` not in current desktop schema
- ❌ No schema validation between realtime and batch paths

**Murat (Testing)**:
- ❌ No idempotency guarantees for person creation on retry
- ❌ Realtime + batch paths will conflict without shared upsert
- ❌ No tests for concurrent person creation

---

## Current State Analysis

### Desktop App People Handling

**Data Collected from Recall SDK** (not currently sent to web):
- `participant.id` - Platform-specific participant ID
- `participant.name` - Real name from platform
- `participant.email` - Email (if available via Calendar Integration)
- `participant.is_host` - Host/guest status
- `participant.platform` - "google-meet", "zoom", etc.
- `participant.extra_data` - Platform-specific IDs (Zoom `conf_user_id`, Teams `user_id`)

**Current Flow**:
1. Desktop stores participants locally
2. Real-time evidence extraction calls `/api/desktop/realtime-evidence`
3. AI extracts `{ person_key, person_name }` from transcript
4. At meeting end, `/api/desktop/interviews/finalize` receives `people[]` array
5. Web does **fuzzy name match** or **raw insert** (no upsert)

**Problems**:
- Desktop collects rich data (email, platform IDs) but never sends it
- No connection between Recall participants and AI-extracted people
- Raw insert causes constraint violations on retry
- No email-based matching for cross-meeting identity

### Web App People Handling (Proven Pattern)

**Trigger.dev/BAML Pipeline**:
1. BAML extracts `RawPeople[]` with `person_key`, `person_name`, `role`, etc.
2. `mapRawPeopleToInterviewLinks()` filters placeholders
3. `upsertPersonWithCompanyAwareConflict()` handles duplicates via:
   - Try insert
   - Catch constraint violation (code 23505)
   - Find existing by (name_hash + company + email)
   - Fallback to broader search
4. Creates `interview_people` junction with `transcript_key`
5. Auto-triggers `people.infer-segments` task

**Existing APIs**:
- `/a/:accountId/api/people/search` - Search by name/email/company
- `/a/:accountId/:projectId/people/api/update-inline` - Update person fields
- `/a/:accountId/:projectId/people/api/deduplicate` - Find/merge duplicates
- `/a/:accountId/:projectId/people/api/infer-segments` - Trigger segment inference

---

## Revised Architecture: API-First Approach

### Design Principle

**Desktop** = Data collector (Recall SDK participants + AI-extracted mentions)
**Web** = Single source of truth for person resolution, deduplication, storage

### Phase 1: Create Shared Person Resolution Module

**Goal**: Extract proven logic into reusable module

**File**: `app/lib/people/resolution.server.ts` (NEW)

```typescript
export interface PersonResolutionInput {
  // Core identity
  firstname?: string
  lastname?: string
  name?: string  // Full name fallback

  // Contact info
  primary_email?: string
  primary_phone?: string

  // Organization
  company?: string
  title?: string

  // Platform identity (for cross-meeting matching)
  platform?: string
  platform_user_id?: string

  // Metadata
  role?: string  // 'interviewer' | 'participant'
  person_type?: 'internal' | null
  source: string  // 'desktop_meeting' | 'baml_extraction' | 'manual'
}

export interface PersonResolutionResult {
  person: {
    id: string
    name: string | null
    created: boolean  // True if newly created
  }
  matchedBy: 'email' | 'platform_id' | 'name_company' | 'created'
}

/**
 * Unified person resolution used by all paths:
 * - Desktop finalize
 * - Realtime evidence extraction
 * - BAML extraction
 * - Manual import
 */
export async function resolveOrCreatePerson(
  supabase: SupabaseClient,
  accountId: string,
  projectId: string,
  input: PersonResolutionInput
): Promise<PersonResolutionResult> {
  // 1. Email match (highest priority)
  if (input.primary_email) {
    const existing = await findByEmail(supabase, accountId, input.primary_email)
    if (existing) {
      return { person: existing, matchedBy: 'email' }
    }
  }

  // 2. Platform user ID match (for repeat meetings)
  if (input.platform && input.platform_user_id) {
    const existing = await findByPlatformId(
      supabase,
      accountId,
      input.platform,
      input.platform_user_id
    )
    if (existing) {
      return { person: existing, matchedBy: 'platform_id' }
    }
  }

  // 3. Name + company fuzzy match
  const name = input.name || `${input.firstname || ''} ${input.lastname || ''}`.trim()
  if (name) {
    const existing = await findByNameCompany(
      supabase,
      accountId,
      name,
      input.company
    )
    if (existing) {
      return { person: existing, matchedBy: 'name_company' }
    }
  }

  // 4. Create new person with full data
  const person = await upsertPersonWithCompanyAwareConflict(
    supabase,
    {
      account_id: accountId,
      project_id: projectId,
      firstname: input.firstname,
      lastname: input.lastname,
      name,
      primary_email: input.primary_email,
      primary_phone: input.primary_phone,
      company: input.company || '',
      title: input.title,
      role: input.role,
      person_type: input.person_type,
      contact_info: input.platform_user_id ? {
        [input.platform]: { user_id: input.platform_user_id }
      } : null,
      source: input.source,
    },
    input.person_type
  )

  return { person: { ...person, created: true }, matchedBy: 'created' }
}
```

**Benefits**:
- ✅ Single resolution logic used everywhere
- ✅ Email match prevents duplicates
- ✅ Platform ID enables cross-meeting identity
- ✅ Upsert handles constraint violations
- ✅ Returns `created` flag for analytics

### Phase 2: Create Desktop People Resolution API

**Goal**: Give desktop a dedicated endpoint for person operations

**File**: `app/routes/api.desktop.people.resolve.ts` (NEW)

```typescript
/**
 * POST /api/desktop/people/resolve
 *
 * Resolves people from desktop meetings using Recall SDK data + AI extraction.
 * Returns person IDs for linking evidence and tasks.
 */

interface ResolvePersonRequest {
  accountId: string
  projectId: string
  people: Array<{
    // From AI extraction
    person_key: string
    person_name: string
    role?: string

    // From Recall SDK (NEW - desktop will send this)
    recall_participant_id?: string
    recall_platform?: string
    email?: string
    is_host?: boolean
  }>
}

interface ResolvePersonResponse {
  resolved: Array<{
    person_key: string
    person_id: string
    matched_by: string
    created: boolean
  }>
  errors: Array<{
    person_key: string
    error: string
  }>
}

export async function action({ request }: ActionFunctionArgs) {
  const auth = await authenticateDesktopRequest(request)
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { accountId, projectId, people } = body

  const resolved: ResolvePersonResponse['resolved'] = []
  const errors: ResolvePersonResponse['errors'] = []

  for (const person of people) {
    try {
      const result = await resolveOrCreatePerson(
        auth.supabase,
        accountId,
        projectId,
        {
          name: person.person_name,
          primary_email: person.email,
          role: person.role,
          platform: person.recall_platform,
          platform_user_id: person.recall_participant_id,
          person_type: person.role === 'interviewer' ? 'internal' : null,
          source: 'desktop_meeting',
        }
      )

      resolved.push({
        person_key: person.person_key,
        person_id: result.person.id,
        matched_by: result.matchedBy,
        created: result.person.created,
      })
    } catch (error) {
      errors.push({
        person_key: person.person_key,
        error: error.message,
      })
    }
  }

  return Response.json({ resolved, errors })
}
```

**Why This Works**:
- ✅ Desktop sends richer data (email, platform IDs)
- ✅ Web handles all resolution logic
- ✅ Returns mapping: `person_key` → `person_id`
- ✅ Desktop can link evidence/tasks using returned IDs
- ✅ Idempotent on retry (upsert pattern)

### Phase 3: Update Desktop to Send Richer Participant Data

**File**: `desktop/src/main.js`

**Changes to `processParticipantJoin()`** (line 2290):

```javascript
async function processParticipantJoin(evt) {
  const participantData = evt.data.data.participant
  const participantId = participantData.id

  // Extract ALL available data from Recall SDK
  const participant = {
    id: participantId,
    name: participantData.name,
    email: participantData.email || null,  // NEW
    is_host: participantData.is_host,
    platform: extractPlatform(evt),
    platform_user_id: extractPlatformUserId(participantData),  // NEW
    join_time: new Date().toISOString(),
    status: 'active'
  }

  // Store locally with full data
  meeting.participants.push(participant)
}

// NEW helper
function extractPlatformUserId(participantData) {
  // Extract platform-specific stable identifiers
  const platform = participantData.platform
  const extraData = participantData.extra_data || {}

  switch (platform) {
    case 'zoom':
      return extraData.conf_user_id
    case 'teams':
      return extraData.user_id
    case 'webex':
      return extraData.webex_id
    default:
      return participantData.id  // Fallback to Recall ID
  }
}
```

**Changes to `finalizeInterview()`** (line 2497):

```javascript
async function finalizeInterview(noteId) {
  const meeting = global.meetings[noteId]
  const state = evidenceExtractionState[noteId]

  // 1. Merge Recall participants with AI-extracted people
  const peopleToResolve = mergePeopleData(
    meeting.participants,      // From Recall SDK
    state.people               // From AI extraction
  )

  // 2. Call NEW resolution API
  const resolveResponse = await fetch(`${UPSIGHT_API_URL}/api/desktop/people/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      accountId: meeting.accountId,
      projectId: meeting.projectId,
      people: peopleToResolve
    })
  })

  const { resolved, errors } = await resolveResponse.json()

  // 3. Build person_key → person_id map
  const peopleMap = new Map()
  for (const item of resolved) {
    peopleMap.set(item.person_key, item.person_id)
  }

  // 4. Continue with existing finalize flow (transcript, tasks, etc.)
  // ...
}

// NEW helper
function mergePeopleData(recallParticipants, aiPeople) {
  const merged = []

  // For each AI-extracted person, try to match with Recall participant
  for (const aiPerson of aiPeople) {
    const match = recallParticipants.find(p =>
      p.name && aiPerson.person_name &&
      p.name.toLowerCase().includes(aiPerson.person_name.toLowerCase())
    )

    merged.push({
      person_key: aiPerson.person_key,
      person_name: aiPerson.person_name,
      role: aiPerson.role,
      // Enrich with Recall data if matched
      recall_participant_id: match?.platform_user_id,
      recall_platform: match?.platform,
      email: match?.email,
      is_host: match?.is_host,
    })
  }

  return merged
}
```

**Benefits**:
- ✅ Desktop sends ALL available data to web
- ✅ Web can match by email for cross-meeting identity
- ✅ Platform IDs enable repeat participant detection
- ✅ Merges Recall SDK data with AI extraction
- ✅ Clean separation: desktop = collector, web = resolver

### Phase 4: Update BAML Pipeline to Use Shared Resolution

**File**: `src/trigger/interview/v2/extractEvidenceCore.ts`

**Replace custom upsert with shared module**:

```typescript
import { resolveOrCreatePerson } from '~/lib/people/resolution.server'

// In extractEvidenceCore() function:
for (const rawPerson of rawPeople) {
  const result = await resolveOrCreatePerson(
    supabase,
    metadata.accountId,
    metadata.projectId,
    {
      name: rawPerson.person_name,
      role: rawPerson.role,
      company: rawPerson.organization,
      person_type: rawPerson.role === 'interviewer' ? 'internal' : null,
      source: 'baml_extraction',
    }
  )

  personIdByKey.set(rawPerson.person_key, result.person.id)
}
```

**Benefits**:
- ✅ BAML uses same resolution logic as desktop
- ✅ Consistent person creation across all paths
- ✅ Easier to test (single code path)

---

## Complete Data Flow (Revised)

```
DESKTOP APP                    WEB APP                         DATABASE
══════════════════════════════════════════════════════════════════════════

Recall SDK Events
  ↓ participant_events.join
  └─ Captures FULL participant data:
     - id, name, email
     - is_host, platform
     - platform_user_id (Zoom conf_user_id, etc.)

Meeting Recording Active
  ├─ Real-time evidence extraction
  │  └─ POST /api/desktop/realtime-evidence
  │     ├─ AI extracts: { person_key, person_name, role }
  │     └─ Returns: evidence[], people[]
  │
  └─ Desktop accumulates:
     - state.people[] (AI-extracted)
     - meeting.participants[] (Recall SDK)

Meeting Ends
  ↓
  └─ mergePeopleData()
     ├─ Match AI person_name ↔ Recall participant.name
     └─ Create enriched people array:
        { person_key, person_name, role, email, platform_user_id }

POST /api/desktop/people/resolve  ← NEW ENDPOINT
  ├─ Input: enriched people array
  ├─ For each person:
  │  ├─ 1. Try email match
  │  ├─ 2. Try platform_user_id match
  │  ├─ 3. Try name+company fuzzy match
  │  └─ 4. Create new via upsertPersonWithCompanyAwareConflict()
  ├─ Returns: person_key → person_id mapping
  └─ Database:
     ├─ people table: records created/matched
     └─ contact_info JSONB: { zoom: { user_id: "..." } }

POST /api/desktop/interviews/finalize
  ├─ Uses person_key → person_id map
  ├─ Links evidence to person_id
  ├─ Links tasks to assignee person_id
  └─ Creates interview_people junction

Batch Analysis (Trigger.dev)
  ├─ BAML extracts people
  ├─ Calls shared resolveOrCreatePerson()
  ├─ Returns existing person_id (matched by name)
  └─ No duplicates created!
```

---

## Testing Strategy

### Unit Tests

**File**: `app/lib/people/resolution.server.test.ts`

```typescript
describe('resolveOrCreatePerson', () => {
  it('should match existing person by email', async () => {
    const existing = await createPerson({
      name: 'John Smith',
      primary_email: 'john@example.com'
    })

    const result = await resolveOrCreatePerson(supabase, accountId, projectId, {
      name: 'J. Smith',  // Different name
      primary_email: 'john@example.com',
      source: 'desktop_meeting'
    })

    expect(result.person.id).toBe(existing.id)
    expect(result.matchedBy).toBe('email')
    expect(result.person.created).toBe(false)
  })

  it('should match by platform_user_id for repeat meetings', async () => {
    const existing = await createPerson({
      name: 'Jane Doe',
      contact_info: { zoom: { user_id: 'zoom-12345' } }
    })

    const result = await resolveOrCreatePerson(supabase, accountId, projectId, {
      name: 'Jane D',  // Abbreviated in second meeting
      platform: 'zoom',
      platform_user_id: 'zoom-12345',
      source: 'desktop_meeting'
    })

    expect(result.person.id).toBe(existing.id)
    expect(result.matchedBy).toBe('platform_id')
  })

  it('should create new person when no match', async () => {
    const result = await resolveOrCreatePerson(supabase, accountId, projectId, {
      name: 'New Person',
      primary_email: 'new@example.com',
      source: 'desktop_meeting'
    })

    expect(result.person.id).toBeDefined()
    expect(result.matchedBy).toBe('created')
    expect(result.person.created).toBe(true)
  })

  it('should handle concurrent creation attempts (idempotency)', async () => {
    const input = {
      name: 'Concurrent Test',
      primary_email: 'concurrent@example.com',
      source: 'desktop_meeting'
    }

    // Simulate 3 simultaneous requests
    const results = await Promise.allSettled([
      resolveOrCreatePerson(supabase, accountId, projectId, input),
      resolveOrCreatePerson(supabase, accountId, projectId, input),
      resolveOrCreatePerson(supabase, accountId, projectId, input),
    ])

    expect(results.every(r => r.status === 'fulfilled')).toBe(true)

    // All should return SAME person ID
    const ids = results.map(r => r.value.person.id)
    expect(new Set(ids).size).toBe(1)
  })
})
```

### Integration Tests

**File**: `app/routes/api.desktop.people.resolve.integration.test.ts`

```typescript
describe('POST /api/desktop/people/resolve', () => {
  it('should resolve mixed AI + Recall data', async () => {
    const response = await fetch('/api/desktop/people/resolve', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ...' },
      body: JSON.stringify({
        accountId: TEST_ACCOUNT_ID,
        projectId: TEST_PROJECT_ID,
        people: [
          {
            person_key: 'interviewer-1',
            person_name: 'Rick',
            role: 'interviewer',
            email: 'rick@example.com'
          },
          {
            person_key: 'participant-1',
            person_name: 'Jane Smith',
            recall_participant_id: 'zoom-67890',
            recall_platform: 'zoom'
          }
        ]
      })
    })

    const data = await response.json()

    expect(data.resolved).toHaveLength(2)
    expect(data.resolved[0].person_key).toBe('interviewer-1')
    expect(data.resolved[0].matched_by).toBe('email')
    expect(data.resolved[1].person_key).toBe('participant-1')
    expect(data.resolved[1].created).toBe(true)
  })

  it('should handle retry without creating duplicates', async () => {
    const payload = { /* same as above */ }

    // First call
    const response1 = await fetch('/api/desktop/people/resolve', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    const data1 = await response1.json()

    // Second call (retry scenario)
    const response2 = await fetch('/api/desktop/people/resolve', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    const data2 = await response2.json()

    // Should return SAME person IDs
    expect(data2.resolved[0].person_id).toBe(data1.resolved[0].person_id)
    expect(data2.resolved[0].created).toBe(false)  // Not created on retry
  })
})
```

### E2E Tests

**File**: `app/test/e2e/desktop-meeting-flow.test.ts`

```typescript
describe('Desktop Meeting Flow E2E', () => {
  it('should handle full meeting lifecycle with person resolution', async () => {
    // 1. Create interview
    const interview = await createInterview({ title: 'Test Meeting' })

    // 2. Simulate person resolution during meeting
    const resolveResponse = await resolveDesktopPeople({
      people: [
        { person_key: 'interviewer-1', person_name: 'Rick', email: 'rick@example.com' },
        { person_key: 'participant-1', person_name: 'Customer', platform_user_id: 'zoom-123' }
      ]
    })

    expect(resolveResponse.resolved).toHaveLength(2)
    const peopleMap = new Map(
      resolveResponse.resolved.map(r => [r.person_key, r.person_id])
    )

    // 3. Finalize interview
    await finalizeInterview({
      interview_id: interview.id,
      people: resolveResponse.resolved.map(r => ({
        person_key: r.person_key,
        person_id: r.person_id
      }))
    })

    // 4. Run batch analysis (BAML extraction)
    await triggerBatchAnalysis(interview.id)

    // 5. Verify NO duplicate people created
    const people = await getPeople({ projectId: interview.project_id })
    expect(people.filter(p => p.name === 'Rick')).toHaveLength(1)
    expect(people.filter(p => p.name === 'Customer')).toHaveLength(1)
  })
})
```

---

## Implementation Phases

### Phase 1: Shared Resolution Module (1 day)
- [ ] Create `app/lib/people/resolution.server.ts`
- [ ] Extract logic from `peopleNormalization.server.ts`
- [ ] Add email, platform_user_id matching
- [ ] Write comprehensive unit tests (10+ test cases)

### Phase 2: Desktop People API (1 day)
- [ ] Create `app/routes/api.desktop.people.resolve.ts`
- [ ] Add route registration
- [ ] Write integration tests
- [ ] Update API documentation

### Phase 3: Desktop App Updates (1 day)
- [ ] Update `processParticipantJoin()` to capture full data
- [ ] Create `extractPlatformUserId()` helper
- [ ] Update `finalizeInterview()` to call new API
- [ ] Create `mergePeopleData()` helper

### Phase 4: BAML Pipeline Migration (1 day)
- [ ] Update `extractEvidenceCore.ts` to use shared module
- [ ] Update `personMapping.ts` to use shared module
- [ ] Verify no regression in existing flow

### Phase 5: Comprehensive Testing (1 day)
- [ ] E2E tests for desktop → web flow
- [ ] Idempotency tests (retries, concurrent requests)
- [ ] Cross-path tests (realtime + batch no duplicates)
- [ ] Performance tests (bulk person resolution)

**Total Estimate**: 5 days (revised from original 2-3 days)

---

## Benefits of Revised Approach

### 1. **Single Source of Truth**
- All person resolution logic in one place (`resolution.server.ts`)
- Easier to maintain and update
- Consistent behavior across desktop, realtime, batch

### 2. **API-First Design**
- Desktop calls web APIs instead of duplicating logic
- Web owns data integrity and deduplication
- Clear contract via REST API

### 3. **Richer Data Capture**
- Desktop sends email, platform IDs to web
- Web can match by email (most reliable)
- Platform IDs enable cross-meeting identity

### 4. **Idempotency Guarantees**
- Shared upsert pattern handles retries
- No duplicate constraint violations
- Safe for concurrent requests

### 5. **Comprehensive Test Coverage**
- Unit tests for resolution logic
- Integration tests for API endpoints
- E2E tests for full desktop flow
- No "fix in production" scenarios

### 6. **Backwards Compatible**
- Existing BAML pipeline continues to work
- Gradual migration to shared module
- No breaking changes for users

---

## Migration Path

### Step 1: Add Shared Module (No Breaking Changes)
- Extract resolution logic
- Add tests
- Deploy to production (unused)

### Step 2: Desktop API (Additive)
- Create `/api/desktop/people/resolve`
- Test with desktop POC
- No impact on existing flows

### Step 3: Desktop Adoption (Staged Rollout)
- Update desktop app to use new API
- Test with beta users
- Monitor for issues

### Step 4: BAML Migration (Internal)
- Update Trigger.dev pipeline to use shared module
- Run side-by-side comparison
- Verify no regression

### Step 5: Monitoring & Optimization
- Track person creation sources
- Monitor duplicate rates
- Optimize matching algorithms based on data

---

## Risks & Mitigations

### Risk 1: Email Not Always Available

**Mitigation**:
- Use platform_user_id as secondary identifier
- Fall back to name+company fuzzy match
- Log missing data for future improvements

### Risk 2: API Latency for Desktop

**Mitigation**:
- Resolution API optimized for bulk operations
- Desktop batches all people in single request
- Response time < 500ms for 10 people

### Risk 3: Migration Complexity

**Mitigation**:
- Phased rollout with feature flags
- A/B test new flow vs. old flow
- Easy rollback if issues detected

---

## Success Metrics

1. **Zero duplicate person records** from desktop meetings
2. **>95% email match rate** when email available
3. **<1s person resolution** for typical meeting (5 people)
4. **100% test coverage** for resolution logic
5. **Zero constraint violation errors** in production logs

---

## Conclusion

The revised architecture follows proven patterns from the Trigger.dev/BAML pipeline while giving desktop an API-first approach. Key improvements:

- ✅ Shared resolution module used by all paths
- ✅ Desktop sends richer data (email, platform IDs)
- ✅ Web owns person deduplication and storage
- ✅ Idempotent on retry (no constraint violations)
- ✅ Comprehensive test coverage (unit, integration, E2E)

**Next Steps**: Implement Phase 1 (shared module + tests) and validate with desktop POC before broader rollout.
