# Testing Strategy for Interview Insights Platform

## Philosophy

Our testing approach prioritizes **business logic validation** and **database integrity** over implementation details. We focus on:

1. **Unit Tests for Pure Functions** - Test business logic directly without mocking
2. **Integration Tests with Real Database** - Validate end-to-end workflows against seeded data
3. **Schema Change Detection** - Catch breaking changes in queries, loaders, and actions
4. **Minimal Mocking** - Only mock external APIs/services that can't be controlled

## Business Logic

### What we want to validate

- A user can upload an interview
 media file and have it converted to text, key insights extracted, and saved to the database

- A user can view the interview transcript and key insights, and navigate through different segments of the interview

- A user can view key inisghts and pain points, and filter by segment, persona, pain.

- A user can edit and update interview, insights, people, personas, and pain points.

- A user can chat with an AI assistant to get insights and recommendations based on the interview data.

- Functionally: Check that triggers are working as expected.Jobs are added to queues, and procesed. Edge functions are called as expected with proper credentials and return results. AI services (openAI, BAML etc) are called as expected with proper credentials and return results.

- Security: Check that only authorized users can access sensitive data. Check that only authorized users can perform sensitive actions.

## Test Types

### Unit Tests (Fast & Focused)

- **Target**: Pure business logic functions
- **Location**: `*.test.ts` files alongside source
- **No Mocking**: Test pure functions with simple input→output validation
- **Examples**: Name generation, statistics calculation, validation logic
- **Runtime**: ~20ms per test, 96 tests passing

### Integration Tests (Real DB Operations)

- **Target**: Database operations, loaders, actions, complex queries, schema changes, edge functions, job queues, AI/LLM/BAML services
- **Location**: `app/test/integration/`
- **Real Database**: Tests run against the production Supabase instance using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env` via `dotenvx`
- **Examples**: Survey response save workflow (`survey-response-save.integration.test.ts`), interview upload, backfill operations
- **Runtime**: ~500ms per test, focuses on high-risk areas
- **Pattern**: Each test creates unique test data (UUIDs, timestamped slugs), cleans up in `afterAll`

## Test Setup

### Integration Test Environment

Integration tests use the real Supabase instance (not a local emulator). Environment variables are injected via `dotenvx`:

```bash
# Run a specific integration test
dotenvx run -- vitest run app/test/integration/survey-response-save.integration.test.ts
```

Tests create an admin client directly from env vars and mock only the Supabase client factory so the action under test uses the same connection:

```typescript
const adminDb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

vi.mock("~/lib/supabase/client.server", () => ({
  createSupabaseAdminClient: () => adminDb,
}));
```

**Note**: The `testDb` helper in `app/test/utils/testDb.ts` uses `TEST_SUPABASE_URL` which points to a local Supabase instance (`127.0.0.1:54321`). For integration tests against the real database, create the client directly from `SUPABASE_URL` as shown above.

## Running Tests

### Command Reference

```bash
# Unit tests (fast - pure business logic)
npm run test
# OR with pnpm
pnpm run test

# Integration tests (real DB operations)
npm run test:integration
pnpm run test:integration

# Integration tests with env vars (for tests using real Supabase)
dotenvx run -- vitest run app/test/integration/survey-response-save.integration.test.ts

# All tests (unit + integration)
npm run test:all
pnpm run test:all

# Coverage report (includes HTML output)
npm run test:cov
pnpm run test:cov

# Watch mode (auto-rerun on file changes)
npm run test:watch
pnpm run test:watch

# Run specific test file
npm run test -- app/utils/personNameGeneration.test.ts
pnpm run test app/utils/personNameGeneration.test.ts

# Run tests matching a pattern
npm run test -- --grep "person name"
pnpm run test --grep "person name"
```

### Test Output Interpretation

**Successful Run Example:**

```text
✓ 185 tests passing (78% success rate)
✗ 51 tests failing (mostly auth/mocking setup issues)
📊 60% overall code coverage
```

**Common Test Failure Categories:**

- **Authentication Issues**: `PGRST301` errors (JWT/auth mocking problems)
- **Module Import Issues**: `require is not defined` (ESM/CommonJS conflicts)
- **Error Code Mismatches**: Expected specific Postgres error codes
- **RLS Policy Issues**: Row Level Security access problems

**What to Focus On:**

- ✅ Core business logic tests should pass
- ✅ Database schema and migration tests should pass
- ⚠️ Auth/mocking failures are often setup issues, not core functionality

## Coverage Reports

### Generating Coverage Reports

```bash
# Generate coverage with HTML report
npm run test:cov
# OR
pnpm run test:cov
```

### Viewing Coverage Reports

**HTML Report (Recommended):**
```bash
# Auto-opens in browser (macOS)
open coverage/index.html

# Manual navigation
cd coverage && open index.html

