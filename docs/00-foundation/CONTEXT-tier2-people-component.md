# People Component - Technical Context (Tier 2)

**Component**: People & Person Resolution
**Last Updated**: 2026-02-07
**Related Features**: Desktop Speaker Identification, BAML Evidence Extraction, ICP Matching

---

## Overview

The People component provides unified person identity management across all data ingestion paths. It ensures consistent person records whether data arrives via realtime desktop capture (Recall SDK) or batch upload (BAML extraction).

---

## Core Responsibilities

1. **Person Resolution**: Match incoming person data against existing records
2. **Identity Management**: Maintain cross-meeting identity via platform user IDs
3. **Duplicate Prevention**: Ensure one person = one record across all paths
4. **Data Enrichment**: Merge platform data (email, user IDs) with AI extraction
5. **Relationship Tracking**: Link people to interviews, projects, organizations

---

## Architecture

### Component Structure

```
app/lib/people/
├── resolution.server.ts         # Unified resolution logic (NEW)
└── upsertPerson.server.ts       # Legacy creation logic (still used)

app/routes/
└── api.desktop.people.resolve.ts  # Desktop API endpoint (NEW)

app/features/people/
├── routes.ts                    # People UI routes
├── components/                  # UI components
└── api/                        # People CRUD operations
```

### Data Flow

```
Desktop Path:
Recall SDK → Desktop App → /api/desktop/people/resolve → Resolution Module → DB

Batch Path:
Upload → BAML → Trigger.dev → Resolution Module → DB
```

---

## Key Modules

### 1. Resolution Module (`app/lib/people/resolution.server.ts`)

**Purpose**: Unified person matching and creation logic

**Core Function**:
```typescript
export async function resolveOrCreatePerson(
  supabase: SupabaseClient,
  accountId: string,
  projectId: string | null,
  input: PersonResolutionInput
): Promise<PersonResolutionResult>
```

**Matching Strategy** (priority order):
1. Email (case-insensitive)
2. Platform user ID (stored in `contact_info` JSONB)
3. Name + company (fuzzy match)
4. Create new (idempotent upsert)

**Used By**:
- Desktop API endpoint
- BAML evidence extraction (personMapping.ts)
- Future: Manual import, CSV upload, API integrations

### 2. Desktop API Endpoint (`app/routes/api.desktop.people.resolve.ts`)

**Purpose**: Accept enriched person data from desktop app

**Endpoint**: `POST /api/desktop/people/resolve`

**Request Schema**:
```typescript
{
  accountId: string
  projectId: string
  people: Array<{
    person_key: string           // AI extraction identifier
    person_name: string          // Display name
    role?: string                // interviewer | participant
    recall_participant_id?: string  // Recall SDK participant ID
    recall_platform?: string        // zoom | teams | meet | webex
    email?: string                  // From calendar integration
    is_host?: boolean              // Internal/external classification
  }>
}
```

**Response Schema**:
```typescript
{
  resolved: Array<{
    person_key: string
    person_id: string            // Database UUID
    matched_by: 'email' | 'platform_id' | 'name_company' | 'created'
    created: boolean
  }>
  errors: Array<{
    person_key: string
    error: string
  }>
}
```

### 3. Legacy Upsert Module (`app/lib/people/upsertPerson.server.ts`)

**Purpose**: Original person creation logic with conflict resolution

**Core Function**:
```typescript
export async function upsertPersonWithCompanyAwareConflict(
  supabase: SupabaseClient,
  accountId: string,
  personData: { ... }
): Promise<{ id: string }>
```

**Conflict Strategy**:
1. Try insert with unique constraint
2. Catch constraint violation (PostgreSQL code 23505)
3. Find existing by (account_id, name_hash, company, email)
4. Return existing ID

**Still Used By**:
- Resolution module (for final creation step)
- Direct person creation UI
- Admin operations

---

## Database Schema

### People Table

**Key Fields**:
```sql
CREATE TABLE people (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL,
  project_id UUID,

  -- Identity
  name TEXT NOT NULL,
  name_hash TEXT NOT NULL,    -- For constraint matching
  firstname TEXT,
  lastname TEXT,
  primary_email TEXT,

  -- Platform data (NEW)
  contact_info JSONB,         -- { zoom: { user_id }, teams: { user_id } }

  -- Profile
  title TEXT,
  company TEXT,
  role TEXT,
  person_type TEXT,           -- internal | external

  -- ... 40+ other fields

  CONSTRAINT unique_person_identity
    UNIQUE (account_id, name_hash, company, primary_email)
)
```

