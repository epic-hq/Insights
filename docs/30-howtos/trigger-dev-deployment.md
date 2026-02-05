# Trigger.dev v4 Production Deployment Guide

This guide covers deploying Trigger.dev v4 tasks to production, including environment configuration, common issues, and best practices learned from production deployment.

## Table of Contents

1. [Overview](#overview)
2. [Environment Configuration](#environment-configuration)
3. [Deployment Process](#deployment-process)
4. [Environment Variable Syncing](#environment-variable-syncing)
5. [Production vs Dev Environments](#production-vs-dev-environments)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [Best Practices](#best-practices)

## Overview

Trigger.dev v4 uses a **managed build service** (Depot) to build and deploy your tasks. The deployment process:

1. CLI packages your code
2. Sends it to Depot (AWS-based build service)
3. Builds Docker image with your tasks
4. Deploys to Trigger.dev's infrastructure

**Key Point**: There's no way to bypass Depot or push self-built Docker images. You must use the managed deployment pipeline.

## Environment Configuration

### 1. Production Secret Key

Your production application must use the **production** `TRIGGER_SECRET_KEY`, not the dev key.

**Key Format:**
- Dev: `tr_dev_*`
- Prod: `tr_prod_*`

The SDK automatically routes task triggers to the correct environment based on this key.

**Get Your Production Key:**
1. Go to https://cloud.trigger.dev
2. Select your project
3. Navigate to **Environments** → **Production**
4. Copy the secret key

**Set in Production Environment:**

For Fly.io:
```bash
flyctl secrets set TRIGGER_SECRET_KEY='tr_prod_...'
```

For Vercel:
```bash
vercel env add TRIGGER_SECRET_KEY production
```

For Railway:
```bash
# Add via Railway dashboard: Variables → Add Variable
```

For dotenvx (encrypted .env):
```bash
# Update .env.production
TRIGGER_SECRET_KEY=your_prod_key_here

# Encrypt it
dotenvx encrypt -f .env.production
```

### 2. Verify Environment Selection

Add logging to confirm which environment is being used:

```typescript
// app/utils/processInterviewAnalysis.server.ts
const triggerEnv = process.env.TRIGGER_SECRET_KEY?.startsWith("tr_dev_") ? "dev" : "prod"
console.log(`Triggering tasks in ${triggerEnv} environment`)

const handle = await tasks.trigger("your-task-id", payload)
```

## Deployment Process

### 1. Configure trigger.config.ts

Your `trigger.config.ts` must include environment variable syncing to avoid build-time errors:

```typescript
import { defineConfig } from "@trigger.dev/sdk";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  project: "proj_your_project_id",
  runtime: "node",
  logLevel: "log",
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    external: ["@boundaryml/baml", "@boundaryml/baml-*"],
    extensions: [
      syncEnvVars(async (ctx) => {
        // Sync all required environment variables
        return [
          { name: "NODE_ENV", value: process.env.NODE_ENV || "production" },
          { name: "SUPABASE_URL", value: process.env.SUPABASE_URL! },
          { name: "SUPABASE_ANON_KEY", value: process.env.SUPABASE_ANON_KEY! },
          { name: "OPENAI_API_KEY", value: process.env.OPENAI_API_KEY || "" },
          // Add all env vars your tasks need
        ];
      }),
    ],
  },
});
```

### 2. Deploy to Production

**Using dotenvx (recommended for encrypted env vars):**

```bash
dotenvx run -- npx trigger.dev@latest deploy --env production
```

**Without dotenvx:**

```bash
npx trigger.dev@latest deploy --env production
```

### 3. Monitor Deployment

```bash
# Check deployment status
npx trigger.dev@latest list

# View logs
npx trigger.dev@latest logs --env production
```

## Environment Variable Syncing

### Why It's Required

Trigger.dev builds your tasks in an isolated environment. If your task files import modules that validate environment variables at import time (like `env.server.ts`), the build will fail with "Invalid environment variables" errors.

### Solution: syncEnvVars Extension

The `syncEnvVars` extension injects environment variables during the build/indexing phase:

```typescript
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

extensions: [
  syncEnvVars(async (ctx) => {
    // ctx contains: environment, projectRef, env
    return [
      { name: "SUPABASE_URL", value: process.env.SUPABASE_URL! },
      { name: "SUPABASE_ANON_KEY", value: process.env.SUPABASE_ANON_KEY! },
      // Add all required vars
    ];
  }),
]
```

### What to Sync

Sync any environment variables that are:
1. Required by modules imported in your task files
2. Validated at import time (not just runtime)
3. Used by database clients, API clients, or validation schemas

**Example: Supabase Client**

If your tasks import a Supabase client that calls `env.server.ts`:

```typescript
// lib/supabase/client.server.ts
import { getServerEnv } from "~/env.server" // Validates env vars at import!

const env = getServerEnv()
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
```

You **must** sync `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `trigger.config.ts`.

## Production vs Dev Environments

### How Environment Selection Works

Trigger.dev automatically determines the environment based on `TRIGGER_SECRET_KEY`:

| Key Prefix | Environment | Use Case |
|------------|-------------|----------|
| `tr_dev_*` | Development | Local development, testing |
| `tr_prod_*` | Production | Production deployments |

### Task Triggering

When you call `tasks.trigger()` from your application:

```typescript
const handle = await tasks.trigger("my-task", payload)
```

The SDK:
1. Reads `TRIGGER_SECRET_KEY` from environment
2. Routes the trigger to the matching environment (dev or prod)
3. Executes the task in that environment's deployed version

### Deployment Workflow

**Development:**
```bash
# Run tasks locally
npx trigger.dev@latest dev

# Tasks execute on your machine
# Uses tr_dev_* key
```

**Production:**
```bash
# Deploy tasks to Trigger.dev cloud
npx trigger.dev@latest deploy --env production

# Tasks execute on Trigger.dev infrastructure
# Application uses tr_prod_* key to trigger them
```

### Environment Isolation

- Dev and prod environments are completely isolated
- Each has its own deployed task versions
- Triggering from dev app → runs dev tasks
- Triggering from prod app → runs prod tasks

## Common Issues & Solutions

### 1. Invalid Environment Variables During Build

**Symptom:**
```
Error: There was an error importing task files
Invalid environment variables in src/trigger/interview/extractEvidenceAndPeople.ts
```

**Cause:** Task files import modules that validate env vars at import time, but those vars aren't available during Trigger.dev's build/indexing phase.

**Solution:** Add `syncEnvVars` extension to `trigger.config.ts` (see [Environment Variable Syncing](#environment-variable-syncing)).

### 2. Tasks Running in Dev Instead of Prod

**Symptom:** Production app triggers tasks, but they run in dev environment or don't run at all.

**Cause:** Production app is using dev `TRIGGER_SECRET_KEY` (`tr_dev_*`).

**Solution:**
1. Get production key from Trigger.dev dashboard
2. Set `TRIGGER_SECRET_KEY` in production environment
3. Redeploy application
4. Verify with logging (see [Verify Environment Selection](#2-verify-environment-selection))

### 3. Depot Build Service Unavailable

**Symptom:**
```
Error: unavailable: Unable to acquire machine, please retry
```

**Cause:** Trigger.dev's managed build service (Depot) is experiencing issues, often due to AWS outages.

**Solution:**
1. Check https://status.trigger.dev for service status
2. Wait for service recovery (typically 30-60 minutes)
3. Retry deployment: `npx trigger.dev@latest deploy --env production`

**Note:** There's no workaround to bypass Depot. Self-built Docker images cannot be pushed to Trigger.dev.

### 4. Missing Task Deployments

**Symptom:** Tasks trigger successfully but fail with "Task not found" errors.

**Cause:** Tasks haven't been deployed to production environment.

**Solution:**
```bash
# Deploy tasks to production
npx trigger.dev@latest deploy --env production

# Verify deployment
npx trigger.dev@latest list --env production
```

### 5. Build Fails with Native Module Errors

**Symptom:** Build fails with errors about native dependencies (e.g., BAML, Prisma).

**Cause:** Native modules need to be marked as external.

**Solution:** Add to `trigger.config.ts`:

```typescript
build: {
  external: [
    "@boundaryml/baml",
    "@boundaryml/baml-*",
    "@prisma/client",
    // Add other native modules
  ],
}
```

## Best Practices

### 1. Environment Variable Management

- **Use dotenvx** for encrypted environment variables in version control
- **Sync only required vars** in `syncEnvVars` - don't sync everything
- **Use optional chaining** for non-critical vars: `process.env.OPTIONAL_VAR || ""`
- **Validate at runtime** instead of import time when possible

### 2. Task Organization

```
src/trigger/
├── interview/
│   ├── index.ts              # Main task orchestrator
│   ├── uploadMedia.ts        # Individual task
│   ├── extractEvidence.ts    # Individual task
│   └── analyzeThemes.ts      # Individual task
└── utils/
    └── supabase.ts           # Shared utilities
```

### 3. Error Handling

```typescript
export const myTask = task({
  id: "my-task",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload) => {
    try {
      // Task logic
      return { success: true, data: result }
    } catch (error) {
      console.error("Task failed:", error)
      throw error // Trigger will retry
    }
  },
})
```

### 4. Logging

```typescript
import { logger } from "@trigger.dev/sdk";

export const myTask = task({
  id: "my-task",
  run: async (payload) => {
    logger.info("Starting task", { payload })
    
    // Task logic
    
    logger.info("Task completed", { result })
    return result
  },
})
```

### 5. Testing

**Local Development:**
```bash
# Run tasks locally
npx trigger.dev@latest dev

# Trigger from your app (uses dev environment)
curl -X POST http://localhost:3000/api/trigger-task
```

**Production Testing:**
```bash
# Deploy to production
npx trigger.dev@latest deploy --env production

# Test trigger from production app
# Or use Trigger.dev dashboard to manually trigger
```

### 6. Monitoring

- Use Trigger.dev dashboard for real-time task monitoring
- Set up alerts for failed tasks
- Monitor task duration and retry rates
- Use Langfuse/Sentry for application-level tracing

### 7. Deployment Checklist

- [ ] Environment variables synced in `trigger.config.ts`
- [ ] Production `TRIGGER_SECRET_KEY` set in hosting platform
- [ ] Tasks deployed: `npx trigger.dev@latest deploy --env production`
- [ ] Deployment verified: `npx trigger.dev@latest list --env production`
- [ ] Test trigger from production app
- [ ] Monitor first production run in dashboard
- [ ] Verify logging shows "prod" environment

## Removed Features

### Multipart Upload API Routes (Deprecated)

Previously, the codebase had client-side multipart upload routes:
- `app/routes/api.r2.init.tsx`
- `app/routes/api.r2.sign-part.tsx`
- `app/routes/api.r2.complete.tsx`

These were **removed** because:
1. They referenced non-existent functions (`initMultipart`, `signPart`, `completeMultipart`)
2. Server-side multipart upload is already fully implemented in `app/utils/r2.server.ts`
3. The `uploadToR2()` function auto-detects files >100MB and uses multipart automatically
4. Server-side approach is simpler and more reliable

**Current Upload Flow:**
```
Client → /api/upload-file → uploadToR2() → Auto multipart if >100MB
```

No client-side multipart logic needed.

## References

- [Trigger.dev v4 Documentation](https://trigger.dev/docs)
- [Trigger.dev Build Extensions](https://trigger.dev/docs/config/config-file#build-extensions)
- [Trigger.dev Environment Variables](https://trigger.dev/docs/config/environment-variables)
- [Trigger.dev Status Page](https://status.trigger.dev)
- [dotenvx Documentation](https://dotenvx.com/docs)

## Support

- [Trigger.dev Discord](https://trigger.dev/discord)
- [Trigger.dev GitHub](https://github.com/triggerdotdev/trigger.dev)
- [Trigger.dev Support](https://trigger.dev/support)
