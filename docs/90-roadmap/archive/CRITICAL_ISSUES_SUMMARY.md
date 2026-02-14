# Critical Issues Summary & Fixes

## Status: 2025-01-12

### ✅ FIXED

1. **People Page Showing 0** (was 2 people)
   - **File:** `app/features/people/db.ts:74-85`
   - **Problem:** Query used `project_people` junction table which had no records
   - **Fix:** Changed to use `people.project_id` column directly
   - **Test:** Refresh people page - should now show 2 people

### 🔍 INVESTIGATING

2. **Pain Themes: Garbage "when X blocked by..." Format**
   - **Symptom:** 40+ themes like "when planning live interviews, blocked by..."
   - **Root Cause:** Pain labels being extracted from wrong source (likely JTBD field or incomplete evidence_facet data)
   - **Next Steps:**
     - Check what's in `evidence.pains` array (old format)
     - Check what's in `evidence_facet` table where `kind_slug='pain'` (new format)
     - Verify `pain_label` extraction logic (lines 176-194 in generatePainMatrix.server.ts)
   - **Impact:** Makes pain matrix completely unusable

3. **3 Phantom User Groups** (should be 2)
   - **Symptom:** Shows "participant, interviewer, non-profit professional" instead of 2 real people
   - **Root Cause:** User group derivation creating fictional groups instead of using actual people
   - **Files to Check:**
     - `app/features/people/services/deriveUserGroups.server.ts`
     - How are facets being used to create groups?
   - **Impact:** Breaks all segment analysis

4. **No Segment Filters** (only "all segments")
   - **Symptom:** Segment filter dropdown only shows "All Segments"
   - **Root Cause:** `getSegmentKindSummaries` returning 0 people per segment
   - **Connection:** Likely same root cause as #3 - facet data not populated
   - **Impact:** Can't filter pain matrix by segment

### 📋 TODO (Lower Priority)

5. **Error Fetching Insights**
   - Just logging error, not breaking functionality
   - Likely `insight_tags` → `tags` relationship issue
   - Can fix after critical UX issues

6. **Blank Insight Card in Persona Detail**
   - UI bug showing empty card when 0 insights
   - Need conditional rendering fix

7. **ICP Recommendations Empty**
   - Dependent on fixes #2, #3, #4 working first
   - Algorithm needs pain data + facet data

8. **40+ Ungrouped Themes**
   - Clustering not working (falling back to label-based)
   - No `evidence_facet` embeddings exist yet
   - Need to either:
     - Generate embeddings for existing pains
     - OR lower `minEvidencePerPain` threshold further
     - OR fix pain extraction so there's real data to cluster

## Root Cause Analysis

**Primary Issue:** Facets data pipeline broken

1. **People have no facets** → No segments → No filters → No user groups
2. **Evidence has wrong pain source** → Garbage pain labels → No clustering
3. **No embeddings generated** → Can't use semantic clustering → Falls back to label clustering → 40 ungrouped themes

**Data Pipeline:**
```
Interviews → Transcripts → Evidence → Facets (person, org, pain)
                                           ↓
                                    Current State: BROKEN
                                           ↓
                    Should generate: person_facet, evidence_facet records
```

## Recommended Fix Order

1. **First:** Investigate facets data
   - Check `person_facet` table - do records exist for these 2 people?
   - Check `evidence_facet` table - do pain records exist?
   - Check `facet_account` table - are pain facets defined?

2. **Then:** Fix pain extraction
   - Verify line 176-194 logic in generatePainMatrix.server.ts
   - Ensure pulling from correct source

3. **Then:** Fix user groups
   - Check deriveUserGroups logic
   - Why creating 3 fictional groups instead of using 2 real people?

4. **Finally:** Test downstream features
   - Segments should work
   - ICP recommendations should work
   - Pain matrix should be usable

## Questions for User

1. Have transcripts been analyzed yet? (This populates evidence_facet)
2. Are there supposed to be facets extracted from these interviews?
3. Is the analysis pipeline running or broken?
