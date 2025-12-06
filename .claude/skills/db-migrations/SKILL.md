---
name: db-migrations
description: Handles database migrations using Supabase declarative schema diffing. Use when: (1) Adding or modifying database tables, columns, indexes, RLS policies, (2) Running migrations locally or to remote, (3) Generating TypeScript types. Triggers on "add column", "create table", "migrate", "db diff", "push schema", "database change", "generate types".
---

# Supabase Database Migrations

Declarative schema-first migrations using Supabase CLI.

## The Required Loop

**ALWAYS follow this exact sequence:**

```
1. Edit supabase/schemas/*.sql
2. (Optional) Add to supabase/migrations/imperative.sql
3. supabase db diff -f <brief_name>
4. supabase migrations up
5. supabase db push --linked
6. supabase gen types --project-id rbginqvgkonnoktrttqv --schema public,accounts typescript > supabase/types.ts
```

## Step Details

### 1. Edit Schema Files

Schema files in `supabase/schemas/` are the **source of truth**.

```sql
-- supabase/schemas/users.sql
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  created_at timestamptz default now()
);

-- RLS
alter table public.users enable row level security;
```

Organize by domain: `users.sql`, `conversations.sql`, `insights.sql`, etc.

### 2. Imperative Statements (if needed)

For things that can't be diffed declaratively (data migrations, one-time fixes):

```sql
-- supabase/migrations/imperative.sql
-- These get included in the next diff
UPDATE public.users SET role = 'user' WHERE role IS NULL;
```

### 3. Generate Migration

```bash
supabase db diff -f <brief_name>
```

Creates timestamped file in `supabase/migrations/`. The `-f` flag names it.

### 4. Apply Locally

```bash
supabase migrations up
```

Applies pending migrations to local database.

### 5. Push to Remote

```bash
supabase db push --linked
```

Runs unapplied migrations on the linked remote project.

### 6. Regenerate Types

```bash
supabase gen types --project-id rbginqvgkonnoktrttqv --schema public,accounts typescript > supabase/types.ts
```

**Always regenerate after schema changes.**

## Common Patterns

### Adding a Table

```sql
-- supabase/schemas/new_feature.sql
create table if not exists public.new_feature (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  data jsonb,
  created_at timestamptz default now()
);

create index if not exists new_feature_user_idx on public.new_feature(user_id);

alter table public.new_feature enable row level security;

create policy "Users can view own data"
  on public.new_feature for select
  using (auth.uid() = user_id);
```

### Adding a Column

Edit the existing schema file, then diff.

### Danger Zone

- **Never edit generated migration files** in `supabase/migrations/`
- **Always diff before pushing** to see what will change
- **Run locally first** before pushing to remote