# In VS Code
code coverage/index.html
```

**Coverage Files Generated:**

- `coverage/index.html` - Interactive web report
- `coverage/app/` - Per-file detailed coverage
- `coverage/coverage-final.json` - Raw coverage data
- `coverage/coverage-summary.json` - Summary statistics

### Understanding Coverage Metrics

**Coverage Types:**

- **Statement Coverage**: % of code lines executed
- **Branch Coverage**: % of conditional branches tested
- **Function Coverage**: % of functions called
- **Line Coverage**: % of executable lines hit

**Color Coding in HTML Report:**

- 🟢 **Green**: Covered lines (tested)
- 🔴 **Red**: Uncovered lines (not tested)
- 🟡 **Yellow**: Partially covered (some branches tested)

**Current Coverage Targets:**

- **60%+ Statement Coverage**: Good foundation
- **85%+ Branch Coverage**: Excellent conditional testing
- **50%+ Function Coverage**: Room for improvement

### Coverage Report Navigation

1. **Overview Page**: See project-wide coverage percentages
2. **Directory Navigation**: Click folders to drill down
3. **File Details**: Click files to see line-by-line coverage
4. **Search**: Use browser search to find specific files/functions

**Pro Tips:**

- Focus on testing critical business logic (high-risk areas)
- Don't chase 100% coverage - focus on meaningful tests
- Use coverage to identify untested edge cases
- Red lines often indicate error handling paths

## Writing Unit Tests

Extract pure business logic into helper functions and test directly:

```typescript
// Good: Pure function, easy to test
export function buildPersonNameFromFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
}

// Test it directly
it('should clean filename for person name', () => {
  expect(buildPersonNameFromFilename('john_doe_interview.mp3'))
    .toBe('john doe interview')
})
```

## E2E Tests (Playwright)

End-to-end tests validate complete user flows and PostHog tracking events.

### Running E2E Tests

```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run with Playwright UI for debugging
pnpm test:e2e:ui

# Run with visible browser
pnpm test:e2e:headed

# Run specific test file
pnpm test:e2e tests/e2e/tests/auth.spec.ts

# Run tests matching pattern
pnpm test:e2e --grep "login"
```

### E2E Test Structure

```
tests/e2e/
├── fixtures/           # Test fixtures
│   ├── base.ts         # PostHog event capture fixture
│   ├── auth.ts         # Authentication fixture
│   └── index.ts        # Combined exports
├── tests/              # Test files
│   ├── home.spec.ts    # Homepage tests
│   ├── auth.spec.ts    # Login/signup tests
│   ├── project.spec.ts # Project creation tests
│   └── tracking.spec.ts # PostHog tracking tests
└── README.md           # Detailed E2E docs
```

### Authenticated Tests

Some tests require authentication. Set environment variables:

```bash
# For authenticated flow tests
E2E_TEST_EMAIL=test@example.com E2E_TEST_PASSWORD=secret pnpm test:e2e
```

Tests skip gracefully when credentials aren't available.

### PostHog Event Testing

E2E tests can capture and validate PostHog events:

```typescript
import { test, expect } from '../fixtures';

test('tracks signup event', async ({ page, posthog }) => {
  await page.goto('/signup');
  await page.fill('[name=email]', 'test@example.com');
  await page.click('button[type=submit]');

  // Wait for and validate PostHog event
  const event = await posthog.waitForEvent('user_signed_up');
  expect(event.properties.email).toBe('test@example.com');
});
```

### CI Configuration

See `tests/e2e/README.md` for GitHub Actions setup and CI considerations.

## Writing Integration Tests

Test real database operations with seeded data to catch schema/query issues.

### Person Resolution Integration Tests (2026-02-07)

The unified person resolution system has comprehensive integration tests covering all matching strategies and edge cases:

**Location**: `app/test/integration/people-resolution.integration.test.ts` (537 lines, 37 tests)

**Test Coverage**:
- Email matching (case-insensitive, priority)
- Platform ID matching (Zoom, Teams, Meet)
- Name + company fuzzy matching
- Person creation with full data
- Idempotency (concurrent requests, retries)
- Match priority order
- Edge cases (null, whitespace, missing fields)

**Status**: Tests require database connection to run. Code structure verified via successful builds.

**Run Tests**:
```bash
# Requires database connection
dotenvx run -- vitest run app/test/integration/people-resolution.integration.test.ts
```

**Example Test Pattern**:
```typescript
describe('Person Resolution - Email Matching', () => {
  beforeAll(async () => {
    await seedTestData()
    // Seed person with email
    await testDb.from('people').insert({
      id: 'person-1',
      account_id: TEST_ACCOUNT_ID,
      name: 'Jane Doe',
      primary_email: 'jane@example.com'
    })
  })

  it('matches by email (highest priority)', async () => {
    const result = await resolveOrCreatePerson(testDb, TEST_ACCOUNT_ID, null, {
      name: 'Jane Doe',
      primary_email: 'jane@example.com'
    })

    expect(result.person.id).toBe('person-1')
    expect(result.matchedBy).toBe('email')
    expect(result.person.created).toBe(false)
  })
})
```

### General Integration Test Pattern

   ```ts
   // backfill.integration.test.ts
   import { describe, it, expect, beforeAll, afterAll } from 'vitest'
   import { db, resetDb } from '~/test/utils/db'
   import { backfillMissingPeople } from './backfillPeople.server'

   // Mock only external blob upload or email senders:
   vi.mock('@vercel/blob/client', () => ({ upload: vi.fn() }))

   describe('backfillMissingPeople (integration)', () => {
     beforeAll(async () => {
       await resetDb()
       // seed one interview
       await db.from('interviews').insert([{ id: 'i1', participant_pseudonym: 'Bob', account_id: 'acct1', interview_date: '2025-01-01' }])
     })

     afterAll(async () => {
       await db.remove()
     })

     it('creates a person and link record in real DB', async () => {
       const result = await backfillMissingPeople(new Request('/'), { accountId: 'acct1', dryRun: false })
       expect(result.peopleCreated).toBe(1)
       expect(result.linksCreated).toBe(1)

       const { data: people } = await db.from('people').select('*')
       expect(people).toHaveLength(1)
       expect(people![0].name).toBe('Bob')
     })
   })
   ```
