# TODO: Complete Segments Implementation

## Current State
✅ Personas are working - migrated from `people.segment` to `facet_account` + `person_facet`

## Missing Segment Types

### 1. Job Function Segments (B2B)
- Source: `people.job_function`
- Examples: Engineering, Product, Sales, Marketing
- Create facets from distinct job_function values
- Link via person_facet

### 2. Seniority Level Segments (B2B)
- Source: `people.seniority_level`
- Examples: C-Level, VP, Director, Manager, IC
- Create facets from distinct seniority_level values

### 3. Title Segments (B2B)
- Source: `people.title`
- Examples: VP of Engineering, Senior Product Manager
- Create facets from distinct titles

### 4. Industry Segments (B2B)
- Source: `people.industry`
- Examples: SaaS, FinTech, Healthcare
- Create facets from distinct industry values

### 5. Life Stage Segments (B2C)
- Source: `people.life_stage`
- Examples: Student, New Parent, Retiree
- Create facets from distinct life_stage values

### 6. Age Range Segments (B2C)
- Source: `people.age_range`
- Examples: 18-24, 25-34, 35-44
- Create facets from distinct age_range values

### 7. Organization Attributes
- Source: `organizations` table
- Organization Size: Small, Medium, Large, Enterprise
- Organization Industry: Same as people industry but at org level
- Company Type: Startup, Scaleup, Enterprise, etc.

## Implementation Steps

### Step 1: Create facet_kind entries
Add to `facet_kind_global`:
- job_function (id: 2)
- seniority_level (id: 3)
- title (id: 4)
- industry (id: 5)
- life_stage (id: 6)
- age_range (id: 7)
- org_size (id: 8)
- org_industry (id: 9)
- company_type (id: 10)

### Step 2: Create migration script
Similar to `migrate-segments-to-facets.sql`, create:
- `facet_account` entries for each unique value in source fields
- `person_facet` links for each person with that value

### Step 3: Update code
1. Update `segmentData.server.ts`:
   - Remove hardcoded `.in("kind_id", [1])`
   - Query all kinds or allow filtering by kind_id
   - Update kindMap to include all kinds

2. Update `segments/pages/index.tsx`:
   - Add back filter options for new segment types

3. Update `route-definitions.ts` if needed

### Step 4: Test
- Verify all segment types display correctly
- Verify bullseye scores calculate properly for each type
- Verify clicking through to detail pages works

## Notes
- Keep existing `people.segment`, `people.role`, `people.occupation` until migration is verified in production
- Consider whether organization attributes should be in a separate view from person attributes
