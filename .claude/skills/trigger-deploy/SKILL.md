---
name: trigger-deploy
description: Deploys Trigger.dev background tasks to production. Use when: (1) After modifying files in src/trigger/, (2) User says "deploy trigger", "push tasks", "update background jobs", (3) After fixing task bugs. Handles version mismatches, build validation, and deployment verification.
---

# Trigger.dev Deployment

Deploy background tasks to Trigger.dev cloud.

## Quick Deploy

```bash
npx trigger.dev@latest deploy
```

Always use `@latest` to avoid version mismatch errors.

## Pre-Deploy Checklist

### 1. Verify Build Passes

```bash
pnpm build
```

Tasks import app code, so build must succeed first.

### 2. Check Task Files

All tasks live in `src/trigger/`. Verify your changes:

```bash
git diff --name-only src/trigger/
```

### 3. Verify ffmpeg Usage (if applicable)

For tasks that process media, use `ffmpeg-static` NOT system ffmpeg:

```typescript
// CORRECT
import { execa } from "execa";
import ffmpegPath from "ffmpeg-static";
await execa(ffmpegPath, args);

// WRONG - won't work on Trigger.dev cloud
import { spawn } from "node:child_process";
spawn("ffmpeg", args);
```

## Common Issues

### Version Mismatch Error

```
ERROR: Version mismatch detected
CLI version: 4.1.2
Packages: @trigger.dev/sdk@4.3.2
```

**Fix:** Always use `npx trigger.dev@latest deploy`

### Task Timeout

Default `maxDuration` is 3600s (1 hour). For long tasks:

```typescript
export const myTask = schemaTask({
  id: "my.long-task",
  maxDuration: 2700, // 45 minutes
  // ...
});
```

### Missing Environment Variables

Check `trigger.config.ts` for the `syncEnvVars` extension. All required env vars must be listed there.

### ffmpeg Not Found

Trigger.dev cloud doesn't have system ffmpeg. Use `ffmpeg-static`:

```typescript
import ffmpegPath from "ffmpeg-static";
// ffmpegPath is the absolute path to the binary
```

Ensure `trigger.config.ts` has it in externals:

```typescript
build: {
  external: ["ffmpeg-static", "execa", ...],
}
```

## Post-Deploy Verification

### Check Deployment

1. Visit [Trigger.dev Dashboard](https://cloud.trigger.dev)
2. Navigate to your project
3. Check "Deployments" tab for latest version
4. Verify task count matches expected

### Test a Task

Trigger a test run from the dashboard or via API:

```typescript
import { tasks } from "@trigger.dev/sdk";
await tasks.trigger("my.task-id", { payload });
```

### Monitor Runs

Check the "Runs" tab for:
- Task execution status
- Error messages and stack traces
- Duration and resource usage

## Task Configuration Reference

```typescript
export const myTask = schemaTask({
  id: "namespace.task-name",           // Unique identifier
  schema: PayloadSchema,               // Zod schema for payload
  maxDuration: 3600,                   // Max seconds (default: from trigger.config.ts)
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 60000,
  },
  machine: {                           // Optional: request more resources
    preset: "medium-1x",               // small-1x, medium-1x, large-1x, etc.
  },
  run: async (payload, { ctx }) => {
    // Task implementation
    return result;
  },
});
```

## Environment Variables

Required vars are synced via `trigger.config.ts`:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`, `ASSEMBLYAI_API_KEY`
- `R2_*` variables for storage
- `TRIGGER_SECRET_KEY`

## Debugging Failed Runs

1. Get run ID from logs or dashboard
2. View run details in dashboard
3. Check "Logs" tab for consola output
4. Check "Timeline" for step-by-step execution

For stuck runs:
```bash
# Check run status via API
curl -H "Authorization: Bearer $TRIGGER_SECRET_KEY" \
  https://api.trigger.dev/v3/runs/<run_id>
```