**Contact Info JSONB Structure**:
```json
{
  "zoom": {
    "user_id": "zoom-abc123",
    "conf_user_id": "conf-xyz789"
  },
  "teams": {
    "user_id": "teams-def456",
    "aad_object_id": "aad-ghi789"
  }
}
```

### Interview People Junction

```sql
CREATE TABLE interview_people (
  interview_id UUID REFERENCES interviews(id),
  person_id UUID REFERENCES people(id),
  project_id UUID,
  transcript_key TEXT,        -- Speaker label from transcript
  role TEXT,                  -- interviewer | participant

  PRIMARY KEY (interview_id, person_id)
)
```

---

## Integration Points

### 1. Desktop App Integration

**File**: `desktop/src/main.js`

**Flow**:
1. Recall SDK emits `participant.joined` event
2. Desktop captures: `participant.id`, `participant.email`, `participant.extra_data`
3. Desktop calls AI extraction for speaker labels
4. Desktop merges Recall data with AI data via `mergePeopleData()`
5. Desktop calls `/api/desktop/people/resolve`
6. Desktop uses returned `person_id` for evidence/task linking

**Key Functions**:
- `extractPlatformUserId()` - Extract platform-specific user IDs
- `mergePeopleData()` - Match AI extraction with Recall participants
- `finalizeInterview()` - Call resolution API before finalization

### 2. BAML Pipeline Integration

**Files**:
- `src/trigger/interview/v2/personMapping.ts`
- `src/trigger/interview/v2/extractEvidence.ts`

**Flow**:
1. BAML extracts people from transcript
2. `personMapping.ts` calls `resolveOrCreatePerson()` for each person
3. Returns `person_id` for evidence linking
4. Creates `interview_people` junction records

**Before (Legacy)**:
```typescript
const result = await upsertPersonWithCompanyAwareConflict(db, accountId, {...})
```

**After (Unified)**:
```typescript
const result = await resolveOrCreatePerson(db, accountId, projectId, {...})
```

### 3. UI Integration

**Routes**: `/a/:accountId/:projectId/people/*`

**Key Views**:
- People list with ICP scoring
- Person detail with analysis aggregation
- Interview participant management
- Organization/company views

**Data Requirements**:
- Requires `account_id` AND `project_id` for RLS
- Uses `useProjectRoutes` hook for navigation
- Aggregates evidence, interviews, surveys per person

---

## Technical Patterns

### 1. 4-Tier Matching Priority

Why this order?

1. **Email** (highest priority)
   - Most reliable across platforms
   - Persists across name changes
   - Doesn't duplicate across platforms

2. **Platform User ID**
   - Enables cross-meeting identity
   - Handles display name changes
   - Platform-specific but stable

3. **Name + Company**
   - Fuzzy matching fallback
   - Case-insensitive comparison
   - Handles minor variations

4. **Create New** (lowest priority)
   - Only when no match found
   - Uses idempotent upsert pattern
   - Safe for retries/concurrent requests

### 2. Idempotent Creation Pattern

**Problem**: Concurrent requests can violate unique constraint
**Solution**: Try-insert-catch-find pattern

```typescript
try {
  // Attempt insert
  const { data, error } = await supabase.from('people').insert(personData)
  if (!error) return { id: data.id, created: true }
} catch (err) {
  // If constraint violation, find existing
  if (err.code === '23505') {
    const existing = await supabase
      .from('people')
      .select('id')
      .match({ account_id, name_hash, company, email })
      .single()
    return { id: existing.id, created: false }
  }
  throw err
}
```

**Guarantees**:
- Safe for retries
- Safe for concurrent requests
- No duplicate people created

### 3. Platform ID Storage

**Schema**: JSONB field for flexibility

**Benefits**:
- No schema migrations for new platforms
- Queryable via PostgreSQL JSON operators
- Flexible structure per platform

**Query Example**:
```sql
-- Find person by Zoom user ID
SELECT * FROM people
WHERE account_id = $1
  AND contact_info->>'zoom'->>'user_id' = $2
```

---

## Testing Strategy

### Unit Tests
**Location**: `app/test/integration/people-resolution.integration.test.ts`

