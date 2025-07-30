# Junction Tables Developer Guide

## Overview

This guide covers how to work with the normalized junction tables that replaced array-based relationships in the database schema.

## Quick Reference

### Junction Tables

| Table | Purpose | Replaces |
|-------|---------|----------|
| `insight_tags` | Tag insights | `insights.related_tags[]` |
| `interview_tags` | Tag interviews | New functionality |
| `opportunity_insights` | Link opportunities to insights | `opportunities.related_insight_ids[]` |
| `project_people` | Track people across projects | Enhanced relationship tracking |
| `persona_insights` | Link insights to personas | New analytics capability |

## Usage Patterns

### Working with Tags

**Add tags to an insight:**

```typescript
import { createServerJunctionManager } from '~/lib/database/junction-server'

// In a loader or action
const junctionManager = await createServerJunctionManager(request)
await junctionManager.insightTags.syncTags(insightId, ['user-feedback', 'pain-point'])
```

**Query insights with tags:**

```typescript
const { data: insights } = await supabase
  .from('insights')
  .select(`
    *,
    insight_tags(tag)
  `)
  .eq('account_id', accountId)

// Transform for UI
const insightsWithTags = insights?.map(insight => ({
  ...insight,
  tags: insight.insight_tags?.map(it => it.tag) || []
}))
```

**Filter insights by tag:**

```typescript
const { data: insights } = await supabase
  .from('insights')
  .select(`
    *,
    insight_tags!inner(tag)
  `)
  .eq('insight_tags.tag', 'user-feedback')
  .eq('account_id', accountId)
```

### Working with Opportunity-Insight Links

**Link insights to an opportunity:**

```typescript
await junctionManager.opportunityInsights.syncInsights(
  opportunityId,
  [insightId1, insightId2],
  [0.8, 0.9] // Optional weights
)
```

**Query opportunity with linked insights:**

```typescript
const { data: opportunity } = await supabase
  .from('opportunities')
  .select(`
    *,
    opportunity_insights(
      insight_id,
      weight,
      insights(id, name, category)
    )
  `)
  .eq('id', opportunityId)
  .single()
```

### Working with Project People

**Track person across projects:**

```typescript
// Automatically handled by interview upload process
// Manual tracking:
await junctionManager.projectPeople.addPerson(projectId, personId, 'primary_user')
```

**Get project statistics:**

```typescript
const { data: projectStats } = await supabase
  .from('project_people')
  .select(`
    *,
    people(name, persona_id),
    personas(name, color_hex)
  `)
  .eq('project_id', projectId)
  .order('interview_count', { ascending: false })
```

## React Hooks

### Client-Side Tag Management

```typescript
import { useInsightTags } from '~/lib/hooks/useJunctionTables'

function InsightTagEditor({ insightId }: { insightId: string }) {
  const { tags, loading, addTags, removeTags, syncTags } = useInsightTags(insightId)

  const handleAddTag = async (newTag: string) => {
    await addTags([newTag])
  }

  const handleRemoveTag = async (tagToRemove: string) => {
    await removeTags([tagToRemove])
  }

  return (
    <div>
      {tags.map(tag => (
        <Badge key={tag} onRemove={() => handleRemoveTag(tag)}>
          {tag}
        </Badge>
      ))}
      <TagInput onAdd={handleAddTag} />
    </div>
  )
}
```

### Opportunity Insights Management

```typescript
import { useOpportunityInsights } from '~/lib/hooks/useJunctionTables'

function OpportunityInsightLinks({ opportunityId }: { opportunityId: string }) {
  const { insights, loading, addInsights, removeInsights } = useOpportunityInsights(opportunityId)

  return (
    <div>
      {insights.map(link => (
        <InsightCard
          key={link.insight_id}
          insight={link.insights}
          weight={link.weight}
          onRemove={() => removeInsights([link.insight_id])}
        />
      ))}
    </div>
  )
}
```

## Server-Side Helpers

### Route Patterns

**Loader with junction data:**

```typescript
import { getServerClient } from '~/lib/supabase/server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { client: supabase } = getServerClient(request)
  const accountId = extractAccountId(request)

  const { data: insight } = await supabase
    .from('insights')
    .select(`
      *,
      insight_tags(tag),
      persona_insights(
        relevance_score,
        personas(name, color_hex)
      )
    `)
    .eq('id', params.insightId)
    .eq('account_id', accountId)
    .single()

  if (!insight) {
    throw new Response('Not Found', { status: 404 })
  }

  return {
    insight: {
      ...insight,
      tags: insight.insight_tags?.map(it => it.tag) || [],
      personas: insight.persona_insights?.map(pi => ({
        ...pi.personas,
        relevance: pi.relevance_score
      })) || []
    }
  }
}
```

