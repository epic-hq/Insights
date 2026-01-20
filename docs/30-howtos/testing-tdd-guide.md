# Test-Driven Development (TDD) Guide

This guide establishes a comprehensive testing strategy for detecting regressions, validating new features, and ensuring stability when AI coding agents make changes.

## TDD Workflow

### The Red-Green-Refactor Cycle

1. **RED**: Write a failing test that describes the expected behavior
2. **GREEN**: Write the minimum code to make the test pass
3. **REFACTOR**: Clean up the code while keeping tests green

### Before Writing Code

```bash
# 1. Create your test file first
touch app/features/billing/api/record-usage.test.ts

# 2. Write the test describing expected behavior
# 3. Run the test (it should fail - RED)
pnpm test app/features/billing/api/record-usage.test.ts

# 4. Implement the feature
# 5. Run the test again (it should pass - GREEN)
pnpm test app/features/billing/api/record-usage.test.ts

# 6. Run all tests to ensure no regressions
pnpm test:all
```

## Test Categories

### 1. Unit Tests (Pure Functions)

**When to use**: Pure functions with no side effects, data transformations, validation logic

**Runtime**: ~20ms per test

**Location**: `*.test.ts` alongside source files

```typescript
// app/utils/formatCurrency.ts
export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// app/utils/formatCurrency.test.ts
import { describe, expect, it } from "vitest"
import { formatCurrency } from "./formatCurrency"

describe("formatCurrency", () => {
  it("formats cents to dollars", () => {
    expect(formatCurrency(1000)).toBe("$10.00")
  })

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00")
  })

  it("handles decimals correctly", () => {
    expect(formatCurrency(1234)).toBe("$12.34")
  })
})
```

### 2. Database Operation Tests

**When to use**: Testing db.ts functions, complex queries, junction table operations

**Runtime**: ~100-500ms per test

**Location**: `app/features/[feature]/__tests__/db.test.ts`

```typescript
// app/features/people/__tests__/db.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { testDb, seedTestData, TEST_ACCOUNT_ID, TEST_PROJECT_ID, cleanupTestData } from "~/test/utils/testDb"
import { createPerson, updatePerson, findPersonByEmail } from "../db"

describe("People DB Operations", () => {
  beforeEach(async () => {
    await seedTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  describe("createPerson", () => {
    it("creates a person with required fields", async () => {
      const person = await createPerson(testDb, {
        account_id: TEST_ACCOUNT_ID,
        firstname: "John",
        lastname: "Doe",
        email: "john@example.com",
      })

      expect(person).toMatchObject({
        firstname: "John",
        lastname: "Doe",
        email: "john@example.com",
      })
    })

    it("prevents duplicate emails within account", async () => {
      await createPerson(testDb, {
        account_id: TEST_ACCOUNT_ID,
        email: "duplicate@example.com",
      })

      await expect(
        createPerson(testDb, {
          account_id: TEST_ACCOUNT_ID,
          email: "duplicate@example.com",
        })
      ).rejects.toThrow()
    })
  })

  describe("findPersonByEmail", () => {
    it("returns null for non-existent email", async () => {
      const person = await findPersonByEmail(testDb, TEST_ACCOUNT_ID, "nonexistent@example.com")
      expect(person).toBeNull()
    })
  })
})
```

### 3. API Route Tests (Loaders/Actions)

**When to use**: Testing API endpoints, form submissions, data mutations

**Runtime**: ~50-200ms per test

**Location**: `app/routes/api.*.test.ts` or `app/features/[feature]/api/*.test.ts`

```typescript
// app/features/insights/api/archive.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { action } from "./archive"

// Mock dependencies
vi.mock("~/lib/supabase/client.server", () => ({
  getServerClient: vi.fn(),
}))

describe("Archive Insight API", () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }

  const mockContext = {
    get: vi.fn().mockReturnValue({
      supabase: mockSupabase,
      account_id: "test-account",
      user_id: "test-user",
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("archives an insight", async () => {
    mockSupabase.single.mockResolvedValue({
      data: { id: "insight-1", archived: true },
      error: null,
    })

    const request = new Request("http://localhost/api/archive", {
      method: "POST",
      body: JSON.stringify({ insightId: "insight-1" }),
    })

    const response = await action({
      request,
      context: mockContext,
      params: {},
    })

    expect(response).toMatchObject({ success: true })
  })

  it("returns error for missing insightId", async () => {
    const request = new Request("http://localhost/api/archive", {
      method: "POST",
      body: JSON.stringify({}),
    })

    const response = await action({
      request,
      context: mockContext,
      params: {},
    })

    expect(response).toMatchObject({ error: expect.any(String) })
  })
})
```

