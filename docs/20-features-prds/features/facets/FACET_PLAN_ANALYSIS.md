# Facet Simplification Plan - Status Analysis

## ✅ What's ALREADY Done (From Production Migration)

### 1. ✅ Database Schema Migrated
- **Dropped** `facet_candidate` table
- **Dropped** `project_facet` table  
- **Dropped** `candidate_id` column from `person_facet`
- **Added** `is_active` boolean to `facet_account`
- **Replaced** `facet_ref` with `facet_account_id` (integer FK) in `person_facet`
- **Migrated** 684 person_facet rows from `facet_ref` to `facet_account_id`
- **Deleted** 44 legacy person_facet rows with null/invalid refs

### 2. ✅ Write Path Updated
- `persistFacetObservations()` already writes `facet_account_id` (not `facet_ref`)
- `FacetResolver.ensureFacet()` creates `facet_account` entries with `is_active = false` by default
- No more candidate queue - new facets go directly to `facet_account` as inactive

### 3. ✅ Evidence Facets Exist
- `evidence_facet` table created with `facet_account_id` FK
- Already being written in `processInterview.server.ts` (lines 1125-1166)
- Properly linked to evidence rows by ID (not index)

## ⚠️ Gaps Between Current State & Your Plan

### Gap 1: Index-Based Pairing Still Exists ❌
**Current:** `processInterview.server.ts` uses `evidenceFacetMentionsByIndex` array (line 1123)
**Your Plan:** "insert evidence row, grab its ID, immediately persist facets"
**Status:** PARTIALLY DONE - Evidence is inserted first, IDs are captured, but the pairing logic still uses indexes

**Evidence:**
```typescript
// Line 1130-1159: Still using index-based lookup
const evidenceFacetRows: Array<{...}> = []
for (const [evidenceIndex, mentions] of evidenceFacetMentionsByIndex.entries()) {
  const evidenceId = insertedEvidenceIds[evidenceIndex]  // ⚠️ Index-based
  if (!evidenceId) continue
  // ...
}
```

**Fix Needed:** Change data structure from `Map<index, mentions>` to `Map<evidenceId, mentions>`

### Gap 2: facet_ref Still in BAML Types ⚠️
**Current:** BAML types still use `facet_ref` string
**Your Plan:** "facet_ref is the stable identifier"
**Status:** INTENTIONAL - You want to KEEP `facet_ref` as the concept

**Clarification Needed:** 
- Do you want `facet_ref` to stay in BAML types but be converted to `facet_account_id` when persisting? (Current state)
- Or do you want BAML to return `facet_account_id` directly?

### Gap 3: Read Paths Still Use Old Schema ❌
**Current:** Multiple queries still reference deleted columns
**Your Plan:** "Remove candidate_id from selects"
**Status:** NOT DONE

**Evidence:**
```typescript
// test/integration/processInterview.server.integration.test.ts:321
.select("evidence_id, kind_slug, label, facet_ref")  // ❌ facet_ref doesn't exist anymore
```

**Fix Needed:** Update all queries to use `facet_account_id` instead of `facet_ref`

### Gap 4: UI Still References Candidates ❌
**Current:** Unknown - need to check facets UI
**Your Plan:** "Update facets screen to toggle is_active instead of approve queue"
**Status:** NEEDS INVESTIGATION

### Gap 5: Trigger.dev Centralization ❌
**Current:** `processInterview.server.ts` is called from both Remix routes AND Trigger tasks
**Your Plan:** "One saver that lives in Trigger.dev task"
**Status:** NOT DONE - Still dual entry points

## 🎯 Recommended Action Plan

### Phase 1: Fix Breaking Issues (URGENT - Production is broken)
1. **Fix test queries** - Replace `facet_ref` with `facet_account_id` in all selects
2. **Fix read paths** - Update any UI/API that queries `facet_ref` or `candidate_id`
3. **Verify evidence_facet queries** - Make sure they use `facet_account_id`

### Phase 2: Improve Index-Based Pairing (HIGH PRIORITY)
1. Change `evidenceFacetMentionsByIndex` to `evidenceFacetMentionsByTempId`
2. Use a temporary ID (like evidence unit index) during extraction
3. Map temp IDs to real evidence IDs after insertion
4. Persist facets with real evidence IDs

### Phase 3: Centralize in Trigger.dev (MEDIUM PRIORITY)
1. Move all persistence logic into Trigger task
2. Make Remix routes read-only (just trigger the task)
3. Remove duplicate persistence code

### Phase 4: UI Updates (LOW PRIORITY)
1. Update facets screen to show `is_active` toggle
2. Remove "approve candidate" UI
3. Update docs

## 🚨 Critical Questions

### Q1: facet_ref Strategy
**Current:** BAML returns `facet_ref` string → Code converts to `facet_account_id` → DB stores integer

**Options:**
A. **Keep this** - BAML uses `facet_ref` as a logical concept, code handles conversion
B. **Change BAML** - Return `facet_account_id` directly from LLM (requires prompt changes)

**Recommendation:** Keep current approach (A). The LLM shouldn't know about database IDs.

### Q2: Index-Based Pairing Fix Priority
**Current:** Works but fragile (as you noted)

**Risk:** If evidence filtering/reordering happens, facets get misaligned

**Question:** Is this causing production issues NOW, or is it theoretical?

### Q3: Trigger.dev Centralization Scope
**Current:** Both `/api.upload-file` and Trigger tasks call `processInterview.server.ts`

**Question:** Do you want to:
A. Keep sync processing for small files, async for large?
B. Make EVERYTHING async through Trigger.dev?

## 📊 Current State Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ DONE | Migration successful in production |
| Write Path (person_facet) | ✅ DONE | Uses `facet_account_id` |
| Write Path (evidence_facet) | ✅ DONE | Uses `facet_account_id` |
| Read Paths | ❌ BROKEN | Still query `facet_ref`, `candidate_id` |
| Tests | ❌ BROKEN | Query deleted columns |
| Index-Based Pairing | ⚠️ FRAGILE | Works but risky |
| Trigger Centralization | ❌ NOT DONE | Dual entry points |
| UI Updates | ❓ UNKNOWN | Need to check |

## 🎬 Next Steps

**Immediate (Fix Production):**
1. Find and fix all queries using `facet_ref` or `candidate_id`
2. Update tests to use new schema
3. Verify app works end-to-end

**Then Ask:**
- Should we fix index-based pairing now or later?
- Do you want full Trigger.dev centralization?
- Keep `facet_ref` in BAML types or change to IDs?
