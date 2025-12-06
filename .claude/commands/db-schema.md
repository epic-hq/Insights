---
description: Create or edit a declarative schema file in supabase/schemas/
argument-hint: <schema-name>
allowed-tools: Bash(mkdir:*), Read, Write
---

# /db:schema

Create or edit a declarative schema file.

## Usage

- `/db:schema users` - Edit supabase/schemas/users.sql
- `/db:schema conversations` - Edit supabase/schemas/conversations.sql

## Process

1. If file doesn't exist, create with template
2. Open file for editing
3. After changes, remind to run migration loop

## Template for New Schema

```sql
-- supabase/schemas/$1.sql
-- Declarative schema for $1

-- Table
create table if not exists public.$1 (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
-- create index if not exists ${1}_some_column_idx on public.$1(some_column);

-- RLS
alter table public.$1 enable row level security;

-- Policies
-- create policy "Policy name"
--   on public.$1 for select
--   using (auth.uid() = user_id);

-- Triggers
create or replace function public.update_${1}_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_${1}_updated_at on public.$1;
create trigger update_${1}_updated_at
  before update on public.$1
  for each row execute function public.update_${1}_updated_at();
```

## After Editing

Run the migration loop:
```
/db:migrate full <brief_change_name>
```