### 4. Integration Tests (End-to-End Workflows)

**When to use**: Full workflow testing, cross-feature operations, critical paths

**Runtime**: ~500ms-2s per test

**Location**: `app/test/integration/*.integration.test.ts`

```typescript
// app/test/integration/interview-processing.integration.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { testDb, seedTestData, cleanupTestData, TEST_ACCOUNT_ID, TEST_PROJECT_ID } from "~/test/utils/testDb"

describe("Interview Processing Pipeline", () => {
  beforeEach(async () => {
    await seedTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
  })

  it("processes interview from upload to ready status", async () => {
    // 1. Create interview in pending state
    const { data: interview } = await testDb
      .from("interviews")
      .insert({
        account_id: TEST_ACCOUNT_ID,
        project_id: TEST_PROJECT_ID,
        title: "Test Interview",
        status: "pending",
      })
      .select()
      .single()

    // 2. Simulate transcription completion
    await testDb
      .from("interviews")
      .update({ status: "transcribed", transcript: "Sample transcript..." })
      .eq("id", interview.id)

    // 3. Verify interview can be queried with relationships
    const { data: result } = await testDb
      .from("interviews")
      .select(`
        id,
        title,
        status,
        project:projects(title),
        people:interview_people(person:people(*))
      `)
      .eq("id", interview.id)
      .single()

    expect(result.status).toBe("transcribed")
    expect(result.project).toBeDefined()
  })

  it("links people to interviews correctly", async () => {
    // Create person
    const { data: person } = await testDb
      .from("people")
      .insert({
        account_id: TEST_ACCOUNT_ID,
        firstname: "Test",
        lastname: "Person",
      })
      .select()
      .single()

    // Link to existing interview
    await testDb.from("interview_people").insert({
      interview_id: "interview-1", // From seedTestData
      person_id: person.id,
      role: "participant",
    })

    // Verify bidirectional relationship
    const { data: interviewWithPeople } = await testDb
      .from("interviews")
      .select(`*, people:interview_people(person:people(*))`)
      .eq("id", "interview-1")
      .single()

    expect(interviewWithPeople.people).toHaveLength(2) // Original + new
  })
})
```

### 5. Trigger.dev Task Tests

**When to use**: Background job logic, state management, retry behavior

**Runtime**: ~100-500ms per test

**Location**: `src/trigger/[domain]/__tests__/*.test.ts`

```typescript
// src/trigger/interview/v2/__tests__/orchestrator.test.ts
import { describe, it, expect, vi } from "vitest"
import { WorkflowState, loadWorkflowState, saveWorkflowState } from "../state"

// Mock Supabase client
vi.mock("~/lib/supabase/client.server")

describe("Interview Processing Orchestrator", () => {
  describe("WorkflowState", () => {
    it("initializes with default values", () => {
      const state = new WorkflowState("job-123")

      expect(state.currentStep).toBe("init")
      expect(state.completedSteps).toEqual([])
      expect(state.errors).toEqual([])
    })

    it("tracks step completion", () => {
      const state = new WorkflowState("job-123")

      state.completeStep("transcription")
      state.completeStep("evidence_extraction")

      expect(state.completedSteps).toContain("transcription")
      expect(state.completedSteps).toContain("evidence_extraction")
    })

    it("determines if step should be skipped", () => {
      const state = new WorkflowState("job-123")
      state.completeStep("transcription")

      expect(state.shouldSkip("transcription")).toBe(true)
      expect(state.shouldSkip("evidence_extraction")).toBe(false)
    })
  })
})
```

## Critical Path Test Checklist

Before merging any PR, ensure these critical paths have test coverage:

### Tier 1: Business Critical (Must Have)

- [ ] **Interview Processing Pipeline**
  - Upload creates interview record
  - Transcription updates status correctly
  - Evidence extraction stores with timestamps
  - People linking works correctly

