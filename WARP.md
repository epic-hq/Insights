# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project summary
- Full-stack React Router v7 (framework mode) + Vite app, SSR via Hono
- Supabase (SSR/browser clients, RLS), i18next, PostHog
- Background jobs with Trigger.dev v4 (tasks in src/trigger, config in trigger.config.ts)
- AI agents with Mastra (app/mastra)
- Tests with Vitest (unit + integration), Biome linter/formatter, Knip unused-code checker
- Package manager: pnpm; Node >= 24.3.0

Prereqs
- pnpm >= 10.12.4, Node >= 24.3.0
- Copy .env.example -> .env (for dev). Production uses encrypted .env.production via dotenvx.

Common commands
- Install: pnpm install
- Dev (app + Mastra): pnpm run dev
  - App only: pnpm run dev:vite
  - Mastra only: pnpm run dev:mastra
- Build: pnpm run build
- Start (built server): pnpm start
- Typecheck: pnpm run typecheck
- Lint/format (Biome): pnpm run check | pnpm run check:fix
- Unused code (Knip): pnpm run check:unused
- Validate (local mirror of CI): pnpm run validate
- Storybook: pnpm storybook | pnpm build-storybook

Testing (Vitest)
- Unit tests: pnpm run test
- Integration tests: pnpm run test:integration
- All tests: pnpm run test:all
- Coverage: pnpm run test:cov
- UI runner (watch): pnpm run test:ui
- Run a single file: pnpm run test app/utils/personNaming.test.ts
- Filter by name: pnpm run test -- -t "person name"
- Grep pattern: pnpm run test -- --grep "person name"

Key architecture
- Runtime and SSR
  - Vite config in vite.config.ts enables React Router v7 framework mode, devtools, Tailwind, icon spritesheet, tsconfig paths.
  - Server is Hono via react-router-hono-server (app/server/index.ts), with i18next middleware and SSR stream handler (app/entry.server.tsx). Client boot in app/entry.client.tsx.
  - Realtime STT proxy: GET /ws/realtime-transcribe upgrades to WebSocket and bridges to AssemblyAI (requires ASSEMBLYAI_API_KEY).
- i18n
  - i18next on server (app/localization/i18n.server.ts) and client (app/localization/i18n.ts); resources in app/localization/resource.ts. Language passed via loader and useChangeLanguage in app/root.tsx.
- Env and telemetry
  - Server env validated in env.server.ts; client env injected via root loader to window.env (see app/root.tsx, app/utils/env.ts). PostHog initialized in root.tsx with host/key from clientEnv.
- Data layer (Supabase)
  - Server SSR client and admin client in app/lib/supabase/client.server.ts (getServerClient, createSupabaseAdminClient, getAuthenticatedUser, getSession, getRlsClient). Browser client in app/lib/supabase/client.ts.
  - App features organized by domain in app/features/* with routes composed via app/features/**/routes.ts and mounted under app/routes/.
- Background jobs (Trigger.dev v4)
  - Tasks live under src/trigger/** (interview, persona, sales). Config in trigger.config.ts uses build extensions (syncEnvVars) to inject required env at build/deploy time.
  - Important rules when editing/adding tasks:
    - Use @trigger.dev/sdk v4 (task, schemaTask, schedules); do NOT use deprecated client.defineJob.
    - Avoid wrapping triggerAndWait/batchTriggerAndWait or wait.* calls in Promise.all/Promise.allSettled.
    - triggerAndWait returns a Result object; check result.ok before using result.output.
  - Deployment (see docs/trigger-dev-deployment.md): pnpm dlx trigger.dev@4.0.6 deploy (CI does this after app deploy).
- Agents (Mastra)
  - Agent/workflow code under app/mastra (agents, tools, workflows). Run dev agent server alongside app via pnpm run dev (concurrently).

Testing guidance
- Unit tests colocated next to code (e.g., app/utils/*.test.ts). Config: vitest.config.ts.
- Integration tests under app/test/integration with setup at app/test/setup/integration.setup.ts, config vitest.integration.config.ts. Requires real env (scripts use dotenvx).
- See docs/testing-howto.md for scope, commands, and coverage usage.

CI overview
- .github/workflows/validate.yml runs: Biome lint (advisory), typecheck, Knip unused, Vitest with coverage (chromium installed). Local equivalent: pnpm run validate.
- .github/workflows/deploy.yml: builds app with dotenvx and deploys to Fly.io, then deploys Trigger.dev v4 tasks.

Conventions and rules
- Logging: use consola (import consola from "consola"); avoid console.log (CLAUDE.md).
- Database changes: use Supabase declarative approach (edit supabase/schemas/*, generate types/migrations, see docs/deploy-to-supabase.md). Avoid ad-hoc SQL outside schema pipeline.
- Trigger.dev: follow v4 rules above; ensure trigger.config.ts syncs any env vars referenced by imports in task files.

Notable directories
- app/: application code (components, features, routes, server, lib, utils, tests)
- src/trigger/: Trigger.dev tasks grouped by domain
- trigger.config.ts: Trigger.dev v4 config
- worker/: Cloudflare Worker for signed R2 read passthrough (Env.R2, SERVICE_TOKEN, SHARED_SIGNING_SECRET)
- docs/: deployment, testing, storybook, and feature docs

Environment notes
- Dev scripts use dotenvx; ensure a working .env or decrypt .env.production when mimicking CI. Required keys for major features include Supabase (URL/keys), AssemblyAI, OpenAI, Langfuse, R2, Resend, Trigger.dev (TRIGGER_SECRET_KEY).

References
- README.md: stack overview and getting started
- docs/trigger-dev-deployment.md: end-to-end Trigger.dev guidance
- docs/deploy-howto.md: Fly.io deployment (Dockerfile, dotenvx)
- docs/STORYBOOK_README.md: Storybook usage
