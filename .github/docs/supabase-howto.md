# Supabase How To

## Supabase Declarative Schemas

All data definitions start in this manner, defining a schema in `supabase/schemas`, then letting supabase generate migration files. [docs](https://supabase.com/docs/guides/local-development/declarative-database-schemas)

`supabase db diff -f description` to generate a migration. This will create a new migration file in the `supabase/migrations` directory. then `supabase migrations up` to apply the migration to the local database.

We should then run `supabase db push` to apply the migration to the database. or `supabase db reset` to reset the database to the state of the migration files. It will drop the database and recreate it from the migration files and run seed.sql.

`supabase db push --linked` to apply the migration to the database in the cloud.

## Generate types for Typescript

```bash
supabase gen types typescript --project-id rbginqvgkonnoktrttqv > supabase/types.ts
```

## Queues

Great pattern to use to offload long running tasks from the main thread, DB.
Using for embeddings, and transcriptions (goal).
Inspired by: [blog](https://supabase.com/docs/guides/ai/automatic-embeddings?queryGroups=database-method&database-method=dashboard)

### pgmq

[pgmq](https://github.com/pgmq/pgmq)
[supabase quick start](https://supabase.com/blog/supabase-queues)

### Cron Jobs

[supabase quick start](https://supabase.com/blog/supabase-cron)

## Edge Functions

[quickstart](https://supabase.com/docs/guides/functions/quickstart)

Run deno locally. `supabase functions serve --env-file .env`
But note we can't run pgmq in local setup as it's not included in the supabase docker image that runs locally. Future we could build custom docker with it. Opting to run it in the cloud for now.

## Vault

[supabase quick start](https://supabase.com/blog/supabase-vault)

```sql
-- show all secrets
select *
from vault.decrypted_secrets
order by created_at desc
limit 3;
```

## Triggers & Functions

Useful queries to troubleshoot. Show all triggers:

```sql
SELECT
  event_object_table AS table_name,
  trigger_name,
  action_timing AS timing,
  event_manipulation AS event,
  action_statement AS function
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY table_name, trigger_name;
```

Show all functions:

```sql
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_catalog.pg_get_function_result(p.oid) AS return_type,
  l.lanname AS language,
  pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'  -- 'f' = function, 'p' = procedure, 'a' = aggregate
ORDER BY function_name;
```

### Object Storage

For big objects, use cloudflare R2. TODO: setup.
Temp sample data in public bucket here: <https://pub-42266a6f0dc2457390b9226bc379c90d.r2.dev/sample_interviews/1007%20Participant%207.m4a>

How To Setup: [ref](https://developers.cloudflare.com/r2/buckets/public-buckets/)

## Auth with JWT-Signing in Remix/ReactRouter7

The key shift is from using Supabase's auth system to using JWT signing keys.

This is an upgraded, more secure way to authenticate users in the app server and client side with asymmetric JWT signing keys. Essentially, embedding authNZ in the token claims with a private key that is only known to the app server and client side. And good for a limted time and needs to be refreshed. This reduces time to authorize actions from hundreds to a few ms, even in a distributed environment.

This uses cookies to store the JWT token and syncs the session with the cookie and backend. [docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=remix&queryGroups=environment&environment=remix-loader#set-environment-variables)

### Server - use in loaders and actions (SSR)

We have created helper function to get the user from the request (specifically the cookie token claims which contains the user metadata object if authenticated):

```ts
// app/lib/supabase.server.ts
import { createServerClient } from '@supabase/ssr'

export const supabase = createServerClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)
```

The pattern to use in loaders/actions is this:

```ts
import { getServerClient } from "~/lib/supabase/server"
import type { InsightView } from "~/types"

export const meta: MetaFunction = () => {
 return [
  { title: "Insights | Research Insights" },
  { name: "description", content: "All research insights from interviews" },
 ]
}

// Load insights from Supabase
export async function loader({ request }: { request: Request }) {
 const { client: supabase } = getServerClient(request)
 const { data: jwt } = await supabase.auth.getClaims()
 const accountId = jwt?.claims.sub

 const url = new URL(request.url)

 // Query params
 const sort = url.searchParams.get("sort") || "default"
 const interviewFilter = url.searchParams.get("interview") || null
 const themeFilter = url.searchParams.get("theme") || null
 const personaFilter = url.searchParams.get("persona") || null

 // Build base query with account filtering for RLS
 type InsightRow = Database["public"]["Tables"]["insights"]["Row"]
 let query = supabase
  .from("insights")
  .select("*")
  .eq("account_id", accountId)

 const { data: rows, error } = await query
 if (error) {
  throw new Response(`Error fetching insights: ${error.message}`, { status: 500 })
 }
 return {insights: rows }
}
```

Then in the React FE components use loader data, or grab objects we previously loaded and stored in AuthContext:

```ts
export default function Insights() {
 const { insights, filters } = useLoaderData<typeof loader>()

 return (
  <div>
   <InsightsDataTable insights={insights} filters={filters} />
  </div>
 )
}
```

**Protected Routes** - do it from server side and redirect so you can assume on the route page they’re authenticated

```ts
// routes/_protected.tsx
export async function loader({ request }: LoaderArgs) {
  const user = await getUserFromRequest(request)
  if (!user) throw redirect("/login")
  return json({ user })
}

export default function ProtectedLayout() {
  const { user } = useLoaderData<typeof loader>()
  return <Outlet />
}
```

### Client in Browser

Use createBrowserClient only in the browser, to let your Remix app interact with Supabase on the client-side (e.g., login, sign-up, auth state tracking, real-time updates

```ts
// app/lib/supabase.client.ts
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)
```

```ts
// app/components/LoginForm.tsx
import { supabase } from '~/lib/supabase.client'

function LoginForm() {
  async function handleLogin(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) alert("Login failed")
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleLogin("rocko@email.com") }}>
      <button type="submit">Login</button>
    </form>
  )
}
```

Track Auth State

```tsx
useEffect(() => {
  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    // sync session with cookie/backend
  })
  return () => listener.subscription.unsubscribe()
}, [])
```

## Query details

Running queries across schemas can be difficult with joins and foreign keys. Had to add `account` to the schemas array in config.toml to expose the account schema to PostgREST.

```toml
schemas = ["public", "graphql_public", "accounts", "pgmq_public"]
```
