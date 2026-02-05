# My Responses Page - RLS Issue (UNRESOLVED)

## Problem
The "My Responses" page (`/my-responses`) does not load the user's survey responses. The page shows "No responses yet" even when the user has submitted surveys.

## Error in Console
```
HEAD https://auth.getupsight.com/rest/v1/research_link_responses?select=id%2Cresearch_links%21inner%28project_id%29&research_links.project_id=eq.6037e476-a6ed-472b-b5c0-0877fe632446 500 (Internal Server Error)
```

## Root Cause
The 500 error comes from `app/hooks/useSidebarCounts.tsx` lines 119-121:
```typescript
supabase
    .from("research_link_responses")
    .select("id, research_links!inner(project_id)", { count: "exact", head: true })
    .eq("research_links.project_id", projectId),
```

This query triggers a **circular RLS policy dependency**:

1. Query `research_link_responses` → RLS policy "Members can read research link responses" runs
2. That policy does: `research_link_id IN (SELECT id FROM research_links WHERE ...)`
3. Querying `research_links` triggers its RLS policies
4. Policy "Users can read research links they responded to" does: `id IN (SELECT get_user_response_link_ids())`
5. `get_user_response_link_ids()` queries `research_link_responses` → back to step 1 = INFINITE LOOP

## Files I Modified

### New Migrations (may need to be reverted/fixed)
1. `supabase/migrations/20260115200000_allow_users_read_own_responses.sql`
   - Added RLS policy "Users can read own responses by email" on `research_link_responses`
   - Added RLS policy "Users can read research links they responded to" on `research_links`
   - Added RLS policy "Users can read accounts they responded to" on `accounts.accounts`

2. `supabase/migrations/20260115210000_fix_my_responses_rls.sql`
   - Created `security_definer` functions to try to break circular dependency:
     - `get_user_response_link_ids()`
     - `get_user_response_account_ids()`
     - `user_has_response_for_link()`
   - Recreated policies to use these functions

3. `supabase/migrations/20260115220000_fix_responses_rls_circular.sql`
   - Created `get_account_research_link_ids()` function
   - Recreated "Members can read research link responses" policy to use this function

### Page File
- `app/features/home/pages/my-responses.tsx` - The page that should show user's responses

### Route
- `app/features/home/routes.ts` line 6: `route("my-responses", "./features/home/pages/my-responses.tsx")`

## What the Page Needs to Do
1. User goes to `/my-responses` (not a protected route)
2. Get user's email from `supabase.auth.getUser()`
3. Query `research_link_responses` where `email` matches user's email
4. Join to `research_links` to get survey name, questions
5. Join to `accounts` to get account name
6. Display the responses

## The Query in my-responses.tsx
```typescript
const { data: rawResponses } = await supabase
    .from("research_link_responses")
    .select(`
      id,
      responses,
      completed,
      created_at,
      research_links!inner (
        id,
        name,
        slug,
        questions,
        accounts!inner (
          name
        )
      )
    `)
    .eq("email", user.email.toLowerCase())
    .eq("completed", true)
    .order("created_at", { ascending: false });
```

## Current RLS Policies on research_link_responses
```sql
-- Policy 1: For team members
"Members can read research link responses"
    using (research_link_id IN (SELECT get_account_research_link_ids()))

-- Policy 2: For users viewing their own responses
"Users can read own responses by email"
    using (lower(email) = lower(auth.jwt() ->> 'email'))
```

## Current RLS Policies on research_links
```sql
-- Policy 1: For team members
"Members can read research links"
    using (account_id IN (SELECT accounts.get_accounts_with_role()))

-- Policy 2: For users who responded (THIS MAY BE THE PROBLEM)
"Users can read research links they responded to"
    using (id IN (SELECT get_user_response_link_ids()))
```

## Potential Fix Approaches
1. **Remove the circular policies entirely** - Delete migrations 20260115200000, 20260115210000, 20260115220000 and find another approach
2. **Use a different RLS strategy** - Maybe use a view with `security_definer` instead of policies
3. **Bypass RLS for the my-responses query** - Use a server-side function that runs as `security_definer`
4. **Fix the sidebar query** - Change `useSidebarCounts.tsx` to not trigger the circular dependency

## To Revert My Changes
```bash
# Connect to remote database and run:
DROP POLICY IF EXISTS "Users can read own responses by email" ON public.research_link_responses;
DROP POLICY IF EXISTS "Users can read research links they responded to" ON public.research_links;
DROP POLICY IF EXISTS "Users can read accounts they responded to" ON accounts.accounts;
DROP FUNCTION IF EXISTS public.get_user_response_link_ids();
DROP FUNCTION IF EXISTS public.get_user_response_account_ids();
DROP FUNCTION IF EXISTS public.user_has_response_for_link(uuid);
DROP FUNCTION IF EXISTS public.get_account_research_link_ids();

# Then recreate the original policy:
CREATE POLICY "Members can read research link responses"
    ON public.research_link_responses
    FOR SELECT
    USING (
        research_link_id IN (
            SELECT id FROM public.research_links
            WHERE account_id IN (SELECT accounts.get_accounts_with_role())
        )
    );
```

## Schema File to Update
The declarative schema is at `supabase/schemas/18_research_links.sql` - this should be updated to match whatever final solution is implemented.
