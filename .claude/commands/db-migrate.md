---
description: Run the full Supabase migration loop or individual steps
argument-hint: [diff|up|push|types|full] <name>
allowed-tools: Bash(supabase:*), Read, Write
---

# /db:migrate

Run Supabase database migrations.

## Commands

- `/db:migrate diff <name>` - Generate migration from schema diff
- `/db:migrate up` - Apply migrations locally
- `/db:migrate push` - Push to remote database
- `/db:migrate types` - Regenerate TypeScript types
- `/db:migrate full <name>` - Run the complete loop (diff → up → push → types)

## Full Migration Loop

When running `/db:migrate full <name>`:

```bash
# 1. Generate migration
supabase db diff -f $1

# 2. Apply locally
supabase migrations up

# 3. Push to remote
supabase db push --linked

# 4. Regenerate types
supabase gen types --project-id rbginqvgkonnoktrttqv --schema public,accounts typescript > supabase/types.ts
```

## Workflow

1. First edit `supabase/schemas/*.sql` with your changes
2. Then run `/db:migrate full add-user-roles` (or whatever brief name)
3. Types are auto-regenerated

## Individual Commands

### diff
```bash
supabase db diff -f $2
```
Generates a new timestamped migration file.

### up
```bash
supabase migrations up
```
Applies all pending migrations to local database.

### push
```bash
supabase db push --linked
```
Pushes migrations to the linked remote project.

### types
```bash
supabase gen types --project-id rbginqvgkonnoktrttqv --schema public,accounts typescript > supabase/types.ts
```
Regenerates TypeScript types from remote schema.
