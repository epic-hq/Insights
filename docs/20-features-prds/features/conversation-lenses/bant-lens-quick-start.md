# BANT Lens - Quick Start Guide

## What You Asked

> "i see opportunities table with 5 entries, but nothing in UI leads me there. which account and project did you create test data? how should a user do this? from what screen?"

## Quick Answers

### 1. Where is the Test Data?

**Account ID**: `d60e3032-d1bf-46d2-983b-468181d0770c`
**Project ID**: `6d3594bd-04d5-48dc-8a37-14d609b3e1ad` (Project name: `noble-haven`)

**Full URLs**:
- BANT Lens: `/a/d60e3032-d1bf-46d2-983b-468181d0770c/6d3594bd-04d5-48dc-8a37-14d609b3e1ad/bant-lens`
- Opportunities: `/a/d60e3032-d1bf-46d2-983b-468181d0770c/6d3594bd-04d5-48dc-8a37-14d609b3e1ad/opportunities`

### 2. Why Can't You Find Opportunities?

⚠️ **Known UX Gap**: Opportunities are **NOT in the sidebar navigation**

**Current State**:
- ✅ BANT Lens IS in sidebar: Analysis → BANT Lens
- ❌ Opportunities NOT in sidebar (no link)
- ✅ Opportunities pages exist (`/opportunities`, `/opportunities/new`)
- ❌ No clear discovery path for users

**How to Access (Workarounds)**:
1. **From BANT Lens**: Click cells to see sample opportunities
2. **Manual URL**: Type `/opportunities` after your project path
3. **From Interview Detail**: (Future: Add "Create Opportunity" button)

**Recommended Fix**: Add to sidebar navigation:
```typescript
// In app/components/navigation/app-sidebar.config.ts
{
  key: "opportunities",
  title: "Opportunities",
  description: "Sales pipeline & deals",
  icon: Briefcase,
  to: (routes) => routes.opportunities.index(),
}
```

**Where to Add**: Either:
- Under Directory section (with People, Organizations, Segments)
- OR create new "Sales" section with Opportunities + BANT Lens

### 3. How Should Users Create Opportunities?

**Intended Workflow** (once navigation is fixed):

```
Sidebar → Opportunities → Create Opportunity
  ↓
Fill form:
  - Title (required)
  - Amount (deal size)
  - Stage (qualification/discovery/etc.)
  - Close Date
  - Link to Organization
  - Link to Primary Contact
  ↓
Conduct discovery interviews with prospect
  ↓
Link interviews to opportunity
  ↓
BANT extraction happens automatically
  ↓
View BANT Lens to see where opportunity falls on Budget × Authority matrix
```

**Current Workflow** (manual navigation):
1. Navigate to `/a/{accountId}/{projectId}/opportunities`
2. Click "Create Opportunity"
3. Fill out form and save
4. Upload/link interviews
5. Visit BANT Lens to see results

### 4. Why is observations_and_notes Sparse?

✅ **This is BY DESIGN** - the system is evidence-based:

**Data Architecture**:
```
Interview Transcript
  ↓ AI Processing
Evidence Chunks (structured)
  ↓ Consumption
BANT Slots, Facets, Lenses
```

**NOT this**:
```
Interview Transcript
  ↓ Manual notes
observations_and_notes (free text)
  ↓ String parsing
BANT data (fragile)
```

**Key Points**:
- ✅ Evidence chunks are typed (`kind: "budget"`, `kind: "pain"`)
- ✅ Evidence has embeddings (semantic search)
- ✅ Evidence links to people, orgs, interviews
- ✅ Evidence has confidence scores
- ❌ observations_and_notes is for ad-hoc human notes only

**See**: [Evidence-Based Extraction Architecture](../architecture/evidence-based-extraction.md)

## Test Data Details

### What Was Created
Running `create-test-opportunities.ts` created:

**5 Opportunities**:
1. Enterprise Deal - Acme Corp ($500K, negotiation)
2. Mid-Market - TechStart Inc ($75K, proposal)
3. SMB - Local Business ($15K, discovery)
4. Startup - Innovation Labs ($8K, qualification)
5. Large Enterprise - Global Systems ($1.2M, discovery)

**4 BANT Summaries** (5th had duplicate key error from previous run)

**6 Stakeholders** with influence levels

**2 BANT Slots** (timeline only - test interviews lacked explicit budget/authority evidence)

### Why Limited BANT Data?
The test interviews don't have rich evidence about:
- Budget discussions
- Decision-maker authority
- Explicit needs/timeline

**For Real Data**:
1. Conduct interviews that explicitly ask BANT questions
2. System will extract evidence chunks during processing
3. Sales lens extraction consumes evidence → creates slots
4. Matrix populates automatically

## Documentation Index

### For Users
1. **[User Guide](./bant-lens-user-guide.md)** - Complete user workflow, navigation, troubleshooting
2. **[This Quick Start](./bant-lens-quick-start.md)** - TL;DR answers to common questions

### For Developers
1. **[Technical Design](./bant-lens-technical-design.md)** - Architecture, data models, implementation
2. **[Evidence Architecture](../architecture/evidence-based-extraction.md)** - Why evidence, not observations_and_notes

## Next Steps

### For You (User)
1. ✅ Test data is in project `noble-haven` (URLs above)
2. ✅ Navigate to BANT Lens via sidebar → Analysis → BANT Lens
3. ⚠️ To manage opportunities, manually go to `/opportunities` (until nav fixed)
4. 📖 Read the user guide for full workflow

### For Development Team
1. **High Priority**: Add Opportunities to sidebar navigation
2. **Medium Priority**: Add "Create Opportunity" button from interview detail pages
3. **Future**: Improve BANT extraction prompts to capture more evidence
4. **Future**: Add manual editing UI for BANT slots

## Verification Commands

### Check Test Data
```bash
# See opportunity and BANT data counts
npx tsx app/mastra/tools/verify-bant-data.ts

# See full URLs for project
npx tsx app/mastra/tools/get-project-account.ts
```

### Create More Test Data
```bash
# Generate 5 sample opportunities with BANT data
npx tsx app/mastra/tools/create-test-opportunities.ts
```

### Check People Migration
```bash
# Verify facet migration completed
npx tsx app/mastra/tools/verify-people-facets.ts
```

## Common Issues & Fixes

### Issue: "Can't find opportunities page"
**Cause**: Not in sidebar navigation
**Fix**: Manually navigate to `/a/{accountId}/{projectId}/opportunities`
**Future**: Add to sidebar

### Issue: "BANT matrix shows all Unknown"
**Cause**: Interviews lack budget/authority evidence
**Fix**: Conduct better discovery interviews with explicit BANT questions
**Or**: Manually add evidence chunks for existing interviews

### Issue: "Create test opportunities script fails"
**Cause**: May be duplicate key errors if re-running
**Fix**: Normal - some interviews already have BANT summaries, script skips them

### Issue: "observations_and_notes field is empty"
**Expected**: This field is intentionally sparse
**Reason**: System uses evidence chunks, not free-text notes
**See**: [Evidence Architecture Doc](../architecture/evidence-based-extraction.md)

## Contact

For questions or issues:
- Read docs first (linked above)
- Check [GitHub Issues](https://github.com/your-repo/issues)
- Ask in team Slack #research-tools channel
