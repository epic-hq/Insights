# Segments & Targeting Architecture

## Overview

This document explains how customer segmentation, ICP targeting, and persona discovery work together in the platform.

## Key Concepts

### 1. Target Hypothesis (Research Planning)
**Where:** `projects.target_segments` (JSONB field)

What you THINK before research:
```json
{
  "target_job_titles": ["VP Engineering", "Director of Product"],
  "target_functions": ["Engineering", "Product"],
  "target_seniority": ["Director", "VP", "C-Level"],
  "target_company_sizes": ["51-200", "201-500"],
  "target_industries": ["SaaS", "FinTech"],
  "target_personas": ["Technical Buyer", "Economic Buyer"]
}
```

**Purpose:** Guide who to interview, filter recruiting, track coverage

### 2. Discovered Segments (From Evidence)
**Where:** Derived from `people` + `organizations` + `facets`

What you LEARN from research:

**People Attributes (B2B):**
- `job_title` - Actual title (e.g., "Senior Product Manager")
- `job_function` - Department (e.g., "Product", "Engineering")
- `seniority_level` - Level (e.g., "Director", "IC")

**People Attributes (B2C):**
- `age_range` - Life stage (e.g., "25-34", "35-44")
- `life_stage` - Major transitions (e.g., "New Parent", "Recent Grad", "Retiree")
- `behaviors` - User behaviors/patterns (stored as facets)

**Organization Attributes:**
- In `organizations` table via `people.default_organization_id`
- Company size, industry, type, revenue range

**Persona Facets:**
- In `evidence_facet` with `kind_slug = 'persona'`
- Examples: "Founder", "Student", "Freelancer", "Power User"
- Has definition, quote, linked to evidence

### 3. Bullseye Segments (Validated ICP)
**Where:** Calculated from aggregated evidence

Segments with highest scores for:
- Pain intensity (0-35 points)
- Willingness to pay (0-40 points)
- Sample size confidence (0-25 points)

**Score 75+** = Your bullseye customer (highest likelihood to buy)

## Data Model

### People Table (Person Attributes)

```sql
-- B2B Fields
job_title TEXT          -- "VP of Engineering", "Product Manager"
job_function TEXT       -- "Engineering", "Product", "Sales", "Marketing"
seniority_level TEXT    -- "C-Level", "VP", "Director", "Manager", "IC"

-- B2C Fields
age_range TEXT          -- "18-24", "25-34", "35-44", "45-54", "55-64", "65+"
life_stage TEXT         -- "Student", "New Grad", "New Parent", "Empty Nester", "Retiree"

-- Universal
industry TEXT           -- Person's industry background
company TEXT            -- Company name (links to organizations)
default_organization_id UUID  -- FK to organizations table

-- REMOVED (migrated to facets)
-- segment TEXT         -- DEPRECATED: Migrated to persona facets
-- role TEXT            -- DEPRECATED: Moved to interview_people only
-- occupation TEXT      -- DEPRECATED: Replaced by job_function
```

### Interview People Table (Interview Context)

```sql
-- Interview-specific role (NOT job role)
role TEXT  -- "host", "guest", "participant", "interviewer", "interviewee"
```

### Facets Table (Personas & Segments)

```sql
-- evidence_facet with kind_slug values:
kind_slug = 'persona'    -- "Founder", "Power User", "Casual User", "Champion"
kind_slug = 'behavior'   -- "Heavy Mobile User", "Desktop Only", "Multi-Device"
kind_slug = 'need_state' -- "Evaluating Tools", "Urgent Need", "Nice to Have"
```

## Segmentation Logic

### Derived Segments

Segments are created by grouping people by shared attributes:

**By Job Attributes (B2B):**
- By job title: "All VPs of Engineering"
- By function: "All Engineering leaders"
- By seniority: "All C-Level executives"

**By Company Attributes (B2B):**
- By company size: "People from 51-200 employee companies"
- By industry: "People from SaaS companies"
- By company type: "People from Enterprise companies"

**By Persona (B2B & B2C):**
- By persona facet: "All Founders", "All Students", "All Power Users"

**By Life Stage (B2C):**
- By age range: "All 25-34 year olds"
- By life stage: "All New Parents"

### Bullseye Score Calculation

For each segment, calculate:

```typescript
function calculateBullseyeScore(segment: {
  person_count: number
  evidence_count: number
  high_willingness_to_pay_count: number
  avg_pain_intensity: number
}): number {
  // Sample size confidence (0-25 points)
  // Need 3+ people, 10+ evidence for max score
  const sampleSizeScore = Math.min(
    ((segment.person_count / 3) * 30 + (segment.evidence_count / 10) * 20) / 2,
    25
  )

  // Willingness to pay (0-40 points)
  const wtpScore = segment.evidence_count > 0
    ? (segment.high_willingness_to_pay_count / segment.evidence_count) * 40
    : 0

  // Pain intensity (0-35 points)
  const painScore = segment.avg_pain_intensity * 35

  return Math.round(sampleSizeScore + wtpScore + painScore)
}
```

