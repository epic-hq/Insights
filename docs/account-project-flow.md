# Account & Project Data Flow - Best Practices

## Overview

This document captures the essential patterns and best practices for implementing proper multi-tenant data relationships using `account_id` and `project_id` in a Supabase + React Router 7 application.

## 🎯 Core Principles

### 1. **Always Use `account_id` (Not `user.auth().id`)**
```typescript
// ✅ CORRECT - Use account_id from session context
const accountId = userContext.account_id

// ❌ WRONG - Don't use auth user ID directly
const userId = user.id
```

**Why:** In multi-tenant SaaS, users can belong to multiple accounts. The `account_id` represents the current organizational context, while `user.auth().id` is the individual user's identity.

### 2. **Enforce Project-Level Data Isolation**
All project-related entities must be scoped by both `account_id` AND `project_id`:

```typescript
// ✅ CORRECT - Dual scoping
const { data } = await supabase
  .from('interviews')
  .select('*')
  .eq('account_id', accountId)
  .eq('project_id', projectId)

// ❌ WRONG - Account-only scoping allows cross-project leakage
const { data } = await supabase
  .from('interviews')
  .select('*')
  .eq('account_id', accountId)
```

### 3. **Standardized Database Function Signatures**
All database functions should follow this consistent pattern:

```typescript
export async function getEntityById({
  supabase,
  accountId,
  projectId, // Required for project-scoped entities
  id
}: {
  supabase: SupabaseClient
  accountId: string
  projectId: string
  id: string
}) {
  return await supabase
    .from('entity_table')
    .select('*')
    .eq('account_id', accountId)
    .eq('project_id', projectId)
    .eq('id', id)
    .single()
}
```

## 🏗️ Implementation Patterns

### URL Structure & Parameter Extraction

**RESTful URL Hierarchy:**

```text
/accounts/:accountId/projects/:projectId/interviews
/accounts/:accountId/projects/:projectId/people
/accounts/:accountId/projects/:projectId/opportunities
```

**Both accountId and projectId support UUID or slug format:**

- UUID: `/accounts/123e4567-e89b-12d3-a456-426614174000/projects/456e7890-e89b-12d3-a456-426614174001/interviews`
- Slug: `/accounts/acme-corp/projects/user-research/interviews`

### Database Layer (`features/{entity}/db.ts`)

**Standard CRUD Pattern:**
```typescript
// Read Operations
export const getEntities = async ({ supabase, accountId, projectId }) => { ... }
export const getEntityById = async ({ supabase, accountId, projectId, id }) => { ... }

// Write Operations  
export const createEntity = async ({ supabase, data }) => { ... } // data includes account_id, project_id
export const updateEntity = async ({ supabase, accountId, projectId, id, data }) => { ... }
export const deleteEntity = async ({ supabase, accountId, projectId, id }) => { ... }
```

**Key Requirements:**
- All functions require `accountId` parameter
- Project-scoped entities require `projectId` parameter
- All queries filter by both `account_id` and `project_id`
- Create operations include both IDs in the data payload

### Route Loader Pattern

**Extract Both IDs from URL Parameters (CORRECT):**
```typescript
export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext)
  const supabase = ctx.supabase
  
  // Both from URL params - consistent, explicit, RESTful
  const accountId = params.accountId   // From URL: /accounts/:accountId/...
  const projectId = params.projectId   // From URL: .../projects/:projectId/...
  
  // Session context used only for authentication verification
  // URL params provide explicit resource context
  
  const { data, error } = await getEntities({ 
    supabase, 
    accountId, 
    projectId 
  })
  
  if (error) throw new Response("Not found", { status: 404 })
  return { entities: data }
}
```

### Upload/Processing Flow Pattern

**Always Extract Real Context:**
```typescript
// ✅ CORRECT - Extract from authenticated session
export async function action({ request, context }: ActionFunctionArgs) {
  const ctx = context.get(userContext)
  const accountId = ctx.account_id
  
  const formData = await request.formData()
  const projectId = formData.get('projectId') as string
  
  await processInterviewTranscript({
    accountId,    // From authenticated session
    projectId,    // From form/URL context
    // ... other data
  })
}

// ❌ WRONG - Hardcoded or placeholder values
const accountId = "00000000-0000-0000-0000-000000000001"
const projectId = "00000000-0000-0000-0000-000000000002"
```

## 🔒 Security Considerations

### Row Level Security (RLS) + Project Scoping

**Database Policies:**
```sql
-- Account-level RLS (base security)
CREATE POLICY "Users can only access their account data" ON interviews
  FOR ALL USING (account_id = auth.jwt() ->> 'account_id');

-- Application-level project scoping (additional isolation)
-- Enforced in application queries, not database policies
```

**Why This Approach:**
- RLS provides account-level security boundary
- Application-level project filtering prevents cross-project data leakage
- Allows for future features like cross-project analytics with proper permissions

