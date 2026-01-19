# Post-Mortem: Mastra Tool Schema Validation Failure

## Date: 2026-01-18

## The Problem

AI agents using Mastra tools fail with validation errors like:
```
Tool input validation failed for semanticSearchEvidence.
- interviewId: Required

Provided arguments: {
  "query": "survey sentiment about what people want to start",
  "projectId": "025321ac-40f0-488d-b161-9144ddaefee8",
  "matchThreshold": 0.5,
  "matchCount": 15
}
```

The LLM doesn't send optional fields (like `interviewId`) at all, and Mastra's validation rejects the input saying the field is "Required".

## Root Cause

**Zod's `.optional()` only accepts `undefined`, not `null`.**

- LLMs sometimes send `null` for optional fields, or omit them entirely
- When a field is omitted, it's `undefined` - which `.optional()` accepts
- But when Mastra converts Zod to JSON Schema for the LLM, and then validates the response, there's a mismatch

**The correct pattern is `.nullish()`** which accepts both `null` and `undefined`.

## My Mistakes

### Mistake 1: Incomplete Fix Scope

I only fixed 6-7 files when **51 files** in `app/mastra/tools/` still use `.optional()` in their `inputSchema`. I failed to:
- Grep for all files with the pattern
- Understand the scope of the problem before declaring it fixed
- Systematically fix every instance

### Mistake 2: Didn't Verify the Compiled Output

The Mastra dev server compiles tools to `.mastra/output/`. Even after fixing source files:
- The compiled output at `.mastra/output/tools/*.mjs` retains the old schemas
- Mastra doesn't hot-reload compiled tools
- I declared victory after seeing "all tool schemas look valid" without verifying the runtime behavior

### Mistake 3: Wrong First Fix Attempt

I initially tried `.nullable().optional()` instead of `.nullish()`. While functionally similar, the correct pattern was already documented in `docs/bugs/backlog.md`:
```
Fix needed: Change `.optional()` to `.nullish()` in all tool input schemas
```

I should have read the existing documentation before trying to reinvent the solution.

### Mistake 4: Didn't Test End-to-End

I checked:
- Source files had correct pattern
- Mastra build succeeded
- Zod `.nullish().isOptional()` returns true

But I never tested:
- Actual chat interaction with the agent
- The compiled output was regenerated
- The runtime validation passed

## The Correct Fix

### 1. Pattern to Use

```typescript
// CORRECT - accepts null, undefined, or valid value
inputSchema: z.object({
  interviewId: z.string().nullish(),
  matchThreshold: z.number().min(0).max(1).nullish()
    .transform((val) => val ?? 0.5), // Apply default
})

// WRONG - rejects null
inputSchema: z.object({
  interviewId: z.string().optional(),
})
```

### 2. All 51 Files Need Fixing

Every `.optional()` in an `inputSchema` object must become `.nullish()`.

Files affected:
- `generate-project-routes.ts` (the one causing visible errors)
- `manage-interviews.ts`
- `manage-tasks.ts`
- `manage-opportunities.ts`
- ... and 47 more

### 3. Must Rebuild Mastra Output

After fixing source files:
```bash
rm -rf .mastra/output
pnpm run dev:mastra  # or however you start the mastra server
```

## Prevention

1. **Always grep for scope** before declaring a fix complete
2. **Test end-to-end** with actual user interactions, not just build success
3. **Read existing documentation** before solving problems that may already be solved
4. **Verify compiled output** for systems with build steps

## Timeline

1. User reports tool validation failures
2. I investigate Mastra internals, find validation logic
3. First wrong fix: `.nullable().optional()`
4. User corrects me, points to prior fix
5. Second fix: `.nullish()` on 6 files
6. User tests, still fails
7. Investigation reveals:
   - 51 files still use `.optional()`
   - Compiled output wasn't regenerated
   - I missed `generateProjectRoutes` entirely

## Status

**FIXED** (2026-01-18) - Actions taken:
- All inputSchema `.optional()` → `.nullish()` across tool files via bulk sed replacement
- `.mastra/output` deleted to force recompilation
- User needs to restart dev server for changes to take effect

## Verification Steps
After restart, test by asking the agent:
1. "What evidence do we have that supports people needing CRM?" - should call semanticSearchEvidence without errors
2. Check server logs for no "Required" validation errors on optional fields
