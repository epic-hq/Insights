# Onboarding & Success Journey — Testing Coverage Audit

## User Journeys Mapped

### Journey 1: New User Signup → First Value

```
Sign-up → login_success → ensureDefaultAccountAndProject
  → /a/:accountId/:projectId/setup?onboarding=1
  → ProjectSetupChat (path selection: plan / analyze / record / explore)
  → ProjectGoalsScreen (research goal, target roles, orgs, assumptions)
  → QuestionsScreen (AI-generated interview prompts)
  → UploadScreen (file upload → processing → evidence extraction)
  → Dashboard (first insights visible)
```

**Key files:**
- `app/routes/(auth)+/login_success.tsx` — routing decision tree
- `app/routes/_ProtectedLayout.tsx` — middleware: signup-chat gate, no-project gate
- `app/components/onboarding/OnboardingWalkthrough.tsx` — role/use-case/company modal
- `app/components/onboarding/OnboardingProvider.tsx` — auto-show logic
- `app/features/projects/pages/setup.tsx` — TypeformQuestion + CapturedPane
- `app/features/projects/components/ProjectSetupChat.tsx` — AI setup chat
- `app/features/onboarding/components/OnboardingFlow.tsx` — multi-step flow
- `app/features/onboarding/components/UploadScreen.tsx` — file upload
- `app/routes/api.onboarding-start.tsx` — upload + processing action
- `app/routes/api.user-settings.onboarding.tsx` — walkthrough persistence

### Journey 2: Returning User → Dashboard

```
Login → login_success → resolveLastUsedProjectRedirect
  → /a/:accountId/p/:projectId/dashboard
```

### Journey 3: Invited User

```
Sign-up with invite → login_success → resolveInviteRedirect
  → /accept-invite?invite_token=...
  → team/manage (accept invitation)
  → project dashboard
```

### Journey 4: Walkthrough Modal (existing users, incomplete onboarding)

```
Any protected page → OnboardingProvider checks shouldShowOnboarding
  → 1s delay → OnboardingWalkthrough modal
  → Step 1: Job function
  → Step 2: Use cases (multi-select)
  → Step 3: Company size
  → POST /api/user-settings/onboarding → user_settings upsert
```

---

## Existing Coverage

| Area | Test Type | File | Status |
|------|-----------|------|--------|
| Login page loads | E2E | `tests/e2e/tests/auth.spec.ts` | ✅ |
| Sign-up page loads | E2E | `tests/e2e/tests/auth.spec.ts` | ✅ |
| Invalid credentials error | E2E | `tests/e2e/tests/auth.spec.ts` | ✅ |
| Password mismatch error | E2E | `tests/e2e/tests/auth.spec.ts` | ✅ |
| UTM param preservation | E2E | `tests/e2e/tests/auth.spec.ts` | ✅ |
| Authenticated login | E2E | `tests/e2e/tests/auth.spec.ts` | ✅ |
| Onboarding page loads | E2E | `tests/e2e/tests/project.spec.ts` | ✅ |
| PostHog tracking on pages | E2E | `tests/e2e/tests/tracking.spec.ts` | ✅ |
| Billing portal redirect | E2E | `tests/e2e/tests/billing.spec.ts` | ✅ |
| Onboarding pipeline (upload→webhook→processing) | Integration | `app/test/integration/onboarding-pipeline.integration.test.ts` | ✅ |
| Webhook idempotency | Integration | `app/test/integration/onboarding-pipeline.integration.test.ts` | ✅ |
| Status transitions | Integration | `app/test/integration/onboarding-pipeline.integration.test.ts` | ✅ |
| Transcription failure handling | Integration | `app/test/integration/onboarding-pipeline.integration.test.ts` | ✅ |
| buildOnboardingContext mapping | Unit | `app/hooks/useOnboardingStatus.test.ts` | ✅ NEW |
| login_success routing helpers | Unit | `app/routes/__tests__/login-success-routing.test.ts` | ✅ NEW |
| Onboarding settings API validation | Unit | `app/routes/__tests__/onboarding-settings-api.test.ts` | ✅ NEW |
| Onboarding flow E2E (setup, upload, questions) | E2E | `tests/e2e/tests/onboarding-flow.spec.ts` | ✅ NEW |

---

## Gap Analysis — What's NOT Covered

### 🔴 Critical Gaps (break the funnel)

1. **`login_success` redirect logic (integration)**
   - `checkIfNewUser()` — the 10-second window logic has no test
   - `ensureDefaultAccountAndProject()` — auto-project creation untested
   - `resolveLastUsedProjectRedirect()` — returning user path untested
   - **Impact:** Wrong redirect = user lost on first login. Highest-impact bug surface.
   - **Fix:** Integration test calling the loader with mocked Supabase responses for each branch

2. **`_ProtectedLayout` middleware guards**
   - Signup-chat redirect when `SIGNUP_CHAT_REQUIRED=true`
   - No-projects redirect to `/a/:accountId/home`
   - Redirect-loop avoidance (checks for `/projects/new`, `onboarding=true`, invite tokens)
   - **Impact:** Infinite redirect loops or users locked out of the app
   - **Fix:** Unit test the middleware function with mock request URLs

3. **OnboardingWalkthrough → API save → completion flag**
   - The full cycle: user selects role → completes walkthrough → `shouldShowOnboarding` becomes false
   - No test validates the walkthrough actually persists and prevents re-showing
   - **Fix:** Integration test or E2E that completes walkthrough and verifies modal doesn't re-appear

### 🟡 Important Gaps (degrade experience)

