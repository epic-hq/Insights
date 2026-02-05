# Insights (Themes) Implementation Status

## Last Updated: December 9, 2024

## Summary

The Insights system is **partially functional** with several known issues affecting data quality. The core flow works but theme-evidence linking has accuracy problems.

---

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| View Insights (Cards) | ✅ Working | `/insights/quick` |
| View Insights (Table) | ✅ Working | `/insights/table` |
| Per-Interview Theme Generation | ⚠️ Partial | Over-linking bug |
| Theme Consolidation | ✅ Working | Via button + API |
| Theme Enrichment | ✅ Working | Via button + API |
| Evidence Count Display | ⚠️ Partial | May be inflated |
| Vote on Insights | ✅ Working | Via annotations |
| View Supporting Evidence | ⚠️ Partial | Links may be inaccurate |

---

## Known Issues

### 1. Over-Linking Bug (Critical)

**Location**: `src/trigger/interview/v2/generateInsights.ts` lines 127-138

**Problem**: When generating insights from an interview, the code links EVERY theme to EVERY evidence from that interview, creating N×M relationships instead of accurate 1:few relationships.

**Impact**:
- Evidence counts are inflated
- Enrichment uses irrelevant evidence
- Users see misleading data

**Root Cause**: The BAML `ExtractInsights` function doesn't return specific evidence IDs per insight. The code falls back to linking all evidence.

**Fix Required**:
1. Update BAML `ExtractInsights` to return evidence IDs per insight
2. Update `generateInsightsTaskV2` to use those specific IDs

### 2. Duplicate Themes Across Interviews

**Problem**: Each interview generates its own themes independently. Similar themes are not automatically merged.

**Impact**: Users see fragmented insights like "Need for AI Tools" appearing 5 times with slight variations.

**Mitigation**: Manual "Consolidate Themes" button exists but requires user action.

**Recommendation**: Consider auto-consolidation after each interview or on a schedule.

### 3. Enrichment Skips Themes Without Links

**Location**: `src/trigger/enrich-themes.ts` lines 153-156

**Problem**: If a theme has no `theme_evidence` links, enrichment skips it entirely.

**Impact**: Themes created before linking was implemented can never be enriched.

**Fix Required**: Either backfill links or allow enrichment without evidence (using theme name/statement only).

### 4. Two Separate UI Pages

**Problem**: `/insights` and `/themes` both show the same `themes` table data with different views.

**Current State**:
- `/insights` - Has Enrich + Consolidate buttons, Cards/Table toggle
- `/themes` - Has Enrich button, persona matrix view

**Recommendation**: Consolidate to single page or clearly differentiate purposes.

---

## Recent Changes

### December 8, 2024

- Added "Consolidate Themes" button to `/insights` layout
- Added "Enrich Themes" button to `/insights` layout
- Created `/api/consolidate-themes` route
- Fixed route registration in `app/routes.ts`
- Fixed `projectId` vs `project?.id` bug in layout
- Changed sidebar "Insights" link from `/themes` to `/insights`

### Previous

- Implemented `generateInsightsTaskV2` with theme_evidence linking
- Implemented `autoGroupThemesAndApply` for consolidation
- Implemented `enrich-themes-batch` and `enrich-theme` tasks
- Created BAML `AutoGroupThemes` function

---

## Data Verification

To check the current state of theme-evidence linking in your project:

```sql
-- Count themes per project
SELECT project_id, COUNT(*) as theme_count
FROM themes
WHERE project_id = 'YOUR_PROJECT_ID'
GROUP BY project_id;

-- Count theme_evidence links
SELECT COUNT(*) as link_count
FROM theme_evidence
WHERE project_id = 'YOUR_PROJECT_ID';

-- Check for over-linking (themes with too many evidence links)
SELECT t.name, COUNT(te.id) as evidence_count
FROM themes t
LEFT JOIN theme_evidence te ON te.theme_id = t.id
WHERE t.project_id = 'YOUR_PROJECT_ID'
GROUP BY t.id, t.name
ORDER BY evidence_count DESC
LIMIT 20;

-- Check themes missing enrichment
SELECT name, pain, jtbd, category
FROM themes
WHERE project_id = 'YOUR_PROJECT_ID'
  AND (pain IS NULL OR jtbd IS NULL OR category IS NULL);
```

---

## Next Steps

### Immediate (P0)

1. **Fix over-linking bug** - Update BAML and generateInsightsTaskV2
2. **Backfill theme_evidence links** - For themes created before linking was implemented

### Short-Term (P1)

3. **Unify UI pages** - Decide on single insights page
4. **Add evidence detail view** - Show which evidence supports each theme
5. **Add manual link/unlink** - Let users correct AI mistakes

### Medium-Term (P2)

6. **Auto-consolidation** - Run after each interview
7. **Theme suggestions** - AI suggests merging similar themes
8. **Theme hierarchy** - Parent/child relationships

---

## Testing Checklist

Before deploying changes to the insights system:

- [ ] Create new interview and verify themes are generated
- [ ] Check theme_evidence links are accurate (not N×M)
- [ ] Run "Consolidate Themes" and verify similar themes merge
- [ ] Run "Enrich Themes" and verify metadata is added
- [ ] Verify evidence counts match actual links
- [ ] Test both `/insights` and `/themes` pages load correctly
