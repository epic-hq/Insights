# Mastra v1 Migration Plan

## Overview

Migration from Mastra 0.24.x to v1 (beta). This is a significant upgrade that requires Node.js 22.13.0+ and includes breaking changes to tool signatures, imports, memory configuration, and various API renames.

**Current Versions (stable, in use):**
- `@mastra/core`: 1.0.0-beta.17
- `@mastra/ai-sdk`: 1.0.0-beta.10

**Target:** Upgrade to latest beta when stable

> **Warning (2026-01-16):** Attempted upgrade to beta.23 caused critical issues:
> 1. `requestContext` not forwarded to tools (tools couldn't access user_id, project_id)
> 2. Stricter input validation breaking tools when LLM passes `null` for optional fields
>
> Rolled back to beta.17/beta.10. See `docs/bugs/backlog.md` for test checklist before re-attempting upgrade.

---

## Phase 1: Prerequisites & Environment Setup

### 1.1 Node.js Version
- [ ] Verify Node.js 22.13.0+ installed (`node --version`)
- [ ] Update `.nvmrc` if present
- [ ] Update any CI/CD configurations for Node 22

### 1.2 Database Backup
- [ ] Create backup of Supabase database (migration changes memory storage format)
- [ ] Document rollback procedure

### 1.3 Branch Setup
- [ ] Create feature branch: `feat/mastra-v1-migration`
- [ ] Ensure all current changes are committed

---

## Phase 2: Run Automated Codemods

The codemod handles 30+ transformations automatically.

### 2.1 Dry Run Preview
```bash
npx @mastra/codemod@beta v1 --dry
```

### 2.2 Apply Codemods
```bash
npx @mastra/codemod@beta v1
```

### 2.3 Review Codemod Changes
Codemods will transform:

**High-Priority (will definitely affect us):**

| Change | From | To | Files Affected |
|--------|------|-----|----------------|
| RuntimeContext rename | `RuntimeContext` | `RequestContext` | All agents, tools, API routes |
| Tool signatures | `execute({ context, runtimeContext })` | `execute(input, { context })` | 50+ tools |
| Import restructuring | `@mastra/core` | Subpath imports | All mastra files |
| Memory query rename | `memory.query()` | `memory.recall()` | API routes |
| Message type rename | `MastraMessageV2` | `MastraDBMessage` | Processors |
| Storage pagination | `offset/limit` | `page/perPage` | Storage calls |

**Medium-Priority:**

| Change | From | To |
|--------|------|-----|
| Agent property access | `agent.llm` | `agent.getLLM()` |
| Voice methods | `agent.speak()` | `agent.voice.speak()` |
| Workflow run count | `runCount` | `retryCount` |
| Workflow async | `createRunAsync()` | `createRun()` |

---

## Phase 3: Manual Code Updates

After codemods, these require manual attention:

### 3.1 Tool Signature Updates (HIGH PRIORITY)
All 50+ custom tools need execute signature changes:

**Before (v0.x):**
```typescript
execute: async ({ context, runtimeContext }) => {
  const projectId = context.projectId ?? runtimeContext?.get?.("project_id")
  const query = context.query
  // ...
}
```

**After (v1):**
```typescript
execute: async (input, { context }) => {
  const projectId = input.projectId ?? context?.get?.("project_id")
  const query = input.query
  // ...
}
```

**Files to update:**
- `app/mastra/tools/*.ts` (all 50+ files)

### 3.2 RequestContext (formerly RuntimeContext)
Update all usages of `RuntimeContext`:

**Files affected:**
- `app/routes/api.chat.project-status.tsx`
- `app/routes/api.chat.project-status.history.tsx`
- All agent definitions in `app/mastra/agents/`
- Type definitions

**Before:**
```typescript
import { RuntimeContext } from "@mastra/core/di"
const runtimeContext = new RuntimeContext()
runtimeContext.set("project_id", projectId)
```

**After:**
```typescript
import { RequestContext } from "@mastra/core"
const context = new RequestContext()
context.set("project_id", projectId)
```

### 3.3 Memory Configuration Updates

**Memory query → recall:**
```typescript
// Before
const { messagesV2 } = await memory.query({ threadId, selectBy: { last: 10 } })

// After
const { messages } = await memory.recall({ threadId, selectBy: { last: 10 } })
```

**Message type rename:**
```typescript
// Before
import type { MastraMessageV2 } from "@mastra/memory"

// After
import type { MastraDBMessage } from "@mastra/memory"
```

### 3.4 Import Path Updates
Core imports need subpath structure:

```typescript
// Before
import { Agent, createTool, RuntimeContext } from "@mastra/core"

// After (v1)
import { Agent } from "@mastra/core/agent"
import { createTool } from "@mastra/core/tools"
import { RequestContext } from "@mastra/core"
```

### 3.5 Custom Processor Updates

`ToolCallPairProcessor` extends `MemoryProcessor` - verify interface compatibility:

**File:** `app/mastra/processors/tool-call-pair-processor.ts`

Check if `MemoryProcessor` interface changed in v1.

### 3.6 Storage Pagination Updates

```typescript
// Before
await memory.getThreadsByResourceIdPaginated({
  resourceId,
  page: 0,
  perPage: 100,
})

// After (if using offset/limit anywhere)
// Change offset/limit → page/perPage
```

---

## Phase 4: Package Updates

### 4.1 Update package.json
```bash
pnpm add @mastra/core@beta @mastra/memory@beta @mastra/pg@beta @mastra/libsql@beta @mastra/ai-sdk@beta @mastra/loggers@beta
pnpm add -D mastra@beta
```

### 4.2 Verify Peer Dependencies
Check for any peer dependency conflicts after upgrade.

---

## Phase 5: TypeScript & Build Verification

### 5.1 Type Check
```bash
npx tsc --noEmit
```

**Expected issues to resolve:**
- RequestContext type changes
- Tool execute signature types
- Memory method return types
- Import path errors

### 5.2 Build Test
```bash
pnpm build
```

---

## Phase 6: Testing

### 6.1 Unit Tests
```bash
pnpm test
```

### 6.2 Manual Testing Checklist

**Agent Functionality:**
- [ ] Project Status Agent responds correctly
- [ ] Tool calls execute without errors
- [ ] Memory persists across conversations
- [ ] Thread history loads correctly

**Specific Tools to Test:**
- [ ] `fetchProjectStatusContext` - project data retrieval
- [ ] `semanticSearchEvidence` - vector search
- [ ] `saveTableToAssets` - table creation
- [ ] `importPeopleFromTable` - CRM import
- [ ] `manageDocuments` - document CRUD
- [ ] `navigateToPage` - client-side tool

**Memory & History:**
- [ ] New conversations create threads
- [ ] History loads on page refresh
- [ ] Corrupted thread recovery works
- [ ] TokenLimiter functions correctly

**Streaming:**
- [ ] Chat responses stream to UI
- [ ] Tool progress shows in ThinkingWave
- [ ] Reasoning tokens display (if model supports)

---

## Phase 7: Deployment

### 7.1 Staging Deployment
- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Verify Supabase connections

### 7.2 Production Deployment
- [ ] Create database backup
- [ ] Deploy to production
- [ ] Monitor logs for errors
- [ ] Verify key user flows

---

## Files Inventory

### Agents (9 files)
- `app/mastra/agents/project-status-agent.ts` - 40+ tools, PostgreSQL memory
- `app/mastra/agents/project-setup-agent.ts` - 8 tools, working memory
- `app/mastra/agents/signup-agent.ts` - 2 tools
- `app/mastra/agents/interview-status-agent.ts` - semantic search
- `app/mastra/agents/insights-agent.ts` - workflows
- `app/mastra/agents/research-assistant-agent.ts` - no tools
- `app/mastra/agents/weblead-agent.ts` - no tools
- `app/mastra/agents/weather-agent.ts` - demo
- `app/mastra/agents/main-agent.ts` - secondary

### Tools (~50 files)
All files in `app/mastra/tools/` need execute signature updates.

### API Routes
- `app/routes/api.chat.project-status.tsx` - RuntimeContext usage
- `app/routes/api.chat.project-status.history.tsx` - memory query

### Config & Infrastructure
- `app/mastra/index.ts` - Mastra instance
- `app/mastra/memory.ts` - shared memory config
- `app/mastra/storage/postgres-singleton.ts` - storage
- `app/mastra/processors/tool-call-pair-processor.ts` - custom processor

### Workflows
- `app/mastra/workflows/daily-brief.ts`
- `app/mastra/workflows/signup-onboarding.ts`

---

## Rollback Plan

If critical issues arise:

1. Revert to previous commit: `git revert HEAD`
2. Restore package versions: `git checkout HEAD~1 -- package.json pnpm-lock.yaml && pnpm install`
3. Restore database from backup if memory format issues

---

## Resources

- [Mastra v1 Migration Guide](https://mastra.ai/en/guides/migrations/upgrade-to-v1)
- [Upgrade to Latest 0.x](https://mastra.ai/guides/migrations/upgrade-to-latest-0x)
- [Mastra v1 Announcement](https://mastra.ai/blog/mastrav1)
- [GitHub Releases](https://github.com/mastra-ai/mastra/releases)
- [Codemod Package](https://github.com/mastra-ai/mastra/tree/main/packages/codemod)

---

## Estimated Effort

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Prerequisites | 30 min |
| Phase 2: Codemods | 15 min |
| Phase 3: Manual Updates | 4-6 hours |
| Phase 4: Package Updates | 15 min |
| Phase 5: TypeScript Fixes | 1-2 hours |
| Phase 6: Testing | 2-3 hours |
| Phase 7: Deployment | 1 hour |
| **Total** | **8-12 hours** |

---

## Notes

- The codemods handle most mechanical changes
- Tool signature changes are the biggest manual effort (50+ files)
- Memory format is backwards compatible - no DB migration needed
- Custom `ToolCallPairProcessor` needs interface verification
- Test thoroughly before production - memory/agent behavior may have subtle changes