4. **ProjectGoalsScreen autosave**
   - `useAutoSave` hook debounce + projectId-ready flush logic untested
   - Risk: goals lost on navigation, stale projectId closures
   - **Fix:** Unit test `useAutoSave` with fake timers (vi.useFakeTimers)

5. **Upload flow branching (5 processing paths)**
   - `api.onboarding-start` has 5 distinct paths: document, text voice-memo, text interview, audio voice-memo, audio interview
   - Only the audio interview path has integration test coverage
   - **Fix:** Parameterized integration tests for each sourceType/mediaType combo

6. **Signup chat completion → redirect**
   - `SignupDataWatcher` + `onCompleted` → navigate to `/signup-chat/completed` → `/home`
   - No test validates this chain
   - **Fix:** E2E test or component test with mocked chat completion

7. **Invite token flow end-to-end**
   - `extractInviteToken`, `resolveInviteRedirect`, `computeManagePathFromToken` work together
   - Only `extractInviteToken` has unit coverage (via login-success-routing.test.ts)
   - **Fix:** Integration test for full invite acceptance chain

### 🟢 Nice-to-Have Gaps

8. **OnboardingFlow step navigation**
   - welcome → questions → upload → processing → complete transitions
   - Back button returns to correct step
   - `existingProject` prop starts at upload step

9. **ProcessingScreen polling and status display**
   - Trigger.dev run status polling
   - Progress bar accuracy
   - Error state display

10. **FeatureTour component**
    - Tour step navigation
    - Dismissal persistence

---

## High-Value, Low-Effort Recommendations

### Tier 1: Do This Week (< 2 hours each, highest ROI)

**1. Extract and export `login_success` pure functions**
The routing helpers (`checkIfNewUser`, `isDefaultHomeDestination`, `extractInviteToken`) are inline in login_success.tsx. Extract them to a shared utility:

```typescript
// app/lib/auth/login-routing.ts
export function isDefaultHomeDestination(next: string, origin: string): boolean { ... }
export function extractInviteToken(next: string, origin: string): string | null { ... }
export function isNewUserByTimestamp(createdAt: string, thresholdSeconds = 10): boolean { ... }
```

This unlocks direct unit testing without mocking Supabase — the tests in `login-success-routing.test.ts` already validate the logic but currently re-implement it. Making them import from source catches regressions.

**2. Add `data-testid` attributes to onboarding components**
The E2E tests currently use fragile text/CSS selectors. Adding semantic test IDs makes tests resilient to copy changes:

```tsx
// OnboardingWalkthrough.tsx
<RadioGroup data-testid="job-function-selector">
<Button data-testid="onboarding-continue">

// UploadScreen.tsx
<div data-testid="upload-dropzone">
<input data-testid="file-input" type="file">

// ProjectGoalsScreen
<textarea data-testid="research-goal-input">
```

**3. Add `_ProtectedLayout` middleware unit tests**
The middleware function is a pure function of `(request, context)`. Test the redirect decisions without a running server:

```typescript
describe("_ProtectedLayout middleware", () => {
  it("redirects to /signup-chat when SIGNUP_CHAT_REQUIRED and not completed")
  it("redirects to /a/:accountId/home when user has no projects")
  it("does not redirect when on /projects/new")
  it("does not redirect when invite_token present on team manage page")
  it("redirects to /login on auth failure")
})
```

### Tier 2: Do This Sprint (2-4 hours, medium ROI)

**4. Parameterized upload path integration tests**
The `api.onboarding-start` action has 5 processing paths. Add a parameterized test:

```typescript
it.each([
  { sourceType: "document", mediaType: "interview", expectedStatus: "uploaded" },
  { sourceType: "transcript", mediaType: "voice_memo", expectedStatus: "ready" },
  { sourceType: "transcript", mediaType: "interview", expectedStatus: "processing" },
  { sourceType: "audio_upload", mediaType: "voice_memo", expectedStatus: "transcribing" },
  { sourceType: "audio_upload", mediaType: "interview", expectedStatus: "processing" },
])("$sourceType + $mediaType → status=$expectedStatus", async ({ ... }) => {
  // ...
})
```

**5. Walkthrough completion round-trip test**
Integration test that:
1. POSTs to `/api/user-settings/onboarding` with completed=true
2. Reads back from the same API
3. Verifies `shouldShowOnboarding` would be false

**6. useAutoSave unit test with fake timers**
```typescript
describe("useAutoSave", () => {
  it("debounces rapid saves to single API call")
  it("flushes queued save immediately when projectId becomes available")
  it("skips save when projectId is empty")
})
```

### Tier 3: Backlog (>4 hours, defensive coverage)

**7. Full E2E onboarding smoke test** — Requires test account provisioning. Create a fresh test user, verify they land on setup, can enter goals, and reach dashboard. Most valuable but highest setup cost.

**8. Signup chat agent conversation test** — Mock the Mastra agent response, verify data extraction saves to `user_settings.signup_data`, verify redirect to `/signup-chat/completed`.

**9. Cross-browser upload testing** — The `postFormDataWithProgress` XHR implementation has browser-specific timeout handling. Playwright multi-browser config would catch edge cases.

---

## Test Commands

```bash
# Run new unit tests
npx vitest run --config vitest.unit.config.ts app/hooks/useOnboardingStatus.test.ts app/routes/__tests__/login-success-routing.test.ts app/routes/__tests__/onboarding-settings-api.test.ts

# Run onboarding integration tests
npx vitest run --config vitest.integration.config.ts app/test/integration/onboarding-pipeline.integration.test.ts

# Run E2E tests (requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD)
npx playwright test tests/e2e/tests/onboarding-flow.spec.ts
npx playwright test tests/e2e/tests/auth.spec.ts
npx playwright test tests/e2e/tests/project.spec.ts
```
