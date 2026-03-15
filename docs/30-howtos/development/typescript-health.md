# TypeScript Health Workflow

The repo now uses a hybrid Supabase typing model:

- `supabase/types.ts` is the only generated database type file.
- `app/types-db-override.ts` is the place for intentional app-specific DB type merges.
- `app/types.ts` is the stable import surface for app code.
- Remote-only or platform-managed capabilities should live behind narrow compatibility wrappers instead of becoming the default generated app types.

## Commands

Regenerate canonical DB types from local repo-owned Supabase schemas:

```bash
pnpm run db:types
```

Generate a remote verification artifact:

```bash
pnpm run db:types:remote
```

Check whether local canonical types drift from the hosted project:

```bash
pnpm run db:drift:check
```

Run the full repo typecheck report:

```bash
pnpm run typecheck
```

Update the committed normalized TypeScript baseline:

```bash
pnpm run typecheck:baseline:update
```

Run no-regressions type enforcement:

```bash
pnpm run typecheck:baseline
```

## Workflow

After changing Supabase schema or migrations:

1. Run `pnpm run db:types`
2. Review the diff in `supabase/types.ts`
3. If the hosted project is expected to match, run `pnpm run db:drift:check`

When working on TypeScript debt:

1. Keep `pnpm run typecheck` for visibility
2. Use `pnpm run typecheck:baseline` to prevent new regressions
3. After intentionally changing the known-debt surface, refresh with `pnpm run typecheck:baseline:update`
