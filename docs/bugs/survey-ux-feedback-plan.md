# Survey UX Feedback Analysis & Plan

## Feedback Source
User testing session - January 2026

---

## Priority 1: Critical Bugs & Friction

### 1.1 Contact Import - Name Parsing Failure
**Problem:** When pasting a spreadsheet with single "name" column (not separate first/last), import stops with schema validation errors.

**Current State:**
- Mastra tools have sophisticated name parsing in `import-people-from-table.ts`
- Has `looksLikeFullName()` and auto-splitting logic
- `validateAndFixNames()` handles edge cases (full names in firstname, identical values)
- Auto-detection includes "name", "fullname", "contactname" patterns
- BAML LLM analyzes columns with smart fallback

**Investigation Result:**
The code is robust and should handle single "name" columns. The schema validation errors are likely from:
1. BAML LLM returning malformed JSON (edge case)
2. Network/timeout errors during LLM call
3. Specific data patterns not covered

**Proposed Fix:**
- [ ] Add better error logging/user feedback when LLM analysis fails
- [ ] Add try/catch around BAML call with explicit user-facing error message
- [ ] Add inline contact import to survey creation flow (Phase 2 feature)

**Files:** `app/mastra/tools/parse-spreadsheet.ts`, `app/mastra/tools/import-people-from-table.ts`

---

### 1.2 Redundant Create/New Survey Buttons
**Problem:** User sees both "Create" and "New survey" buttons - confusing.

**Current State:**
- "New survey" button in header of survey index
- "Create survey" in empty state when no surveys exist
- Same destination, different labels

**Proposed Fix:**
- [ ] Remove duplicate "Create survey" button in empty state - keep only the "New survey" button
- [ ] Update empty state to use consistent "New survey" label
- [ ] Consider: Single "New Survey" button that's always visible

**Files:** `app/features/research-links/pages/index.tsx` (lines 211-225)

---

### 1.3 Link Shown Too Early
**Problem:** Survey link/URL shown before survey is complete - not needed until end.

**Current State:**
- Link shown in Step 1 of creation wizard (immediately after name entry)
- Persists through all steps
- User can't customize slug until AFTER creation

**Proposed Fix:**
- [ ] Remove link display from Steps 1-2 of creation wizard
- [ ] Show link ONLY in Step 3 (Review & Create) and after creation
- [ ] Add slug customization option in Step 3 before final create

**Files:** `app/features/research-links/pages/create.tsx` (lines 158-160, 315-322)

---

### 1.4 Remove "Specific Details or Context" Field
**Problem:** Extra field that's redundant with hero subtitle.

**Current State:**
- `description` field in create.tsx gets saved to `hero_subtitle`
- Edit page shows BOTH description AND hero_subtitle separately
- Instructions field is separate (shown between landing and questions)

**Proposed Fix:**
- [ ] Remove duplicate "description" field from creation flow
- [ ] Keep only `hero_subtitle` (what respondents see on landing)
- [ ] Keep `instructions` separate (detailed guidance before questions)
- [ ] Consolidate in edit page to avoid confusion

**Files:** `app/features/research-links/pages/create.tsx`, `app/features/research-links/pages/edit.$listId.tsx`

---

## Priority 2: Intelligence & Context

### 2.1 Prepopulate Questions from Insights
**Problem:** If project has existing insights/questions, they should seed the survey.

**Current State:**
- "Import from Interview Prompts" button exists but only imports `interview_prompts`
- No connection to insights, themes, or research questions
- AI generation is generic (not context-aware)

**Proposed Fix:**
- [ ] Query existing `insights` and `questions` tables for current project
- [ ] Add "Suggested from your research" section in question editor
- [ ] Modify `generate-questions.tsx` to include project context (insights, themes)
- [ ] Show pre-filled suggestions that user can accept/reject

**Files:**
- `app/features/research-links/pages/create.tsx`
- `app/features/research-links/api/generate-questions.tsx`

---

### 2.2 Chat Not Updating Company Info
**Problem:** After research chat, company/context information not persisting.

**Investigation Needed:**
- [ ] Trace chat flow to see where company info should be saved
- [ ] Check if `accounts` table is being updated after research conversations
- [ ] Verify Uppy/assistant has write access to account metadata

