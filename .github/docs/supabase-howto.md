# Supabase How To

## Supabase Declarative Schemas

All data definitions start in this manner, defining a schema in `supabase/schemas`, then letting supabase generate migration files. [docs](https://supabase.com/docs/guides/local-development/declarative-database-schemas)

The minimal declarative loop:

1. Edit `supabase/schemas/*.sql` (or add a new one).
2. `supabase db diff -f <brief_name>`
→ auto-generates a new file in `supabase/migrations/`
3. `supabase migrations up`
→ applies that migration to your local database and marks it as executed.
4. `supabase db push --linked` (or `supabase db push` if you’ve already linked)
→ runs every unapplied migration on the remote project.
5. `npx supabase gen types typescript  > supabase/types.ts`
→ regenerates typescript types for the database.

**NOTE** keep in mind the order schemas run dictates the order of migrations. so if you have a function that references a table in another schema, you need to make sure that schema and table is created first.

## Reapairing 7/28

- [x] re-created schema `35_junction_tables.sql` - was missing
- [x] changed projects.title to projects.name
- [x] drop policy "Users can delete people_personas for their account" on "public"."people_personas"
- [x] drop view if exists "public"."persona_distribution"
- [ ] function sync_insight_tags missing trigger
should we do this?

after db reset --linked

- missing cron job
- missing trigger on insights
- missing q transcribe

```sql

/**
  * When a user signs up, we need to create a personal account for them
  * and add them to the account_user table so they can act on it
 */
create or replace function accounts.run_new_user_setup()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
as
$$
declare
    first_account_id    uuid;
    generated_user_name text;
begin

    -- first we setup the user profile
    -- TODO: see if we can get the user's name from the auth.users table once we learn how oauth works
    if new.email IS NOT NULL then
        generated_user_name := split_part(new.email, '@', 1);
    end if;
    -- create the new users's personal account
    insert into accounts.accounts (name, primary_owner_user_id, personal_account, id)
    values (generated_user_name, NEW.id, true, NEW.id)
    returning id into first_account_id;

    -- add them to the account_user table so they can act on it
    insert into accounts.account_user (account_id, user_id, account_role)
    values (first_account_id, NEW.id, 'owner');

  -- creating user_settings
    insert into account_settings(account_id) values (first_account_id);
    -- default research project
    insert into projects(account_id, name) values (first_account_id, 'My First Project');

    return NEW;
end;
$$;

-- trigger the function every time a user is created
create trigger on_auth_user_created
    after insert
    on auth.users
    for each row
execute procedure accounts.run_new_user_setup();


-- Create trigger to sync insight tags
CREATE TRIGGER sync_insight_tags
    AFTER INSERT OR UPDATE ON insights
    FOR EACH ROW EXECUTE FUNCTION sync_insight_tags(
        NEW.id,
        NEW.tags,
        NEW.account_id
    );


-- a) create the queue for embeddings
select pgmq.create('transcribe_interview_queue');
-- grant access to the queue table
grant insert, select, delete on table pgmq.q_transcribe_interview_queue to authenticated;

-- (optional) enable RLS and define policies
-- Enable RLS
alter table pgmq.q_transcribe_interview_queue enable row level security;

-- Allow insert
create policy "authenticated can enqueue"
on pgmq.q_transcribe_interview_queue
for insert
to authenticated
with check (true);

-- Allow select
create policy "authenticated can read"
on pgmq.q_transcribe_interview_queue
for select
to authenticated
USING (true);

-- Allow delete
create policy "authenticated can delete"
on pgmq.q_transcribe_interview_queue
for delete
to authenticated
USING (true);


-- b) trigger fn to enqueue transcription job
-- Update functions to use extensions schema for pgmq and cron
create or replace function public.enqueue_transcribe_interview()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT'
      or (TG_OP = 'UPDATE' and old.media_url is distinct from new.media_url)) then
    perform pgmq.send(
      'transcribe_interview_queue',
      json_build_object(
        'table', TG_TABLE_NAME,
        'id',    new.id::text,
        'media_url',  new.media_url
      )::jsonb
    );
  end if;
  return new;
end;
$$;

create or replace trigger trg_enqueue_transcribe_interview
  after insert or update on public.interviews
  for each row execute function public.enqueue_transcribe_interview();

-- c) helper to invoke your Edge Function:: Generic. dont' need to replicate. already setup in 50_queues
-- create or replace function public.invoke_edge_function(func_name text, payload jsonb)
-- returns void


-- d) processor that drains the queue and processes the job

create or replace function public.process_transcribe_queue()
returns text
language plpgsql
as $$
declare
  job record;
  count int := 0;
begin
  for job in
    select * from pgmq.read(
      'transcribe_interview_queue',
      5,
      30
    )
  loop
    perform public.invoke_edge_function('transcribe', job.message::jsonb);
    perform pgmq.delete(
      'transcribe_interview_queue',
      job.msg_id
    );
    count := count + 1;
  end loop;

  return format('Processed %s message(s) from transcribe queue.', count);
end;
$$;




-- e) cron-job to run every minute
select cron.schedule(
  '*/1 * * * *',
  'select public.process_transcribe_queue()'
);

```

added all that to a migration we ran.

### Add Transcript Test

```Processing Error
Failed to insert insights: column pe.persona_id does not exist
```

** Login:

 ```bash
 ERROR  Authentication middleware error: Response { status: 302,                                                                                                                                                                        1:53:21 AM
  statusText: '',
  headers: Headers { Location: '/login' },
  body: null,
  bodyUsed: false,
  ok: false,
  redirected: false,
  type: 'default',
  url: '' }
```

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
 type InsightRow =
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

## Local Development

Your local DB container is missing the pgmq extension, so any migration that references its objects can’t run locally. That leaves the migration in an “applied-remote / pending-local” limbo, which is why supabase migration list shows it only on the cloud side.

Recommended path:

Make the migration resilient
Wrap every CREATE EXTENSION pgmq (or any pgmq DDL) in an IF NOT EXISTS guard.
For objects that simply use the extension (e.g. SELECT pgmq.create_queue()), add a fast-exit when the extension is absent:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgmq') THEN
    RAISE NOTICE 'pgmq not installed; skipping queue setup';
    RETURN;
  END IF;
  PERFORM pgmq.create_queue('transcribe');
END$$;
With those guards, the migration will succeed locally even though the queues won’t function.
```
