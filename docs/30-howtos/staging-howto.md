# Staging Environment Guide

## Overview

Staging runs on Fly.io at **https://upsight-staging.fly.dev** backed by a dedicated Supabase project (`utgompjzbkxnkpcicwky`).

## Deploying

### Automatic (recommended)

Push to the `staging` branch:

```bash
git push origin main:staging
```

This triggers `.github/workflows/deploy-staging.yml` which builds, deploys to Fly.io, deploys Trigger.dev tasks, and runs smoke tests.

### Manual dispatch

Go to **Actions → Deploy Staging → Run workflow** in GitHub.

### Local flyctl

```bash
pnpm exec dotenvx run -f .env.staging -- pnpm run build
flyctl deploy -c fly.staging.toml --remote-only
```

Requires `FLY_API_TOKEN` and `DOTENVX_KEY` / `DOTENV_PRIVATE_KEY_STAGING` in your environment.

## Testing

### Smoke tests (post-deploy)

Fast sanity checks (~60s) that verify the deployment is functional:

```bash
E2E_BASE_URL=https://upsight-staging.fly.dev pnpm test:e2e:smoke
```

Requires `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` for authenticated tests.

### Full E2E suite

```bash
E2E_BASE_URL=https://upsight-staging.fly.dev pnpm test:e2e
```

### Agent-browser

```bash
E2E_BASE_URL=https://upsight-staging.fly.dev agent-browser snapshot https://upsight-staging.fly.dev
```

## When to use staging vs local dev

| Use staging when... | Use local dev when... |
|---|---|
| Testing deploy pipeline / Dockerfile | Iterating on UI or logic |
| Verifying Trigger.dev tasks in cloud | Running unit/integration tests |
| Testing with production-like infra | Debugging with hot reload |
| Pre-release validation | Working on database migrations |
| Sharing a link for review | Experimenting with new features |

## Environment secrets

### Decrypt `.env.staging`

```bash
pnpm exec dotenvx get -f .env.staging
```

### Encrypt after editing

```bash
pnpm exec dotenvx encrypt -f .env.staging
```

The private key is stored as `DOTENV_PRIVATE_KEY_STAGING` in GitHub Actions secrets and locally in `.env.keys`.

## Troubleshooting

### Cold starts

Fly.io machines may scale to zero. First request after idle can take 5-10s. Smoke tests use 15s timeouts to account for this.

### Stale auth / storage state

If login-based tests fail, delete the cached auth state:

```bash
rm -rf tests/e2e/.auth/
```

### Viewing logs

```bash
flyctl logs -a upsight-staging
flyctl logs -a upsight-staging --region ord  # specific region
```

### Checking machine status

```bash
flyctl status -a upsight-staging
flyctl machine list -a upsight-staging
```

### Database access

Staging Supabase dashboard: https://supabase.com/dashboard/project/utgompjzbkxnkpcicwky
