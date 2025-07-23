# Deploy to Supabase

## Prerequisites

- [x] Supabase account
- [x] Supabase CLI
- [x] Git
- [x] GitHub account

## Steps

1. Initialize the Supabase project
2. Any changes to database:

- schema should be made in the `supabase/schemas` directory
- functions should be made in the `supabase/functions` directory
- generate types for db objects:

```bash
npx supabase gen types db > ./app/types/database.ts
```

- generate migration file (one combined file)

```bash
npx supabase db diff -f somename
```

3. Deploy: reset or apply migration to remote database:

```bash
npx supabase db reset --linked
or
npx supabase db push
```

5. Setup Queues by running this migration file `supabase/migrations/_manual_queues.sql`

Doing it in script for now.
will try in schema next so maybe it puts it in the right place

6. Secrets:

Vault Integration: SUPABASE_ANON_KEY - used by db a cron job to call embed edge function

## Check system

- check that the queue is running
- check that the cron job is running
- check that the edge function is running
- check that the vault integration is working
- check that the db trigger is working for adding a new insight
- check that adding new user generates right tables in accounts, account_settings, account_user, projects