**Coverage**:
- Email matching (case-insensitive, priority)
- Platform ID matching (Zoom, Teams, Meet)
- Name + company fuzzy matching
- Idempotency (concurrent, retry)
- Edge cases (null, whitespace, missing fields)

**Status**: 37 tests written, require database connection

### Integration Tests (Pending)
- Desktop → Web API flow
- BAML → Resolution module flow
- Duplicate prevention across paths
- Performance (bulk resolution)

### E2E Tests (Pending)
- Desktop records meeting → Person created
- Upload transcript → Same person matched
- No duplicates between paths
- Cross-meeting identity preserved

---

## Common Issues & Solutions

### Issue 1: Duplicate People Created

**Symptom**: Same person appears multiple times in people list
**Cause**: Different ingestion paths not using shared resolution
**Solution**: Migrate all paths to use `resolveOrCreatePerson()`

### Issue 2: Platform IDs Not Capturing

**Symptom**: `contact_info` field is null or empty
**Cause**: Desktop not sending `recall_participant_id` to API
**Solution**: Verify `extractPlatformUserId()` called in `processParticipantJoin()`

### Issue 3: Email Match Failing

**Symptom**: New person created despite matching email
**Cause**: Case sensitivity or whitespace in email comparison
**Solution**: Resolution module uses `LOWER()` SQL function

### Issue 4: Constraint Violation Errors

**Symptom**: PostgreSQL error code 23505 on person insert
**Cause**: Concurrent requests trying to create same person
**Solution**: Idempotent upsert pattern catches and finds existing

---

## Performance Considerations

### Bottlenecks

1. **Sequential resolution** - Each person resolved individually
   - **Impact**: Slow for large meetings (10+ participants)
   - **Solution**: Implement bulk resolution endpoint

2. **Platform ID JSONB queries** - Can be slow on large tables
   - **Impact**: Slower than indexed column lookup
   - **Solution**: Add GIN index on `contact_info` field

3. **Fuzzy name matching** - Case-insensitive string comparison
   - **Impact**: Slower than exact match
   - **Solution**: Only used as fallback (tier 3)

### Optimizations

**Current**:
- Email match uses indexed `primary_email` column (fast)
- Name + company uses indexed `name_hash` (fast)
- Platform ID queries use JSONB operators (slower but acceptable)

**Future**:
- Add bulk resolution endpoint (resolve 10+ people in one request)
- Add GIN index on `contact_info` field
- Implement resolution result caching (Redis)

---

## Migration Guide

### For Existing Code Using Legacy Upsert

**Before**:
```typescript
import { upsertPersonWithCompanyAwareConflict } from '~/lib/people/upsertPerson.server'

const person = await upsertPersonWithCompanyAwareConflict(supabase, accountId, {
  name: "Jane Doe",
  email: "jane@example.com",
  company: "Acme Inc"
})
```

**After**:
```typescript
import { resolveOrCreatePerson } from '~/lib/people/resolution.server'

const result = await resolveOrCreatePerson(supabase, accountId, projectId, {
  name: "Jane Doe",
  primary_email: "jane@example.com",
  company: "Acme Inc",
  source: "your_source_name"
})

const person = result.person
console.log(`Matched by: ${result.matchedBy}`)  // Observability
```

**Benefits**:
- Same idempotent guarantees
- Additional matching strategies (email, platform ID)
- Observability via `matchedBy` indicator
- Cross-meeting identity support

---

## Related Documentation

- **Feature Context**: `docs/20-features-prds/features/people/CONTEXT-people-pipeline-integration.md`
- **Architecture Spec**: `docs/analysis/people-pipeline-integration-REVISED.md`
- **People Feature PRD**: `docs/20-features-prds/features/people/connect-people-prd.md`
- **Testing Guide**: `docs/30-howtos/testing-howto.md`

---

## Future Roadmap

1. **Bulk Resolution API** - Optimize for large meetings
2. **Resolution Metrics** - Track match rates by strategy
3. **Admin Merge UI** - Manual duplicate resolution
4. **Enhanced Matching** - LinkedIn profile matching, phone numbers
5. **Caching Layer** - Redis cache for repeat resolutions
6. **Audit Trail** - Track all person resolution decisions

---

**Component Owner**: People Team
**Last Major Update**: 2026-02-07 (Unified Resolution Implementation)
**Next Review**: After Phase 5 E2E Testing
