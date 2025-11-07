# BANT Lens - User Guide

## Overview

The **BANT Lens** is a sales qualification matrix that visualizes your opportunities across two critical dimensions:
- **Budget** (deal size): Unknown, <$10K, $10-50K, $50-100K, $100-250K, $250K-1M, >$1M
- **Authority** (decision-maker influence): Unknown, Low, Medium, High, Executive

This helps you prioritize opportunities based on their qualification strength.

## Navigation & Access

### Direct URLs
The BANT Lens is accessible at:
```
/a/{accountId}/{projectId}/bant-lens
```

### Current Navigation Path
⚠️ **Known Issue**: Opportunities are currently **not in the sidebar navigation**. This creates a discoverability gap.

**Temporary Workaround:**
1. Navigate to sidebar → Analysis → **BANT Lens** (shows the matrix)
2. From the BANT Lens, you can see opportunities linked via sales lens data
3. To manage opportunities directly, manually navigate to: `/a/{accountId}/{projectId}/opportunities`

**Future Improvement Needed**: Add Opportunities to sidebar navigation (likely under Directory or a new "Sales" section)

## User Workflow

### Step 1: Create Opportunities
Navigate to `/a/{accountId}/{projectId}/opportunities` (manually for now)

Click **"Create Opportunity"** and provide:
- **Title** (required): e.g., "Enterprise Deal - Acme Corp"
- **Kanban Status**: Explore, Validate, or Build
- Optional fields:
  - Amount: Deal size in dollars
  - Stage: Custom sales stage
  - Close Date: Expected close date
  - Organization: Link to a company in your directory
  - Primary Contact: Link to a person in your directory

### Step 2: Link Interviews to Opportunities
When you conduct discovery interviews with prospects, you can:

1. Upload or record the interview (Recordings section in sidebar)
2. During or after the interview, link it to an opportunity
3. The system will automatically extract BANT data from the interview

**Data Source**: The system uses **evidence chunks** (not raw transcript `observations_and_notes`). Evidence is structured data extracted during interview processing.

### Step 3: BANT Extraction Happens Automatically
When an interview is linked to an opportunity, the system runs `buildInitialSalesLensExtraction()` which:

1. **Identifies Stakeholders** from interview attendees
   - Extracts: Name, Role, Organization, Influence (low/medium/high)
   - Marks economic buyers and technical champions

2. **Extracts BANT Slots** from evidence:
   - **Budget**: Deal size, budget range (from evidence or opportunity.amount)
   - **Authority**: Decision-maker influence (mapped from stakeholder data)
   - **Need**: Business problem, pain points (from evidence)
   - **Timeline**: Implementation timeline, urgency (from evidence)

3. **Creates sales_lens_summary** record linking interview → opportunity

### Step 4: View BANT Matrix
Navigate to sidebar → Analysis → **BANT Lens**

You'll see:
- **Heat map** showing opportunity distribution across Budget × Authority grid
- **Cell colors** indicate opportunity density (lighter = fewer, darker = more)
- **Summary stats**: Total opportunities, pipeline value, qualified cells

**Click any cell** to see:
- Opportunity count in that segment
- Average deal size
- BANT confidence score
- Sample opportunities with details

## Data Architecture

### Key Concept: Evidence-Based Extraction
This is an **AI-native system** designed around structured evidence chunks, not raw notes:

```
Interview (transcript)
  ↓ AI Processing
Evidence Chunks (structured facets)
  ↓ Sales Lens Extraction
BANT Slots + Stakeholders
  ↓ Aggregation
BANT Matrix (Budget × Authority)
```

### Why observations_and_notes is Sparse
The `observations_and_notes` field on interviews is intentionally minimal because:
- ✅ **Evidence chunks** are the source of truth (structured, tagged, versioned)
- ✅ **Facets** capture persona attributes (job_function, seniority, etc.)
- ✅ **Sales lens slots** capture BANT-specific data
- ❌ `observations_and_notes` is for ad-hoc notes only, not AI extraction

**Example Evidence Flow:**
```
Interview: "We have a $500K budget allocated for Q2 2025"
  ↓
Evidence Chunk: {
  kind: "budget",
  value: "$500K",
  timeline: "Q2 2025",
  confidence: 0.9
}
  ↓
BANT Slot: {
  slot: "budget",
  numeric_value: 500000,
  date_value: "2025-06-30"
}
  ↓
BANT Matrix: Cell [250K-1M, High]
```

## Testing & Seeding Data

### Create Test Opportunities
Use the provided script to generate sample data:

```bash
npx tsx app/mastra/tools/create-test-opportunities.ts
```

This creates:
- 5 opportunities with varying amounts ($8K to $1.2M)
- Links them to existing interviews
- Runs BANT extraction on each
- Populates the BANT matrix

### Verify Data
```bash
npx tsx app/mastra/tools/verify-bant-data.ts
```

Shows counts for opportunities, summaries, slots, and stakeholders.

## Common Questions

### Q: Why don't I see Budget/Authority data for all opportunities?
**A**: BANT data comes from linked interviews. If an opportunity has no interviews, or interviews lack evidence about budget/authority, those cells will be empty.

### Q: How do I improve BANT extraction quality?
**A**:
1. Ask explicit discovery questions about budget, authority, need, and timeline
2. Ensure interviews capture stakeholder details (names, roles, influence)
3. Link the right people/organizations to opportunities
4. Review and correct extracted evidence if AI makes mistakes

### Q: Can I manually edit BANT data?
**A**: Currently, BANT slots are auto-extracted. Manual editing of `sales_lens_slots` table is possible via SQL but not recommended. Better approach: Correct the source evidence, then re-run extraction.

### Q: What's the difference between `amount` and `budget`?
**A**:
- `opportunity.amount`: Sales team's forecast (CRM-style)
- BANT `budget` slot: Customer's stated/discovered budget allocation

These may differ! BANT budget often reveals customer reality vs sales optimism.

## Related Features

- **Product Lens**: Pain × User matrix for product decisions (similar matrix pattern)
- **Segments**: Facet-based user grouping (uses same facet infrastructure)
- **People Directory**: Stakeholder management
- **Organizations**: Company/account management
- **Evidence**: Source of truth for extracted data

## Next Steps

After viewing the BANT Lens, you might want to:
1. Click high-value cells to see which opportunities to prioritize
2. Identify gaps (e.g., too many "Unknown" authority → need better stakeholder discovery)
3. Compare with Product Lens to align sales + product priorities
4. Export insights to your CRM or decision docs
