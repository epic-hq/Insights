# Semantic Segment Clustering (Future Enhancement)

## Current State (Quick Fix)

Groups people by **facet KIND only**:
- All people with "preference" facets → "Preferences" group
- All people with "tool" facets → "Tool Users" group

**Problem:** Loses granularity. Can't distinguish:
- "Solo workers" vs "Visual learners" (both preference)
- "Notion users" vs "Figma users" (both tool)

## Target State (Semantic Clustering)

Group semantically similar facet labels within each kind:
- "prefers solo work" + "works better alone" → "Independent Workers"
- "uses Notion" + "uses Evernote" → "Note-taking Tool Users"
- "uses Figma" + "uses Sketch" → "Design Tool Users"

## Implementation Plan

### Phase 1: Generate Embeddings
```typescript
// Add to evidence processing pipeline
for (const facet of person_facets) {
  if (SEGMENT_FACET_KINDS.includes(facet.kind_slug)) {
    const embedding = await generateEmbedding(facet.label)
    await supabase
      .from('person_facet')
      .update({ embedding })
      .eq('id', facet.id)
  }
}
```

### Phase 2: Cluster Similar Labels
```typescript
// In deriveUserGroups.server.ts
async function clusterFacetsBySemantics(
  facets: PersonFacet[],
  kindSlug: string,
  minClusterSize: number = 2
): Promise<FacetCluster[]> {
  // Group facets by kind
  const facetsForKind = facets.filter(f => f.kind_slug === kindSlug)

  // Extract embeddings
  const embeddings = facetsForKind.map(f => f.embedding)

  // Cluster using cosine similarity threshold (e.g., 0.85)
  const clusters = hierarchicalCluster(embeddings, 0.85)

  // Create group for each cluster
  return clusters.map(cluster => ({
    name: generateClusterName(cluster.labels), // e.g., "Independent Workers"
    member_ids: cluster.person_ids,
    member_count: cluster.person_ids.length,
    example_labels: cluster.labels.slice(0, 3)
  }))
}

function generateClusterName(labels: string[]): string {
  // Use LLM to generate concise cluster name
  // Input: ["prefers solo work", "works better alone", "values independent work"]
  // Output: "Independent Workers"
}
```

### Phase 3: Update deriveUserGroups
```typescript
export async function deriveUserGroups(opts) {
  // ... existing code ...

  // For each segment kind with people
  for (const kindSlug of uniqueKinds) {
    const clusters = await clusterFacetsBySemantics(
      filteredFacets,
      kindSlug,
      minGroupSize
    )

    groups.push(...clusters.map(c => ({
      type: kindSlug,
      name: c.name,
      description: `${c.name} (e.g., ${c.example_labels.join(', ')})`,
      criteria: {},
      member_count: c.member_count,
      member_ids: c.member_ids
    })))
  }

  return groups
}
```

## Benefits

1. **Fewer, More Meaningful Groups**
   - Current: 13 preference groups (one per person)
   - Target: 2-3 semantic groups ("Independent Workers", "Visual Learners")

2. **Better ICP Recommendations**
   - Can target "Design Tool Users" (Figma+Sketch) vs "Note Tool Users" (Notion+Evernote)
   - More actionable than generic "Tool Users"

3. **Reuses Pain Clustering Logic**
   - Already implemented in `clusterPainsBySemantic()`
   - Same embedding + clustering approach

## Migration Path

1. ✅ **Done:** Quick fix (group by kind)
2. **Next:** Generate embeddings for all person_facet records
3. **Then:** Implement clustering in deriveUserGroups
4. **Finally:** Switch from kind-based to semantic clustering

## Dependencies

- OpenAI embeddings API (already in use for pain clustering)
- `evidence_facet.embedding` pattern (already exists)
- Add `person_facet.embedding` column (similar to evidence_facet)

## Schema Change Needed

```sql
ALTER TABLE person_facet
ADD COLUMN embedding vector(1536);

-- Add index for similarity search
CREATE INDEX person_facet_embedding_idx
ON person_facet
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```
