# Survey Personalization Test Plan

**Date**: 2026-02-07
**Feature**: Personalized Survey Links (Stories 1-7)
**Status**: Testing in Progress

## Test Scenarios

### Story 1: URL Parameter Parsing & Auto-Fill

**Test 1.1: Email parameter**
- URL: `/ask/{slug}?email=test@example.com`
- Expected: Email field pre-filled with `test@example.com`
- Status: ⏳ Pending

**Test 1.2: Phone parameter**
- URL: `/ask/{slug}?phone=5551234567`
- Expected: Phone field pre-filled (for phone-identified surveys)
- Status: ⏳ Pending

**Test 1.3: Name parameters**
- URL: `/ask/{slug}?email=test@example.com&first_name=John&last_name=Doe`
- Expected: Email pre-filled, name fields pre-filled
- Status: ⏳ Pending

**Test 1.4: Combined name parameter**
- URL: `/ask/{slug}?email=test@example.com&name=John%20Doe`
- Expected: Email pre-filled, first_name=John, last_name=Doe
- Status: ⏳ Pending

### Story 2: Auto-Submit for Known People

**Test 2.1: Known person (email exists in CRM)**
- Setup: Create person with email in database
- URL: `/ask/{slug}?email={known_email}`
- Expected: Skip identity gate → go straight to survey
- Status: ⏳ Pending

**Test 2.2: Unknown person with name**
- URL: `/ask/{slug}?email=new@example.com&first_name=Jane&last_name=Smith`
- Expected: Create person record → skip to survey
- Status: ⏳ Pending

**Test 2.3: Unknown person without name**
- URL: `/ask/{slug}?email=new@example.com`
- Expected: Show name collection form
- Status: ⏳ Pending

### Story 3: Personalized Link Workflow

**Test 3.1: Standalone email param (no responseId)**
- URL: `/ask/{slug}?email=test@example.com`
- Expected: Auto-submit on page load, create response
- Status: ⏳ Pending

**Test 3.2: Resume existing response**
- Setup: Start survey, save responseId to localStorage
- Action: Reload page
- Expected: Resume from last answered question
- Status: ⏳ Pending

**Test 3.3: Embed redirect with responseId**
- URL: `/ask/{slug}?email=test@example.com&responseId={uuid}`
- Expected: Resume specific response
- Status: ⏳ Pending

### Story 4: UTM Campaign Attribution

**Test 4.1: UTM parameters captured**
- URL: `/ask/{slug}?email=test@example.com&utm_source=linkedin&utm_campaign=q1-outreach&utm_medium=social`
- Expected: UTM params stored in `research_link_responses.utm_params`
- Verify: Check database after submission
- Status: ⏳ Pending

**Test 4.2: UTM params persist across resume**
- Action: Start survey with UTM params, reload page
- Expected: Original UTM params preserved
- Status: ⏳ Pending

### Story 5-7: AI Personalization (Adaptive Autonomy)

**Test 5.1: Strict mode (default)**
- Setup: Survey with `ai_autonomy='strict'`
- Expected: Agent follows questions exactly, no follow-ups
- Status: ⏳ Pending

**Test 5.2: Moderate mode**
- Setup: Survey with `ai_autonomy='moderate'`, known person
- Expected: Agent may ask 1 brief follow-up, skip irrelevant questions
- Status: ⏳ Pending

**Test 5.3: Adaptive mode with ICP context**
- Setup: Survey with `ai_autonomy='adaptive'`, person with ICP score
- Expected: Agent references background, probes on research goals
- Status: ⏳ Pending

**Test 5.4: Missing profile data detection**
- Setup: Person missing title/company
- Expected: Agent naturally asks clarifying question
- Status: ⏳ Pending

**Test 5.5: Calendar link rendering**
- Setup: Survey with `calendar_url` configured
- Expected: Agent offers `[book a call](url)` link at end
- Status: ⏳ Pending

## Testing Session

**Date**: 2026-02-07 23:30 PST
**Environment**: Local dev server (http://localhost:4281)
**Tester**: Cascade AI

### Setup
- Dev server running on port 4281
- Mastra server has port conflict (4111) but not blocking tests
- Need to identify/create test survey with known slug

### Test Execution Log

#### Session 1: Initial Setup
- ⏳ **Status**: Accessing application to identify test survey
- **Action**: Navigate to `/a/1/1/ask` to find existing surveys
- **Next**: Create or identify survey with:
  - Known slug (e.g., `test-survey`)
  - Email-identified mode
  - Chat enabled
  - Calendar URL configured
  - Adaptive autonomy mode

---

## Test Results

### Bugs Found
- None yet

### Issues to Fix
- None yet

## Next Steps
1. ✅ Start dev server
2. ✅ Create test plan document
3. ⏳ Identify/create test survey
4. Run through each test scenario
5. Document results
6. Fix any issues found
7. Re-test after fixes
