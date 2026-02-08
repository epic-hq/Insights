# Survey Feature Maturity Assessment

**Date:** 2026-02-07 | **Bead:** Insights-crp (demo prep) | **Epic:** Insights-4ud

---

## Overall Maturity: 🟡 ~65% — Demo-able with caveats

The survey feature ("Ask Links" / "Research Links") has a surprisingly deep foundation. The core flows work. But there's a critical gap between what the AI *generates* and what actually gets *applied* to the survey — specifically around NL branching. The question editor UX is functional but dense.

---

## Feature-by-Feature Breakdown

### ✅ Survey Creation (Voice-First) — 90% | Demo-Ready

| Aspect | Status | Notes |
|--------|--------|-------|
| Voice-to-survey generation | ✅ Working | `generate-from-voice.tsx` — Claude generates name, description, questions, and guidelines |
| Text-based creation | ✅ Working | 3-step wizard: Name → Questions → Review |
| AI question generation | ✅ Working | `generate-questions.tsx` — generates 3-5 questions from name/description |
| "Edit with AI" prompt | ✅ Working | Popover to refine/add questions with custom instructions |
| Auto-generate on step 2 | ✅ Working | If user enters name and moves to step 2, questions auto-generate |
| Smart suggestions | ✅ Working | `recommendation-rules.ts` — suggests surveys based on project state |

**Demo risk:** Low. This is the wow moment. Voice → survey in 10 seconds works.

---

### 🔴 NL Branching / Skip Logic — 40% | **BROKEN GAP**

This is the gap you suspected. The pieces exist but **aren't connected end-to-end**.

| Aspect | Status | Notes |
|--------|--------|-------|
| Branching engine (`branching.ts`) | ✅ Complete | Full AND/OR evaluation, 8 operators, `getNextQuestionId()` |
| Manual skip logic UI (`QuestionBranchingEditor.tsx`) | ✅ Working | "If answer equals X → skip to Y / end survey" |
| Form-mode branching execution | ✅ Working | `research.$slug.tsx` calls `getNextQuestionIndex()` |
| Chat-mode branching awareness | ✅ Working | `api.research-links.$slug.chat.tsx` calls `computeReachablePath()` |
| AI generates guidelines from voice | ✅ Working | `generate-from-voice.tsx` returns `guidelines[]` with confidence levels |
| **Guidelines → BranchRules conversion** | 🔴 **NOT DONE** | Guidelines are returned to frontend but **never applied to questions** |
| Clarification UI for low-confidence rules | 🟡 Partial | Banner renders, "Looks good" dismisses, but "I'll adjust" is a `// TODO` |
| NL guideline editing in builder | 🔴 Not started | No way to type "if sponsor, skip to budget questions" in the editor |

**The critical bug:** In `create.tsx` lines 258-282, when voice generates a survey:
- `data.questions` are set → ✅
- `data.guidelines` are returned → ✅
- But **guidelines are never mapped onto question.branching** → 🔴

The `generate-from-voice.tsx` API returns guidelines with `triggerQuestionId` and `targetQuestionId` mapped to the generated questions, but `create.tsx` only does `setQuestions(data.questions)` — it never iterates the guidelines and attaches them as `branching` rules on the corresponding questions.

**Fix effort:** ~2-4 hours. Need to:
1. In `create.tsx`, after setting questions, iterate guidelines and attach as `branching.rules` on the trigger question
2. Wire up the "I'll adjust" button to open the QuestionBranchingEditor
3. (Optional) Add NL guideline input to the edit page

---

### 🟡 Question Editor UX — 60% | Functional but Dense

| Aspect | Status | Notes |
|--------|--------|-------|
| Question CRUD | ✅ Working | Add, remove, reorder (up/down arrows) |
| Question types | ✅ 7 types | auto, short_text, long_text, single_select, multi_select, likert, image_select |
| Options input (comma-separated) | ✅ Working | `OptionsInput` component with blur-to-parse |
| Image options with upload | ✅ Working | Thumbnail upload to R2, inline preview |
| Likert scale config | ✅ Working | Scale 3-10, custom low/high labels |
| Helper text per question | ✅ Working | Optional hint shown below question |
| Video prompt per question | ✅ Working | Record, upload, or URL per question |
| Required toggle | ✅ Working | Per-question required flag |
| Skip logic per question | ✅ Working | `QuestionBranchingEditor` inline |
| Drag-and-drop reorder | 🔴 Not done | `GripVertical` icon renders but no DnD handler |
| Inline preview | 🟡 Partial | `ResearchLinkPreview` component exists but not shown in editor |
| Bulk question import | ✅ Working | Paste multiple lines → parse into questions |

**UX issues for demo:**
- Each question card shows **everything at once** — type selector, required toggle, helper text, video, skip logic. It's visually overwhelming for a demo.
- No collapse/expand per question — all fields always visible
- The skip logic section is hidden behind a "Skip Logic" toggle, which is good, but the rest isn't
- No drag-and-drop despite the grip icon being present

**Recommendation:** For the demo, use the **create** wizard (clean, focused) not the **edit** page (dense). The create flow is much more polished.

---

### ✅ Respondent Experience — 85% | Demo-Ready

