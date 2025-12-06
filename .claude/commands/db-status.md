---
description: Check database migration status - local vs remote, pending migrations
argument-hint: 
allowed-tools: Bash(supabase:*), Bash(ls:*), Bash(cat:*), Read
---

# /db:status

Check the current state of database migrations.

## Process

1. List migration files in `supabase/migrations/`
2. Check local Supabase status
3. Show which migrations are pending

## Commands to Run

```bash
# List migrations
ls -la supabase/migrations/*.sql 2>/dev/null | tail -10

# Check supabase status
supabase status

# Show recent schema changes
ls -la supabase/schemas/*.sql 2>/dev/null
```

## Output Format

```
📊 Migration Status

Local Supabase: [running|stopped]
Migration files: X total

Recent migrations:
- 20241201_add_users.sql
- 20241202_add_roles.sql

Schema files:
- users.sql (modified: date)
- conversations.sql (modified: date)

Status: [synced|pending migrations|schema changes not diffed]
```