- [ ] **Billing & Credits**
  - Credit recording is accurate
  - Usage tracking per operation type
  - Billing context validation

- [ ] **People Management**
  - Person creation with deduplication
  - Email uniqueness within account
  - Organization linking

- [ ] **Authentication & Authorization**
  - Account isolation (RLS)
  - Project access permissions

### Tier 2: High Impact (Should Have)

- [ ] **Lens Application**
  - Lens templates apply correctly
  - Results stored with proper structure

- [ ] **Insights & Themes**
  - Insight CRUD operations
  - Tag associations
  - Archiving/restoration

- [ ] **Evidence**
  - Quote extraction with timestamps
  - Facet associations

### Tier 3: Supporting Features

- [ ] **Annotations** - Comments, votes, flags
- [ ] **Tasks/Opportunities** - CRUD operations
- [ ] **Research Links** - Survey processing

## Stability Validation Script

Create a pre-commit/CI script to validate stability:

```bash
#!/bin/bash
# scripts/validate-stability.sh

echo "Running stability checks..."

# 1. Type checking
echo "Step 1: Type checking..."
pnpm typecheck || { echo "Type check failed"; exit 1; }

# 2. Unit tests (fast)
echo "Step 2: Unit tests..."
pnpm test || { echo "Unit tests failed"; exit 1; }

# 3. Integration tests (slower but critical)
echo "Step 3: Integration tests..."
pnpm test:integration || { echo "Integration tests failed"; exit 1; }

# 4. Build validation
echo "Step 4: Build validation..."
pnpm build || { echo "Build failed"; exit 1; }

echo "All stability checks passed!"
```

## Test Coverage Requirements

### Minimum Coverage by Area

| Area | Statements | Branches | Functions |
|------|------------|----------|-----------|
| `app/lib/billing/` | 80% | 80% | 80% |
| `app/features/*/db.ts` | 70% | 70% | 70% |
| `app/utils/` | 60% | 60% | 60% |
| `src/trigger/` | 50% | 50% | 50% |

### Generating Coverage Report

```bash
# Generate and view coverage
pnpm test:cov

# View HTML report
open coverage/index.html
```

## Testing Patterns for AI Agents

When AI coding agents make changes, they should follow these patterns:

### 1. Always Run Tests After Changes

```bash
# After making changes to a feature
pnpm test app/features/[changed-feature]/**/*.test.ts

# Before committing
pnpm test:all
```

### 2. Write Tests for New Functions

Every new exported function should have at least:
- One test for the happy path
- One test for edge cases (null, empty, boundary values)
- One test for error conditions

### 3. Update Tests When Changing Behavior

If changing existing behavior:
1. First update the test to reflect new expected behavior (RED)
2. Then update the implementation (GREEN)
3. Verify no other tests broke

### 4. Test File Naming Convention

| Source File | Test File |
|-------------|-----------|
| `feature.ts` | `feature.test.ts` |
| `feature.server.ts` | `feature.server.test.ts` |
| `db.ts` | `__tests__/db.test.ts` |
| Integration tests | `app/test/integration/*.integration.test.ts` |

## Debugging Failed Tests

### Common Issues and Solutions

**1. PGRST301 - Auth Error**
```typescript
// Solution: Ensure mock auth is set up
import { mockTestAuth } from "~/test/utils/testDb"
vi.mock("~/lib/supabase/client.server", () => mockTestAuth())
```

**2. Module Import Error**
```typescript
// Check vitest.config.ts has correct environment
// Server tests: environment: "node"
// Browser tests: use vitest.workspace.ts
```

**3. Database Constraint Violation**
```typescript
// Ensure cleanup runs properly
afterAll(async () => {
  await cleanupTestData()
})

// Or use unique IDs per test
const testId = `test-${Date.now()}`
```

**4. Timeout Issues**
```typescript
// For slow operations, increase timeout
it("handles large datasets", async () => {
  // ...
}, { timeout: 10000 }) // 10 seconds
```

## Quick Reference Commands

```bash
# Run all tests
pnpm test:all

# Run specific test file
pnpm test app/utils/formatCurrency.test.ts

# Run tests matching pattern
pnpm test --grep "billing"

# Run with watch mode
pnpm test:ui

# Run integration tests only
pnpm test:integration

# Generate coverage report
pnpm test:cov

# Run validation suite
pnpm validate
```
