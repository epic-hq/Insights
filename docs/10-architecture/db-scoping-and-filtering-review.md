# Database Scoping & Query-Filtering Review (2025-08-01)

## 1. Executive Summary

* **Risk identified:** Most loader/action queries filter by `account_id` only; `project_id` is frequently **omitted**.  When a second project is added, data from different projects will bleed together in list views, analytics, and AI pipelines.
* **Recommended fix:** Adopt the invariant **`WHERE account_id = :accountId AND project_id = :projectId`** for every entity that belongs to a project (`interviews`, `insights`, `people`, `personas`, `opportunity_ideas`, future `conversation_timeline`, `annotations`, …).
* **Index strategy:** Create (or alter) **compound indexes** that match the new query pattern and support filtered counts / sorts.
* **URL-filter module:** Provide a typed helper (`useUrlFilters()`) that keeps UI filters, URL search params, and DB queries in sync.

---

## 2. Relationship Review

| Table | Current project reference | Missing constraints / issues |
|-------|---------------------------|------------------------------|
| accounts            | N/A (tenant root) | ‑ |
| projects            | `account_id` FK ✔ | Add `UNIQUE (account_id, name)` for slug generation.
| interviews          | `account_id`, `project_id` ✔ | Queries **often ignore** `project_id` → leakage risk.
| insights            | `account_id`, `project_id` ✔ | Same leakage risk; joins via `insight_tags`, `persona_insights` must include both IDs.
| people              | `account_id` ✔ **NO `project_id`** | Needs `project_id` (people are project-scoped per IA).
| personas            | `account_id` ✔ **NO `project_id`** | Add column + back-fill; update RLS.
| opportunity_ideas   | `account_id`, `project_id` ✔ | Queries OK but add compound index.
| junction tables (`*_tags`, `persona_insights`, `people_personas`, `interview_people`, …) | All carry parent FKs but indexes are single-column. | Should mirror compound `(account_id, project_id, <other_id>)`.
| future: conversation_timeline | TBD | Design with `(account_id, project_id, interview_id, seq_no)` PK.
| future: annotations | TBD | Generic FK to `entity_type` + `entity_id`; still require `(account_id, project_id)` columns for policy & index.

### RLS snapshot
Most policies already enforce `account_id = auth.jwt().account_id`.  Add **`project_id = current_setting('my.project_id')`** (or param from row level setting) for stricter isolation, or keep simple explicit comparison if JWT carries `project_id`.

---

## 3. Query Audit

### Interviews feature (`~/features/interviews/db.ts`)
```ts
// getInterviews()
...from('interviews')
  .eq('account_id', accountId)            // ❌ project_id missing

// getInterviewById()
  .eq('id', id)
  .eq('account_id', accountId)           // ❌ project_id missing

// getRelatedInterviews()
  .eq('account_id', accountId)
  .eq('project_id', projectId)           // ✅ correct
```
*Similar gaps exist in insights, people, personas loaders.*

### Actions / loaders
* `/people`, `/personas`, `/insights`, dashboard KPIs all filter only by `account_id`.
* Edge-functions (`cluster_insights`, `auto_insights`) receive only `account_id`.

➡ **Todo:** add `projectId` to `userContext` and thread through all calls.

---

## 4. Index Recommendations

| Table | Existing PK / Index | Proposed additional / modified index |
|-------|---------------------|--------------------------------------|
| interviews | `PK(id)` ; `idx_account_id` | `CREATE INDEX idx_interviews_account_project_created ON interviews (account_id, project_id, created_at DESC);`
| insights   | `PK(id)` ; `idx_account_id` | `CREATE INDEX idx_insights_account_project_created ON insights (account_id, project_id, created_at DESC);`
| people     | `PK(id)` ; `idx_account_id` | `ALTER TABLE people ADD COLUMN project_id uuid;` + `CREATE INDEX idx_people_account_project ON people (account_id, project_id);`
| personas   | same as *people* | same as *people*
| *_junction | Mostly single FKs | For each table, create multi-column index that matches common joins, e.g.  
  `CREATE INDEX idx_insight_tags_account_project_insight ON insight_tags (account_id, project_id, insight_id);`
| conversation_timeline | — | future PK `(id)` + `idx_account_project_interview_seq`.

**Why compound indexes?**  Postgres can use left-most prefix, so `(account_id, project_id, created_at)` covers:
1. Security policy filtering
2. Project scoping
3. Sorting by recency

For text search / embeddings **(insights.content)** keep existing `gin` index; add a partial variant per project only if necessary.

---

## 5. URL Filter & Sorting Module

### Goals
1. Single source of truth for list-view filters (segment, personaId, tagId, search, sort, page).
2. Reflect current filters in `location.search` so that the URL is shareable.
3. Provide helpers to translate params ➜ DB query options.

### Proposed API (`app/lib/useUrlFilters.ts`)
```ts
interface FilterSpec {
  sort?: 'latest' | 'oldest' | 'az' | 'za';
  personaId?: string;
  tagId?: string;
  search?: string;
  page?: number;
}

export function useUrlFilters(defaults: FilterSpec = {}) {
  const [filters, setFilters] = useSearchParamsDerived<FilterSpec>(defaults)
  const apply = (updates: Partial<FilterSpec>) => setFilters({ ...filters, ...updates })
  return { filters, apply }
}
```
* `useSearchParamsDerived` is a tiny wrapper around `useSearchParams` that keeps types & defaults.
* UI widgets call `apply({ sort: 'latest' })`, which updates state **and** pushes URL.
* Loaders read `request.url` or `params` to apply `.order()` / `.eq()` clauses.

### Server-side helper
```ts
export function buildQuery<T>(
  qb: PostgrestFilterBuilder<T>,
  { personaId, tagId, search, sort }: FilterSpec,
) {
  if (personaId) qb.eq('persona_id', personaId)
  if (tagId) qb.contains('insight_tags', [tagId])
  if (search) qb.ilike('title', `%${search}%`)
  switch (sort) {
    case 'oldest': qb.order('created_at', { ascending: true }); break
    case 'az': qb.order('title', { ascending: true }); break
    case 'za': qb.order('title', { ascending: false }); break
    default: qb.order('created_at', { ascending: false })
  }
  return qb
}
```

---

## 6. Migration & Roll-Out Plan

1. **Add `project_id` to `people`, `personas`, and any missing tables.**  Back-fill with each entity’s parent interview/insight project.
2. **Update RLS policies** to require both `account_id` and `project_id`.
3. **Refactor server helpers** (`userContext`, typed `db.ts` functions) to accept `projectId`.
4. **Update loaders/actions** – search/replace `.eq('account_id'` with compound filter, or centralise in helper.
5. **Create indexes** listed above in a single migration `202508010930_add_project_scoping_indexes.sql`.
6. **Introduce `useUrlFilters` module** and migrate list pages incrementally (interviews ➜ insights ➜ people…).

---

## 7. Confidence & Alternatives

**Confidence:** 87%  – Analysis based on sampled code; some files not inspected may already handle `project_id`.  Validate with schema diff + integration tests.

**Alternatives:**
1. Encode `current_project_id` in Postgres `SET LOCAL` and rely on RLS using `current_setting()` – cleaner SQL but more plumbing in Supabase Edge Functions.
2. Store `project_id` only in parent entity (interview) and infer via joins for child tables.  Reduces redundancy but complicates queries.

Quick spike: run dataset with two projects, execute `getInterviews` – confirm duplicate rows appear → validates need for change.

---

## 8. Next Steps
* Create migration & helper module (tickets linked).
* Add integration tests to ensure project isolation.
* Benchmark new indexes after back-fill.