| Aspect | Status | Notes |
|--------|--------|-------|
| Form mode | ✅ Polished | One question at a time, progress dots, back/next, branching |
| Chat mode | ✅ Working | AI conversational interview via Mastra agent |
| Voice input in chat | ✅ Working | `useSpeechToText` hook, mic button in chat |
| Voice input in form | ✅ Working | Voice button per question |
| Video response | ✅ Working | `VideoRecorder` component, R2 upload, 2-min max |
| Mode switching | ✅ Working | Form ↔ Chat ↔ Voice tabs during survey |
| Anonymous mode | ✅ Working | No email required, auto-start |
| Email identification | ✅ Working | Email → person lookup → resume session |
| Phone identification | ✅ Working | Phone-based identification flow |
| Session persistence | ✅ Working | localStorage + DB resume |
| Redirect after completion | ✅ Working | Configurable redirect URL with countdown |
| Calendar booking CTA | ✅ Working | Post-completion calendar link |
| Share/copy link | ✅ Working | Copy link button on completion |
| Embed support | ✅ Working | `EmbedCodeGenerator` component |
| QR code | ✅ Working | `QRCodeButton` / `QRCodeModal` components |
| Walkthrough video | ✅ Working | Pre-survey video with R2 signed URLs |
| Review answers | ✅ Working | Post-completion review mode |

**Demo risk:** Low. The respondent experience is the strongest part.

---

### 🟡 AI Chat Agent — 70% | Works but PRD Phase 2-3 incomplete

| Aspect | Status | Notes |
|--------|--------|-------|
| Strict mode (follows script) | ✅ Working | Default. Asks questions in order. |
| Branching-aware chat | ✅ Working | `computeReachablePath()` respects skip logic |
| `ai_autonomy` column | ✅ Exists | DB column present, passed to agent |
| Moderate mode | 🟡 Partial | Person context fetched but agent instructions unclear |
| Adaptive mode (CRM context) | 🟡 Partial | Person context + project context fetched, but no semantic search tools |
| Autonomy selector UI in builder | 🔴 Not done | PRD Phase 2 — no UI to select strict/moderate/adaptive |
| Research goals field | 🔴 Not done | PRD Phase 3 — no `research_goals` JSONB column or UI |
| Segment detection tool | 🔴 Not done | PRD Phase 4 |
| Branch path analytics | 🔴 Not done | PRD Phase 4 |

---

### ✅ Response Analysis — 75% | Working

| Aspect | Status | Notes |
|--------|--------|-------|
| Response data table | ✅ Working | `ResearchLinkResponsesDataTable.tsx` |
| AI analysis (BAML) | ✅ Working | `analyze-responses.tsx` — quick/detailed modes |
| Evidence extraction | ✅ Working | Text responses → evidence records for theme clustering |
| Person linking | ✅ Working | Auto-creates person record from email |
| Bulk delete | ✅ Working | `delete-responses-bulk.tsx` |
| Response detail view | ✅ Working | `response-detail.$responseId.tsx` |

---

### ✅ Distribution & Sharing — 90% | Demo-Ready

| Aspect | Status | Notes |
|--------|--------|-------|
| Shareable link (`/research/:slug`) | ✅ Working | Public route, no auth required |
| Embed code generator | ✅ Working | Copy-paste embed snippet |
| QR code | ✅ Working | Generate + download QR |
| Live/draft toggle | ✅ Working | `is_live` flag |
| Custom landing page | ✅ Working | Hero title, subtitle, CTA, instructions |

---

## Beads Status

| Bead | Title | Status | Priority |
|------|-------|--------|----------|
| Insights-4ud | Surveys & Video Outreach (Epic) | Open | P2 |
| Insights-bvm | Implement EditSurvey gen-ui widget | Open | P1 |
| Insights-4ud.1 | Dynamic audience selection for survey distribution | Open | P2 |
| Insights-4dl | Support voice/video responses in surveys | Open | P2 |
| Insights-v1p | Survey should handle anonymous submissions | Closed | P1 |
| Insights-ht2 | Simplify AI-generated survey questions | Closed | P1 |

---

## Demo-Readiness Gap Analysis

### Must-Fix for Demo (blocks filming)

1. **🔴 Guidelines → BranchRules wiring** — Voice-generated skip logic never gets applied to questions. The demo script shows skip logic as a wow moment, but it won't appear after voice creation.
   - **Fix:** ~2-4 hours. Wire `guidelines[]` → `question.branching.rules[]` in `create.tsx`
   - **Bead:** Create new

2. **🟡 QA the voice-to-survey flow end-to-end** — Test with the Startup SD prompt to make sure questions generate well and the survey is immediately usable.
   - **Fix:** ~30 min manual QA

### Should-Fix for Demo (makes it look better)

3. **Question editor density** — For the demo, use the create wizard, not the edit page. But if you need to show editing, the card layout is visually busy.
   - **Fix:** Could collapse helper text / video / skip logic behind a "More options" toggle. ~2-3 hours.

4. **Drag-and-drop reorder** — Grip icon exists but doesn't work. Minor visual lie.
   - **Fix:** Add `@dnd-kit` or similar. ~2-3 hours. Or remove the grip icon for now (~5 min).

### Nice-to-Have (post-demo)

5. **Autonomy selector UI** — No way to switch between strict/moderate/adaptive in the builder
6. **NL guideline input in editor** — Can't type "if sponsor, skip to budget" in the edit page
7. **Research goals field** — Would make adaptive chat much smarter

---

## Recommendation

**For the demo recording:**
- Use the **create wizard** (voice-first flow) — it's polished and impressive
- Fix the **guidelines → branching wiring** before filming — it's the only blocker
- Show the **respondent experience** in form mode with branching — it works great
- Show **chat mode** briefly — it works in strict mode
- Show **video response** — it's a differentiator
- Skip showing the **edit page** question editor — it's functional but not demo-pretty
- The **AI themes / analysis** view needs to be shown from the responses page, not the builder

**Estimated fix time for demo-ready:** ~3-5 hours total
