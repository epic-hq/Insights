# Mastra Tool Contracts (Upsight Standard)

This document defines the required contract for all new Mastra tools in this repo.

---

## Why this exists

Tools are the primary interface between agents and the product. Consistent contracts:
- prevent invalid inputs
- reduce hallucinations
- improve debuggability
- keep tool responses safe and scannable

---

## Required Contract (All New Tools)

### 1) Input schema

- Use Zod input schema.
- Prefer explicit, unambiguous parameter names.
- Include a `responseFormat` or `limit` control.
- Do not accept `accountId` or `projectId` from the model if it can be derived from runtime context.

### 2) Output schema

Every tool must return:
```ts
{
  success: boolean
  message: string
  data?: unknown
  error?: {
    code: string
    message: string
    hint?: string
  }
  links?: {
    label: string
    url: string
  }[]
}
```

- `message` should be a short human-readable summary.
- `error` must be actionable when `success=false`.
- `links` should include record URLs when entities are referenced.

### 3) Response format control

Use either:
- `responseFormat: "concise" | "detailed"` or
- `limit` + `truncate` behavior with clear instructions in the response.

### 4) Context resolution

Always resolve project/account via runtime context:
- `resolveProjectContext()` or `resolveAccountIdFromProject()`
- Never trust URL params or user-provided IDs for account scope.

### 5) Error handling

- Do not throw raw errors to the model.
- Return `success=false` with `error` details.
- Include a hint or example when user input is wrong.

---

## Template

```ts
import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { resolveProjectContext } from "~/mastra/tools/context-utils"

export const exampleTool = createTool({
  id: "example-tool",
  description: "Short, clear description. Include usage constraints.",
  inputSchema: z.object({
    query: z.string().min(1).describe("What to search for"),
    responseFormat: z.enum(["concise", "detailed"]).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        hint: z.string().optional(),
      })
      .optional(),
    links: z
      .array(
        z.object({
          label: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
  }),
  execute: async (input, context) => {
    try {
      const { projectId, accountId } = await resolveProjectContext(context, "example-tool")
      // ...tool logic...
      return {
        success: true,
        message: "Found 3 matching records",
        data: [],
        links: [],
      }
    } catch (error) {
      return {
        success: false,
        message: "Tool failed",
        error: {
          code: "TOOL_FAILURE",
          message: error instanceof Error ? error.message : "Unknown error",
          hint: "Check inputs and try again.",
        },
      }
    }
  },
})
```

---

## Additional Rules

- Prefer semantic tools over API-mirroring tools.
- Keep tool sets small per agent.
- Include pagination or filtering on any potentially large response.
- Always include URLs for record references if the UI expects linkability.
- Wrap tools with `wrapToolsWithStatusEvents` for UI status feedback.