**Action with junction updates:**

```typescript
import { createServerJunctionManager } from '~/lib/database/junction-server'

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const insightId = formData.get('insightId') as string
  const tags = formData.getAll('tags') as string[]

  const junctionManager = await createServerJunctionManager(request)
  await junctionManager.insightTags.syncTags(insightId, tags)

  return { success: true }
}
```

## Migration Utilities

### Check Migration Status

```typescript
import { checkMigrationStatus } from '~/utils/migrateArrayData.server'

const status = await checkMigrationStatus(request)
console.log(`Insights migrated: ${status.insightTagsMigrated}/${status.totalInsights}`)
```

### Manual Migration

```typescript
import { migrateArrayData } from '~/utils/migrateArrayData.server'

// Migrate all array data to junction tables
const results = await migrateArrayData(request, { dryRun: false })
```

## Performance Tips

### Efficient Queries

**Good - Use select with specific fields:**

```typescript
.select('id, name, insight_tags(tag)')
```

**Better - Use inner joins for filtering:**

```typescript
.select('*, insight_tags!inner(tag)')
.eq('insight_tags.tag', 'specific-tag')
```

**Best - Use indexes effectively:**

```typescript
// These queries use indexes efficiently
.eq('insight_tags.tag', 'tag-name')           // Uses idx_insight_tags_tag
.eq('insight_tags.insight_id', insightId)     // Uses idx_insight_tags_insight_id
.eq('insight_tags.account_id', accountId)     // Uses idx_insight_tags_account_id
```

### Batch Operations

```typescript
// Efficient batch tag sync
await junctionManager.insightTags.batchSync([
  { insightId: 'id1', tags: ['tag1', 'tag2'] },
  { insightId: 'id2', tags: ['tag2', 'tag3'] }
])
```

## Common Patterns

### Tag Analytics

```typescript
// Get tag usage statistics
const { data: tagStats } = await supabase
  .from('insight_tags')
  .select('tag')
  .eq('account_id', accountId)

const tagCounts = tagStats?.reduce((acc, { tag }) => {
  acc[tag] = (acc[tag] || 0) + 1
  return acc
}, {} as Record<string, number>)
```

### Cross-Entity Relationships

```typescript
// Find insights related to specific people
const { data: personInsights } = await supabase
  .from('insights')
  .select(`
    *,
    interviews!inner(
      interview_people!inner(
        people!inner(id, name)
      )
    )
  `)
  .eq('interviews.interview_people.people.id', personId)
```

## Error Handling

### Common Issues

1. **Foreign Key Violations:**

   ```typescript
   // Ensure tag exists before creating junction record
   await junctionManager.insightTags.ensureTagExists(tagName)
   ```

2. **Account Isolation:**

   ```typescript
   // Always include account_id in queries
   .eq('account_id', accountId)
   ```

3. **RLS Policies:**

   ```typescript
   // Use authenticated client
   const { client: supabase } = getServerClient(request)
   ```

## Testing

### Integration Tests

```typescript
import { testDb } from '~/test/utils/testDb'

test('should create insight-tag relationships', async () => {
  const { data: insight } = await testDb
    .from('insights')
    .insert({ name: 'Test Insight', account_id: TEST_ACCOUNT_ID })
    .select()
    .single()

  await testDb
    .from('insight_tags')
    .insert({
      insight_id: insight.id,
      tag: 'test-tag',
      account_id: TEST_ACCOUNT_ID
    })

  const { data: tags } = await testDb
    .from('insight_tags')
    .select('tag')
    .eq('insight_id', insight.id)

  expect(tags).toHaveLength(1)
  expect(tags[0].tag).toBe('test-tag')
})
```

## Troubleshooting

### Debug Queries

```typescript
// Enable query logging
const { data, error } = await supabase
  .from('insights')
  .select('*, insight_tags(tag)')
  .eq('account_id', accountId)

if (error) {
  console.error('Query error:', error)
  console.error('Error details:', error.details)
}
```

### Check Constraints

```sql
-- Verify foreign key relationships
SELECT
  i.id as insight_id,
  i.name,
  it.tag,
  t.tag as tag_exists
FROM insights i
LEFT JOIN insight_tags it ON i.id = it.insight_id
LEFT JOIN tags t ON it.tag = t.tag
WHERE i.account_id = 'your-account-id'
```

## Migration Checklist

When working with junction tables:

- Use helper functions instead of direct SQL
- Include account_id in all queries
- Handle loading states in UI
- Test with real database in integration tests
- Use proper indexes for performance
- Validate foreign key relationships
- Handle RLS policy requirements
- Implement proper error handling
