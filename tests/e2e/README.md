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
│   └── index.ts    # Re-exports
├── pages/          # Page Object Models (coming soon)
├── tests/          # Actual test files
│   └── home.spec.ts
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

## CI Integration

Tests run with:
- Retries: 2 (in CI only)
- Workers: 1 (in CI, unlimited locally)
- Artifacts: Screenshots on failure, trace on first retry

Set `E2E_BASE_URL` to test against a deployed environment.
