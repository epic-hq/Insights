# E2E Testing with Playwright

End-to-end tests for validating user flows and PostHog tracking events.

## Quick Start

```bash
# Run all E2E tests (headless)
pnpm test:e2e

# Run with Playwright UI for debugging
pnpm test:e2e:ui

# Run with visible browser
pnpm test:e2e:headed
```

## Directory Structure

```
tests/e2e/
├── fixtures/       # Test fixtures (PostHog capture, auth, etc.)
│   ├── base.ts     # Core fixtures including PostHog event capture
│   ├── auth.ts     # Authentication fixture for logged-in tests
│   └── index.ts    # Combined fixture exports
├── pages/          # Page Object Models (coming soon)
├── tests/          # Actual test files
│   ├── home.spec.ts     # Home page tests
│   ├── auth.spec.ts     # Login/signup page tests
│   ├── project.spec.ts  # Project creation tests
│   └── tracking.spec.ts # Interview/task tracking tests
└── README.md
```

## PostHog Event Testing

Tests use a custom fixture to capture and validate PostHog events:

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

## Authenticated Tests

Tests requiring authentication use the `auth` fixture:

```typescript
import { test, expect } from '../fixtures';

test.describe('Authenticated flows', () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    'Requires E2E test credentials'
  );

  test.beforeEach(async ({ auth }) => {
    await auth.login();
  });

  test('can access projects', async ({ page }) => {
    await page.goto('/projects');
    // ... test authenticated functionality
  });
});
```

### Auth Bundle (Storage State)

When `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` are set, global setup logs in
once and stores a reusable auth state at `tests/e2e/.auth/user.json`.

```bash
E2E_TEST_EMAIL=test@example.com E2E_TEST_PASSWORD=secret pnpm test:e2e
```

This reduces repeated logins across tests and improves stability.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `E2E_BASE_URL` | Base URL for tests (default: `http://localhost:4280`) | No |
| `E2E_TEST_EMAIL` | Test user email for authenticated tests | For auth tests |
| `E2E_TEST_PASSWORD` | Test user password for authenticated tests | For auth tests |

## CI Integration

### GitHub Actions Configuration

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Run E2E tests
        run: pnpm test:e2e --project=chromium
        env:
          E2E_BASE_URL: ${{ secrets.E2E_BASE_URL }}
          E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
          E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

### CI Behavior

Tests automatically adapt to CI environment:
- **Retries**: 2 retries in CI (0 locally)
- **Workers**: 1 worker in CI (unlimited locally)
- **Artifacts**: Screenshots on failure, trace on first retry
- **Web Server**: Disabled in CI (expects running server)

### Bug Bundles (Local Failures)

When you set `BUG_ID`, failing tests will copy their artifacts into a bundle:

```bash
BUG_ID=123 pnpm test:e2e --project=chromium
```

Artifacts are copied to:

```
artifacts/bug-123/<project>-<test>/
  console.log
  network.har
  trace.zip
  screenshot.png
  video.webm
  repro.md
```

### Running Against Staging

```bash
E2E_BASE_URL=https://staging.example.com pnpm test:e2e
```

### Test User Setup

For authenticated tests in CI:
1. Create a dedicated test account in your staging environment
2. Store credentials as GitHub secrets (`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`)
3. Tests skip gracefully when credentials are not available

## Test Categories

| Test File | Coverage | Auth Required |
|-----------|----------|---------------|
| `home.spec.ts` | Homepage, basic navigation | No |
| `auth.spec.ts` | Login/signup pages, form validation | Some tests |
| `project.spec.ts` | Project creation, onboarding | Yes |
| `tracking.spec.ts` | PostHog event validation | Some tests |

## PostHog Events Tested

Key events validated by E2E tests:
- `$pageview` - Automatic page tracking
- `account_signed_up` - User registration
- `project_created` - New project creation
- `interview_detail_viewed` - Interview page visits
- `task_created` - Task creation
- `task_status_changed` - Task status updates

See [PostHog Events Documentation](../../docs/60-ops-observability/posthog-events-implemented.md) for full event list.