**Files:** Chat endpoints, account update handlers

---

### 2.3 Context-Aware Survey Suggestions
**Problem:** "Suggest a survey" is too generic - should be strategic based on:
- User stage (new users vs going deeper)
- Audience segment (educator vs partner)
- Existing insights

**Proposed Fix:**
- [ ] Add project context to question generation prompt:
  - Current research stage
  - Target audience/persona
  - Key themes/insights discovered so far
  - Gaps in knowledge
- [ ] Create survey templates:
  - "New Customer Discovery"
  - "Deep Dive: [Theme]"
  - "Pricing Validation"
  - "NPS + Qualitative"

**Files:** `app/features/research-links/api/generate-questions.tsx`

---

### 2.4 Import Button Visibility
**Problem:** "Import" option only shows when existing prompts exist - should always be available.

**Current State:**
- Import button shows count: "Import (5)" when prompts exist
- Hidden when no prompts

**Proposed Fix:**
- [ ] Always show import button
- [ ] When no prompts: Show as "Import from Project" with explanation
- [ ] Connect to insights/questions, not just interview prompts

**Files:** `app/features/research-links/pages/create.tsx`

---

## Priority 3: Advanced Features (Future)

### 3.1 Conditional Logic / Audience Segments
**Problem:** Can't tailor questions based on respondent type (educator vs partner).

**Proposed Solution:**
- Add `segment` field to questions
- Add branching logic: "If [answer], show [questions]"
- UI for setting up conditions in question editor

**Complexity:** High - requires schema changes, new UI, response handling changes

---

### 3.2 Progress/Completion Tracker
**Problem:** User wants to see what's been answered (like pi.ai, rosebud).

**Proposed Solution:**
- Add progress indicator to survey creation flow
- Show which sections are complete
- Non-overwhelming visual (dots/steps, not percentage)

**Inspiration:** pi.ai, rosebud.app onboarding

---

### 3.3 Stage-Aware Suggestions
**Problem:** System should know user's stage and suggest next actions.

**Proposed Solution:**
- Track project maturity (discovery, validation, deep-dive)
- Suggest: "Based on your 5 interviews, you might want to..."
- Recommend survey vs more interviews vs experiment

**Complexity:** High - requires project health/stage tracking

---

### 3.4 Insight Acceptance Tracking
**Problem:** How does system know user "accepts" insights?

**Proposed Solution:**
- Add explicit accept/reject actions to insights
- Track which insights inform decisions
- Use accepted insights to guide future suggestions

---

## Implementation Phases

### Phase 1: Quick Wins (1-2 days)
- [ ] Fix redundant Create/New Survey buttons
- [ ] Remove early link display (show only at end)
- [ ] Remove redundant description field
- [ ] Always show import button

### Phase 2: Contact Import Fix (2-3 days)
- [ ] Debug name parsing schema errors
- [ ] Test single "name" column handling
- [ ] Add inline contact import to survey creation

### Phase 3: Context-Aware Intelligence (1 week)
- [ ] Prepopulate from existing insights/questions
- [ ] Add project context to question generation
- [ ] Create survey templates
- [ ] Trace and fix company info persistence

### Phase 4: Future Features (TBD)
- Conditional logic
- Progress tracker
- Stage-aware suggestions
- Insight acceptance tracking

---

## Open Questions

1. **Where is "Uppy"?** - No "Uppy" in codebase. Is this the chat assistant in `research.$slug.tsx`?
2. **What's the priority for conditional logic?** - Major feature, needs scoping
3. **How to handle insight acceptance?** - Needs product decision on UX

---

## Related Files

| Feature | Primary Files |
|---------|---------------|
| Survey Creation | `app/features/research-links/pages/create.tsx` |
| Survey Edit | `app/features/research-links/pages/edit.$listId.tsx` |
| Question Generation | `app/features/research-links/api/generate-questions.tsx` |
| Contact Import | `app/mastra/tools/import-people-from-table.ts` |
| Public Survey | `app/routes/research.$slug.tsx` |
| Chat Integration | `app/routes/api.research-links.$slug.chat.tsx` |
