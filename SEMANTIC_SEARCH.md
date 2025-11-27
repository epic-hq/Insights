# Semantic Search & Clustering

## Overview

This system uses OpenAI text-embedding-3-small (1536 dimensions) to enable semantic search and clustering of themes, evidence, and person facets.

## Database Functions

### 1. Find Similar Themes

Find themes similar to a query embedding using cosine similarity.

```typescript
const { data } = await supabase.rpc('find_similar_themes', {
  query_embedding: [0.1, 0.2, ...], // 1536-dim vector
  project_id_param: projectId,
  match_threshold: 0.7,  // Default: 0.7 (70% similarity)
  match_count: 10        // Max results
});

// Returns: { id, name, statement, similarity }[]
```

**Use Cases:**
- Find duplicate/similar themes for consolidation
- Discover related themes when analyzing evidence
- Theme recommendations

### 2. Find Similar Evidence

Find evidence similar to a query embedding.

```typescript
const { data } = await supabase.rpc('find_similar_evidence', {
  query_embedding: [0.1, 0.2, ...],
  project_id_param: projectId,
  match_threshold: 0.7,
  match_count: 10
});

// Returns: { id, verbatim, similarity }[]
```

**Use Cases:**
- Detect duplicate evidence across interviews
- Find supporting quotes for themes
- Evidence clustering

### 3. Find Duplicate Themes

Find all pairs of similar themes within a project (for consolidation).

```typescript
const { data } = await supabase.rpc('find_duplicate_themes', {
  project_id_param: projectId,
  similarity_threshold: 0.85  // Default: 0.85 (85% similarity)
});

// Returns: {
//   theme_id_1, theme_id_2,
//   theme_name_1, theme_name_2,
//   similarity
// }[]
```

**Use Cases:**
- Automated theme deduplication
- Quality control during theme generation
- Theme consolidation workflows

### 4. Search Themes by Text (Semantic)

Search themes using natural language queries.

```typescript
const { data } = await supabase.rpc('search_themes_semantic', {
  query_text: 'difficult to collaborate with team members',
  project_id_param: projectId,
  match_threshold: 0.7,
  match_count: 10
});

// Returns: { id, name, pain, statement, category, journey_stage, similarity }[]
```

**Current Status:** Falls back to ILIKE text search until embeddings are generated.

**Use Cases:**
- User search interface
- Natural language theme discovery
- Smart filters

### 5. Find Themes by Person Facet (Semantic User Segmentation)

Find themes relevant to people with specific attributes (job roles, behaviors, etc.).

```typescript
const { data } = await supabase.rpc('find_themes_by_person_facet', {
  facet_label_query: 'Product Manager',
  project_id_param: projectId,
  match_threshold: 0.6,
  match_count: 20
});

// Returns: {
//   theme_id, theme_name, theme_pain,
//   similarity, person_count
// }[]
```

**Use Cases:**
- Persona-specific insights: "What do Product Managers struggle with?"
- Segment analysis: "Themes for enterprise vs SMB customers"
- Behavioral targeting: "Issues faced by power users"

### 6. Find Person Facet Clusters (Semantic Segment Grouping)

Group similar person attributes for segment creation.

```typescript
const { data } = await supabase.rpc('find_person_facet_clusters', {
  project_id_param: projectId,
  kind_slug_param: 'job_title',  // 'job_title', 'industry', 'value', etc.
  similarity_threshold: 0.75
});

// Returns: {
//   person_facet_id_1, person_facet_id_2,
//   facet_account_id_1, facet_account_id_2,
//   label_1, label_2,
//   similarity, combined_person_count
// }[]
```

**Example Results:**
```
Product Manager    + PM                → 85% similar, 23 people
Product Lead       + Product Manager   → 78% similar, 31 people
Software Engineer  + Developer         → 82% similar, 45 people
```

**Use Cases:**
- Auto-merge similar segment labels ("Product Manager" + "PM" + "Product Lead")
- Discover natural user segments
- Clean up messy facet data

## Embedding Generation

### Automatic Queue System

**Architecture:**
1. **Triggers**: Auto-enqueue when themes/evidence/person_facets are created/updated
2. **Queue**: PostgreSQL Message Queue (PGMQ) with 3 separate queues
3. **Processor**: pg_cron runs every minute, calls Edge Functions
4. **Edge Function**: Calls OpenAI API, writes embedding back to database

**Queues:**
- `insights_embedding_queue` - Themes & legacy insights
- `person_facet_embedding_queue` - Person attributes for segmentation
- `facet_embedding_queue` - Evidence facets

### Manual Embedding Generation

```typescript
// Via Edge Function (requires auth)
const response = await fetch(
  'https://rbginqvgkonnoktrttqv.functions.supabase.co/embed',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      table: 'themes',  // or 'insights'
      id: themeId,
      name: 'Theme name',
      pain: 'Pain point description'
    })
  }
);
```

### Check Embedding Status

