# Phone Identity & Custom Fields - QA Plan & Design

## QA Checklist for Phone Identity

### 1. Editor (Settings Page)
- [ ] Navigate to survey settings → Options tab
- [ ] Identity control shows 3 buttons: Anonymous | Email | Phone
- [ ] Select **Phone**
- [ ] Click "Save changes"
- [ ] **Verify:** Settings saved successfully (should see "Saved" alert)
- [ ] Refresh the page
- [ ] **Verify:** Phone is still selected (not reverted to Email)

### 2. Database Verification
Run in Supabase SQL Editor:
```sql
-- Check your test survey's settings
SELECT slug, identity_mode, identity_field
FROM research_links
WHERE slug = 'your-test-slug';

-- Should return: identity_mode='identified', identity_field='phone'
```

### 3. Survey Form (Public Page)
- [ ] Visit the public survey URL: `/ask/your-test-slug`
- [ ] **Verify:** Page shows "Your Phone Number" field (NOT email)
- [ ] **Verify:** Placeholder shows "+1 (555) 123-4567" format
- [ ] **Verify:** Input type is `tel` (not `email`)
- [ ] Enter a phone number: `+1 555 123 4567`
- [ ] Click Continue
- [ ] **Verify:** Proceeds to survey questions (no errors)

### 4. Response Verification
After submitting a phone-identified response:
```sql
-- Check the response was saved with phone
SELECT id, phone, email, person_id, responses
FROM research_link_responses
WHERE research_link_id = (
  SELECT id FROM research_links WHERE slug = 'your-test-slug'
)
ORDER BY created_at DESC
LIMIT 1;

-- Should return: phone='555 123 4567', email=NULL
```

### 5. Resume Flow
- [ ] After starting survey, close browser tab
- [ ] Reopen survey URL
- [ ] **Verify:** Shows "Welcome back! Continue where you left off"
- [ ] **Verify:** Phone field is pre-filled
- [ ] Continue to survey
- [ ] **Verify:** Previous answers are restored

### 6. API Endpoint Testing
Test with curl:
```bash
# Test phone start
curl -X POST http://localhost:3000/api/research-links/your-slug/start \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1 555 123 4567"}'

# Should return: {"responseId": "...", "responses": {}, "completed": false, "personId": null}
```

---

## Custom Fields Architecture Design

### Problem Statement
Need to collect additional fields beyond email/phone:
- **Standard fields**: firstName, lastName, title, company, address, city, state, zip, country
- **Custom fields**: Any user-defined field (e.g., "Last year's revenue", "Industry", "Number of employees")

These should map to the `people` table for identified responses.

### Database Schema Proposal

#### Option 1: Add columns to `people` table (Standard Fields Only)
```sql
-- Extend people table with standard fields
ALTER TABLE people
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zip text,
ADD COLUMN IF NOT EXISTS country text;

-- Custom fields go in JSONB
ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;
```

**Pros:**
- Standard fields are queryable/indexable
- Follows existing pattern (firstname/lastname already exist)

**Cons:**
- Schema changes for new standard fields
- Not flexible

#### Option 2: Fully Dynamic Fields (JSONB only)
```sql
ALTER TABLE people
ADD COLUMN IF NOT EXISTS fields jsonb DEFAULT '{}'::jsonb;

-- Store everything in JSONB: {firstName, lastName, title, company, customField1, etc.}
```

**Pros:**
- Fully flexible
- No schema changes needed

**Cons:**
- Harder to query
- No type safety
- Slower for common queries

#### Option 3: Hybrid (Recommended)
Keep existing standard columns + add custom_fields JSONB:

```sql
-- people table already has:
-- - firstname, lastname (text)
-- - company (text)
-- - primary_email, phone (text)

-- Add new standard fields:
ALTER TABLE people
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zip text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

-- Add GIN index for custom field queries
CREATE INDEX IF NOT EXISTS people_custom_fields_idx
ON people USING GIN (custom_fields);
```

### UI Design Proposal

#### Survey Editor - Field Configuration
Add new tab: **"Collect Info"** (or expand "Options")

```
┌─────────────────────────────────────────┐
│ Collect Information                     │
├─────────────────────────────────────────┤
│                                         │
│ Standard Fields:                        │
│ ☑ First Name (required)                │
│ ☑ Last Name                             │
│ ☐ Title                                 │
│ ☐ Company                               │
│ ☐ Address                               │
│ ☐ City                                  │
│ ☐ State                                 │
│ ☐ Zip Code                              │
│ ☐ Country                               │
│                                         │
│ Custom Fields:                          │
│ [+ Add Custom Field]                    │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Field: Industry              [✕]    │ │
│ │ Type: [Text ▼]                      │ │
│ │ Required: ☐                         │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Field: Last Year Revenue     [✕]    │ │
│ │ Type: [Number ▼]                    │ │
│ │ Required: ☐                         │ │
│ └─────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

#### Data Model
```typescript
// research_links table - add fields_config column
fields_config: {
  standard_fields: {
    firstName: { enabled: true, required: true },
    lastName: { enabled: true, required: false },
    title: { enabled: false, required: false },
    company: { enabled: false, required: false },
    // ... etc
  },
  custom_fields: [
    {
      id: "field_123",
      label: "Industry",
      type: "text" | "number" | "select",
      options?: string[], // for select type
      required: boolean
    }
  ]
}
```

### Survey Form Flow
1. **Identity Stage**: Collect email/phone (existing)
2. **Info Stage** (NEW): Show configured fields form
3. **Name Stage**: Only if person not found (existing)
4. **Survey Stage**: Questions (existing)

### Backend Changes Needed
1. Update `api.research-links.$slug.start.tsx` to accept additional fields
2. Create/update person record with standard + custom fields
3. Store custom fields in `people.custom_fields` JSONB

### Migration Path
```sql
-- Migration: Add person fields collection
ALTER TABLE research_links
ADD COLUMN IF NOT EXISTS fields_config jsonb DEFAULT '{
  "standard_fields": {
    "firstName": {"enabled": true, "required": true},
    "lastName": {"enabled": true, "required": false}
  },
  "custom_fields": []
}'::jsonb;

ALTER TABLE people
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zip text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS custom_fields jsonb DEFAULT '{}'::jsonb;

CREATE INDEX people_custom_fields_idx ON people USING GIN (custom_fields);
```

---

## Implementation Estimate
- **Phone QA & Bug Fixes**: 1-2 hours (if issues found)
- **Custom Fields - Phase 1** (Standard fields only): 4-6 hours
  - Schema migration
  - UI for field selection
  - Form rendering
  - API updates
- **Custom Fields - Phase 2** (Custom fields support): 6-8 hours
  - Custom field builder UI
  - Dynamic form generation
  - JSONB storage/retrieval
  - Query/filter support

---

## Next Steps
1. Run QA checklist on phone identity flow
2. Report any bugs found
3. Decide on custom fields approach (Option 1, 2, or 3)
4. Prioritize implementation (standard fields first, custom later?)
