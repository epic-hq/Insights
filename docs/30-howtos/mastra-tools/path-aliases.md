# Mastra Path Aliases

## The Problem

Mastra compiles source files to `.mastra/output/index.mjs`. This compiled bundle **cannot resolve `~/*` path aliases** because:

1. The `~` alias is defined in `tsconfig.json` which only TypeScript/Vite understand
2. Mastra's bundler doesn't read tsconfig paths
3. The compiled ESM output treats `~` as a package name, not a path alias

**Error you'll see:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '~' imported from .mastra/output/index.mjs
```

## Current Status

**The bundler alias config does NOT work.** The `.mastra/bundler-config.mjs` alias configuration is not respected by Mastra's build process.

## Workaround: Use Mastra Dev Mode

Run Mastra using the dev command which uses source files with proper TypeScript resolution:

```bash
pnpm run dev:mastra
```

This uses `mastra dev --dir app/mastra` which avoids executing the compiled `index.mjs`.

## If You Still See The Error

1. **Delete the compiled output**: `rm -rf .mastra/output/`
2. **Restart Mastra dev**: `pnpm run dev:mastra`
3. **Don't run the compiled bundle directly** - avoid `node .mastra/output/index.mjs`

## Long-term Solutions

If Mastra needs to run in production without TypeScript resolution:

1. **Convert `~/` imports to relative paths** in all `app/mastra/` files
2. **Create a re-export barrel** at `app/mastra/shared/index.ts` that re-exports external dependencies
3. **Wait for Mastra to support path aliases** in their bundler config

## Files Using `~/` Imports

There are 50+ files in `app/mastra/` using `~/` imports. A bulk conversion would be needed for production builds.