```sql
-- Theme embeddings
SELECT
  COUNT(*) as total,
  COUNT(embedding) as with_embeddings,
  ROUND(COUNT(embedding)::numeric / COUNT(*)::numeric * 100, 1) as percent
FROM themes;

-- Person facet embeddings (for segmentation)
SELECT
  COUNT(*) as total,
  COUNT(embedding) as with_embeddings
FROM person_facet;

-- Evidence embeddings
SELECT
  COUNT(*) as total,
  COUNT(embedding) as with_embeddings
FROM evidence;
```

## Implementation Examples

### Theme Deduplication Workflow

```typescript
// 1. Find all duplicate theme pairs
const { data: duplicates } = await supabase.rpc('find_duplicate_themes', {
  project_id_param: projectId,
  similarity_threshold: 0.85
});

// 2. Group into clusters
const clusters = groupIntoClusters(duplicates);

// 3. Merge each cluster
for (const cluster of clusters) {
  const primaryTheme = cluster[0];
  const duplicateIds = cluster.slice(1);

  // Reassign evidence to primary theme
  await supabase
    .from('theme_evidence')
    .update({ theme_id: primaryTheme.id })
    .in('theme_id', duplicateIds);

  // Delete duplicates
  await supabase
    .from('themes')
    .delete()
    .in('id', duplicateIds);
}
```

### Smart Theme Recommendations

```typescript
// When user is viewing a theme, show related themes
const currentTheme = await getTheme(themeId);

// Generate embedding for current theme (if not exists)
if (!currentTheme.embedding) {
  await generateEmbedding(currentTheme);
}

// Find similar themes
const { data: related } = await supabase.rpc('find_similar_themes', {
  query_embedding: currentTheme.embedding,
  project_id_param: projectId,
  match_threshold: 0.6,
  match_count: 5
});

// Filter out current theme
const recommendations = related.filter(t => t.id !== themeId);
```

### Persona-Based Filtering

```typescript
// User selects "Product Managers" segment
const { data: themes } = await supabase.rpc('find_themes_by_person_facet', {
  facet_label_query: 'Product Manager',
  project_id_param: projectId,
  match_threshold: 0.6,
  match_count: 20
});

// Display top themes affecting Product Managers
console.log(themes.map(t => ({
  name: t.theme_name,
  pain: t.theme_pain,
  affectedPeople: t.person_count,
  relevance: `${(t.similarity * 100).toFixed(0)}%`
})));
```

### Auto-Clustering Segments

```typescript
// Find all similar job titles to merge
const { data: clusters } = await supabase.rpc('find_person_facet_clusters', {
  project_id_param: projectId,
  kind_slug_param: 'job_title',
  similarity_threshold: 0.75
});

// Suggest merges to user
const suggestions = clusters.map(c => ({
  suggestion: `Merge "${c.label_1}" with "${c.label_2}"`,
  affectedPeople: c.combined_person_count,
  confidence: `${(c.similarity * 100).toFixed(0)}%`
}));
```

## Performance Considerations

### Index Strategy

All embedding columns use HNSW indexes for fast similarity search:

```sql
CREATE INDEX themes_embedding_idx ON themes
  USING hnsw (embedding vector_cosine_ops);
```

**Performance:**
- ~1ms for similarity search on 10K themes
- ~5ms for clustering 1K themes
- Scales to 1M+ vectors

### Query Optimization

**Good:**
```typescript
// Use threshold to limit results
rpc('find_similar_themes', {
  match_threshold: 0.7  // Only 70%+ similarity
})
```

**Bad:**
```typescript
// No threshold = scans entire table
rpc('find_similar_themes', {
  match_threshold: 0.0  // Returns everything
})
```

### Embedding Generation Costs

**OpenAI text-embedding-3-small:**
- $0.02 per 1M tokens
- ~200 tokens per theme (name + pain)
- Cost: ~$0.004 per 1000 themes

**Example:**
- 10,000 themes = $0.04
- 100,000 evidence = $0.20
- 50,000 person facets = $0.10

## Troubleshooting

### No Results from Semantic Search

**Check embeddings exist:**
```sql
SELECT COUNT(*) FROM themes WHERE embedding IS NOT NULL;
```

**Check queue status:**
```sql
SELECT COUNT(*) FROM pgmq.q_insights_embedding_queue;
```

**Manually process queue:**
```sql
SELECT process_embedding_queue();
```

### Low Similarity Scores

Lower the threshold:
```typescript
match_threshold: 0.5  // Instead of 0.7
```

Or check embedding quality:
```sql
SELECT name, pain, embedding_model, embedding_generated_at
FROM themes
WHERE embedding IS NOT NULL
LIMIT 5;
```

### Queue Not Draining

**Check cron job:**
```sql
SELECT jobname, schedule, active
FROM cron.job
WHERE command LIKE '%process_embedding_queue%';
```

**Check Edge Function logs:**
```bash
supabase functions logs embed --tail
```

## Future Enhancements

1. **Hybrid Search**: Combine semantic + keyword search
2. **Multi-lingual**: Support non-English embeddings
3. **Custom Models**: Fine-tune embeddings on domain data
4. **Real-time**: WebSocket updates for live clustering
5. **Batch Operations**: Bulk re-embedding when model upgrades