### Authentication Context Flow

```typescript
// 1. User authenticates → Session established
// 2. Middleware extracts account_id from JWT claims
// 3. URL provides project context: /accounts/:accountId/projects/:projectId
// 4. All database operations use both IDs for proper scoping
```

## 📊 Entity Categorization

### Account-Scoped Only
- `accounts` - The organization/team entity
- `users` - Individual user profiles
- `account_settings` - Organization preferences

### Project-Scoped (Require Both IDs)
- `interviews` - Interview recordings and transcripts
- `people` - Interview participants
- `personas` - User personas/segments
- `opportunities` - Business opportunities
- `insights` - AI-generated insights
- `tags` - Categorization labels

### Global/System-Level
- `auth.users` - Supabase authentication
- System configuration tables

## 🚨 Common Pitfalls & Solutions

### 1. **Hardcoded Test IDs in Production Code**
```typescript
// ❌ PROBLEM
const accountId = "00000000-0000-0000-0000-000000000001" // TODO: Replace

// ✅ SOLUTION
const ctx = context.get(userContext)
const accountId = ctx.account_id
```

### 2. **Inconsistent Project Scoping**
```typescript
// ❌ PROBLEM - Some entities filtered by project, others not
const interviews = await getInterviews({ supabase, accountId }) // Missing projectId
const insights = await getInsights({ supabase, accountId, projectId }) // Has projectId

// ✅ SOLUTION - Consistent scoping
const interviews = await getInterviews({ supabase, accountId, projectId })
const insights = await getInsights({ supabase, accountId, projectId })
```

### 3. **Inconsistent Parameter Sources**
```typescript
// ❌ PROBLEM - Mixing session context and URL params
export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext)
  const accountId = ctx.account_id      // From session context
  const projectId = params.projectId    // From URL params
  return await getEntities({ supabase: ctx.supabase, accountId, projectId })
}

// ✅ SOLUTION - Both from URL params (consistent source)
export async function loader({ context, params }: LoaderFunctionArgs) {
  const ctx = context.get(userContext)
  const supabase = ctx.supabase
  // Both from URL - explicit, consistent, RESTful
  const accountId = params.accountId    // From URL: /accounts/:accountId/...
  const projectId = params.projectId    // From URL: .../projects/:projectId/...
  return await getEntities({ supabase, accountId, projectId })
}
```

## 🔄 Migration Strategy

When updating existing code to follow these patterns:

### 1. **Database Functions First**
- Update all `db.ts` files to require `projectId`
- This will cause TypeScript errors in calling code

### 2. **Fix Route Loaders**
- Update loaders to extract `projectId` from URL params
- Pass `projectId` to database functions

### 3. **Update Upload/Processing Flows**
- Replace hardcoded IDs with real session context
- Ensure all data creation includes both IDs

### 4. **Test End-to-End**
- Verify data isolation works correctly
- Test that users can't access other projects' data

## 🧪 Testing Approach

### Unit Tests - Pure Business Logic
```typescript
// Test pure functions without database dependencies
describe('buildPersonName', () => {
  it('should generate name from AI data', () => {
    const result = buildPersonName({ aiName: 'John Doe' })
    expect(result).toBe('John Doe')
  })
})
```

### Integration Tests - Database Operations
```typescript
// Test with real Supabase instance and seeded data
describe('getInterviews', () => {
  it('should filter by account and project', async () => {
    const result = await getInterviews({ 
      supabase, 
      accountId: TEST_ACCOUNT_ID, 
      projectId: TEST_PROJECT_ID 
    })
    expect(result.data).toHaveLength(2)
  })
})
```

## 📈 Performance Considerations

### Database Indexing
```sql
-- Ensure compound indexes for efficient filtering
CREATE INDEX idx_interviews_account_project ON interviews(account_id, project_id);
CREATE INDEX idx_people_account_project ON people(account_id, project_id);
```

### Query Optimization
- Always filter by both `account_id` and `project_id` in the same query
- Use Supabase's PostgREST join syntax for related data
- Avoid N+1 queries by fetching related data in single queries

## 🎯 Success Metrics

A properly implemented account/project flow should achieve:

- ✅ **Zero Cross-Project Data Leakage** - Users cannot access other projects' data
- ✅ **Consistent API Surface** - All database functions follow the same pattern
- ✅ **Type Safety** - TypeScript enforces required parameters
- ✅ **Performance** - Efficient queries with proper indexing
- ✅ **Maintainability** - Clear patterns for future development

## 🔗 Related Documentation

- [Multi-Tenant SaaS Architecture](./multi-tenant-architecture.md)
- [Database Schema Design](./database-schema.md)
- [Authentication & Authorization](./auth-patterns.md)
- [Testing Strategies](./testing-strategies.md)

---

**Last Updated:** August 2025  
**Status:** ✅ Implemented and Validated