**Scoring Guide:**
- **75-100:** 🎯 Bullseye Customer - Prioritize for initial launch
- **50-74:** 🔥 High Potential - Expand to after PMF with bullseye
- **25-49:** ⚡ Promising - Monitor, may emerge as opportunity
- **0-24:** 🔍 Need More Data - Collect more evidence

## Migration: people.segment → facets

### Existing Segment Values

Current people.segment contains persona archetypes:
- "founder", "student", "freelancer", "consultant", etc.

These should become persona facets for:
1. **Discoverability** - Searchable, filterable
2. **Evidence linking** - Can see quotes that define each persona
3. **Cross-project** - Personas can be reused via facet_global

### Migration Script

```sql
-- 1. Create persona facets from existing people.segment values
INSERT INTO evidence_facet (
  kind_slug,
  label,
  quote,
  facet_account_id
)
SELECT DISTINCT
  'persona' as kind_slug,
  segment as label,
  'Migrated from people.segment' as quote,
  account_id as facet_account_id
FROM people
WHERE segment IS NOT NULL
  AND segment != ''
ON CONFLICT DO NOTHING;

-- 2. Link people to their persona facets
INSERT INTO person_facet (
  person_id,
  facet_account_id
)
SELECT
  p.id as person_id,
  f.facet_account_id
FROM people p
JOIN evidence_facet f
  ON f.label = p.segment
  AND f.kind_slug = 'persona'
  AND f.facet_account_id = p.account_id
WHERE p.segment IS NOT NULL
  AND p.segment != '';

-- 3. After verifying, drop the column
-- ALTER TABLE people DROP COLUMN segment;
-- ALTER TABLE people DROP COLUMN role;
-- ALTER TABLE people DROP COLUMN occupation;
```

## Research Workflow

### 1. Define Target Hypothesis

User sets research goals in project setup:

```typescript
// Stored in projects.target_segments
{
  "b2b_targets": {
    "job_titles": ["VP Engineering", "Director of Product"],
    "functions": ["Engineering", "Product"],
    "seniority": ["Director", "VP", "C-Level"],
    "company_sizes": ["51-200", "201-500"],
    "industries": ["SaaS", "FinTech"]
  },
  "b2c_targets": {
    "age_ranges": ["25-34", "35-44"],
    "life_stages": ["New Parent", "Career Changer"],
    "personas": ["Power User", "Early Adopter"]
  }
}
```

### 2. Conduct Research

- Interview people matching target hypothesis
- Extract attributes: job titles, company info, personas
- Collect evidence: pains, gains, willingness to pay

### 3. Discover Segments

System automatically:
- Groups people by shared attributes
- Calculates bullseye scores
- Identifies high-potential segments

### 4. Validate ICP

Compare:
- **Hypothesis** (who you targeted)
- **Discovered** (who you actually talked to)
- **Bullseye** (who has highest pain + WTP)

Insights:
- "You targeted VPs but Directors have 2x the pain"
- "You focused on SaaS but FinTech has higher WTP"
- "Unexpected segment: Founders score 85/100"

## UI Flow

### Segments Index (`/segments`)

**Filters:**
- Segment type: Personas, Job Titles, Functions, Industries, Company Size, etc.
- Bullseye score: Slider 0-100
- Evidence confidence: Min evidence count

**Cards show:**
- Segment name
- Person count
- Evidence count
- Bullseye score badge
- Top pain preview

### Segment Detail (`/segments/:id`)

**Overview:**
- Bullseye score breakdown
- Key metrics: people, evidence, WTP %, pain intensity

**Why Bullseye:**
- ✓ Sufficient sample (X people, Y evidence)
- ✓ High WTP (X% expressed willingness)
- ✓ High pain (X% average intensity)

**Top Pains:**
- Ranked by impact score
- Frequency within segment
- Sample quotes

**Related Insights:**
- Published insights tagged with this segment

## Implementation Files

### Services
- `app/features/segments/services/segmentData.server.ts` - Query & scoring logic
- `app/features/people/services/deriveUserGroups.server.ts` - Grouping logic

### Pages
- `app/features/segments/pages/index.tsx` - Segments list
- `app/features/segments/pages/detail.tsx` - Segment profile

### Database
- `supabase/schemas/public.sql` - Schema definitions
- `people`, `organizations`, `evidence_facet`, `person_facet` tables

## FAQ

**Q: What's the difference between a segment and a persona?**
- **Segment** = Any grouping of people (by job, industry, company, persona, etc.)
- **Persona** = A specific type of segment representing a user archetype (stored as facets)

**Q: Should I use job_function or life_stage for B2C products?**
- **job_function** is B2B-focused (Engineering, Sales, Marketing)
- **life_stage** is B2C-focused (Student, New Parent, Retiree)
- Use both if you have a prosumer product!

**Q: How do I know which segment to target?**
- Look for bullseye scores 75+
- Prioritize segments with:
  - High sample size (confidence)
  - High pain intensity (urgency)
  - High WTP (ability to monetize)

**Q: What if my hypothesis was wrong?**
- That's the point of research!
- Compare target_segments (hypothesis) to bullseye segments (reality)
- Pivot to the segment with strongest buying signals
