# Evidence & Insight Validation UI - Feature Requirements

**Bead:** Insights-3im
**Priority:** P2 (After recommendation engine)
**Related to:** Research Follow-ups & Contact Intelligence tech spec

## Problem Statement

AI-extracted evidence and insights need human validation. Users must be able to review, correct, and enhance AI extractions to feel confident in data quality and maintain control over research findings.

**User Quote:** "We need to provide override ability for the user to question the results and assignment of evidence and override it. This goes to the importance of the user feeling confident and in control."

---

## Core Features

### 1. Manual Evidence Creation
**What:** User highlights transcript text → creates evidence → assigns to theme/insight

**User Flow:**
1. User is reading interview transcript
2. Highlights important quote AI missed: "We'd pay up to $800/mo for this"
3. Right-click → "Create evidence from selection"
4. Modal appears:
   - Quote: [pre-filled from selection]
   - Coding: [Pricing / Budget / Willingness to Pay]
   - Confidence: [slider 0-100%]
   - Assign to: [dropdown: existing themes or "Create new theme"]
5. Clicks [Create] → evidence appears in theme with "Manually added" badge

**Current Gap:** No UI to manually create evidence. Evidence only comes from AI extraction.

---

### 2. Evidence Editing
**What:** Modify existing evidence - quote boundaries, coding, confidence, assignments

**User Flow:**
1. User views evidence card in theme detail
2. Sees AI extracted: "We'd pay up to $800/mo for this" coded as "Pricing" (confidence: 75%)
3. Clicks [Edit] icon
4. Can modify:
   - Quote text (adjust boundaries if AI cut off context)
   - Coding tags (change from "Pricing" to "Budget Authority")
   - Confidence score (override AI's 75% → 90%)
   - Timestamp (if AI misaligned)
5. Clicks [Save] → evidence updates, lens marked stale for recomputation

**Current Gap:** Evidence is read-only. Users can't fix AI mistakes.

---

### 3. Evidence Reassignment
**What:** Move evidence from one theme/insight to another

**User Flow:**
1. User views "Pricing" theme with 8 evidence pieces
2. Sees one piece is actually about "Integration complexity" (AI misclassified)
3. **Option A (Drag & Drop):** Drags evidence card → drops on "Integration complexity" theme
4. **Option B (Dropdown):** Clicks evidence [•••] menu → "Move to theme" → selects "Integration complexity"
5. Evidence moves, both themes' confidence scores recalculate

**Current Gap:** No way to reassign evidence. Users stuck with AI's classification.

---

### 4. Manual Theme Creation
**What:** Create new theme/insight when AI missed an important pattern

**User Flow:**
1. User notices 4 mentions of "Security concerns" across interviews but no theme exists
2. Clicks [+ New theme] button
3. Modal:
   - Theme name: "Security concerns"
   - Description: "Customers mention data security and compliance requirements"
   - Category: [Pain / Need / Feature Request / etc.]
4. Clicks [Create] → theme created
5. User can now assign evidence to this theme (via drag-drop or manual linking)

**Current Gap:** Themes only come from AI. Users can't create custom themes.

---

### 5. Theme Editing & Merging
**What:** Rename themes, merge duplicates, adjust confidence formulas

**User Flows:**

**A. Rename Theme:**
1. User sees AI created theme "Cost" but prefers "Pricing"
2. Clicks theme [Edit] → changes name to "Pricing" → [Save]
3. All linked evidence updates automatically

**B. Merge Duplicate Themes:**
1. User sees AI created both "Integration complexity" and "Integration challenges"
2. Clicks [Merge themes] → selects both → chooses primary name
3. All evidence from both themes combines into one
4. Confidence recalculates based on merged evidence set

**C. Override Confidence Formula:**
1. User sees theme confidence is LOW (55%) despite 8 mentions
2. Believes evidence quality is high → manually overrides confidence to 85%
3. System shows "Manually validated ✅" badge
4. Recommendation engine respects manual override

**Current Gap:** Themes are immutable. Users can't fix AI naming or consolidate duplicates.

---

### 6. Validation Status Marking
**What:** Mark themes/insights as "Validated" or "Needs more data"

**User Flow:**
1. User reviews "Pricing" theme (8 mentions, HIGH confidence)
2. Agrees this is accurate and complete
3. Clicks [Mark as validated ✅]
4. Badge appears: "Validated by Rick on Feb 7"
5. Recommendation engine stops suggesting "validate pricing theme"

**Alternative:**
1. User reviews "Security concerns" theme (3 mentions, MEDIUM confidence)
2. Thinks this needs more investigation
3. Clicks [Mark as needs validation 🟡]
4. Recommendation engine prioritizes "Interview more people about security"

**Current Gap:** No way to signal validation status. AI doesn't know what's been human-verified.

---

## UI Design Patterns

### Evidence Card (Inline Editing)
```
┌─────────────────────────────────────────────────────────┐
│ 💬 "We'd pay up to $800/mo for this"                    │
│                                                          │
│ Interview #12 · Sarah Chen · 00:14:32                   │
│ 🏷️ Pricing · Budget Authority · Willingness to Pay      │
│ 🎯 Confidence: 75%  [Manually added ✨]                 │
│                                                          │
│ [✏️ Edit] [🔗 Reassign] [🗑️ Remove]                      │
└─────────────────────────────────────────────────────────┘
```

### Theme Management Panel
```
┌─────────────────────────────────────────────────────────┐
│ Integration complexity               [✏️] [🔗] [•••]     │
├─────────────────────────────────────────────────────────┤
│ 8 mentions · 🟢 HIGH confidence (87%)                   │
│ Validated by Rick on Feb 7 ✅                            │
│                                                          │
│ Evidence (8):                                            │
│ [Drag evidence here to add ↓]                           │
│                                                          │
│ 💬 "API integration took 3 months..." (Interview #12)   │
│ 💬 "Documentation was confusing..." (Interview #18)     │
│ ...                                                      │
│                                                          │
│ [+ Add evidence manually] [Merge with another theme]    │
└─────────────────────────────────────────────────────────┘
```

### Create Evidence Modal
```
┌─────────────────────────────────────────────────────────┐
│ ✨ Create Evidence                                [✕]   │
├─────────────────────────────────────────────────────────┤
│ Quote:                                                   │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ "We'd pay up to $800/mo for this if it solved..."  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ From: Interview #12 · Sarah Chen                        │
│ Timestamp: 00:14:32 [Adjust ↔️]                          │
│                                                          │
│ Coding (add tags):                                       │
│ [Pricing] [Budget Authority] [+ Add tag]                │
│                                                          │
│ Confidence: ⚫️─────────○─── 85%                         │
│                                                          │
│ Assign to theme:                                         │
│ [Dropdown: Pricing ▾]                                    │
│ └─ Or [+ Create new theme]                              │
│                                                          │
│ [Cancel] [Create Evidence]                              │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Implementation Notes

### Database Changes
- Add `manually_created` boolean to `evidence` table
- Add `validation_status` enum to `themes` table: `pending`, `validated`, `needs_validation`
- Add `confidence_override` numeric to `themes` table (null = use computed)
- Add `validated_by` uuid, `validated_at` timestamptz to `themes` table

### API Routes
- `POST /api/evidence` - Create manual evidence
- `PATCH /api/evidence/:id` - Edit evidence
- `POST /api/evidence/:id/reassign` - Move evidence to different theme
- `POST /api/themes` - Create manual theme
- `PATCH /api/themes/:id` - Edit theme (name, confidence override, validation status)
- `POST /api/themes/merge` - Merge multiple themes

### Lens Recomputation
- When evidence/theme edited → mark affected lens as `stale`
- Trigger.dev task: recompute stale lenses (respects manual overrides)
- Manual confidence overrides take precedence over computed values

---

## Acceptance Criteria

- [ ] AC1: Given user selects transcript text, when right-clicking, then "Create evidence" option appears
- [ ] AC2: Given user creates manual evidence, when saved, then evidence appears with "Manually added" badge
- [ ] AC3: Given user edits evidence quote, when saving, then affected theme confidence recalculates
- [ ] AC4: Given user drags evidence to different theme, when dropped, then evidence reassigns and both themes update
- [ ] AC5: Given user creates new theme, when saved, then theme appears in themes list with 0 evidence
- [ ] AC6: Given user merges duplicate themes, when confirmed, then evidence combines and one theme remains
- [ ] AC7: Given user marks theme as validated, when saved, then "Validated ✅" badge appears and recommendation engine stops suggesting validation
- [ ] AC8: Given user overrides theme confidence, when saved, then manual confidence displays instead of computed value

---

## Open Questions

1. **Permissions:** Who can edit evidence/themes? Account admins only or all project members?
2. **Audit trail:** Should we track edit history for evidence changes?
3. **Conflict resolution:** What if AI re-runs and contradicts manual edits? Show diff UI?
4. **Bulk operations:** Allow selecting multiple evidence pieces to reassign at once?
5. **Mobile:** Is evidence editing needed on mobile or desktop-only?

---

## Related Work

- **Recommendation Engine** (current work): Will consume validated themes and respect manual confidence overrides
- **Evidence Traceability** (already exists): Validation UI builds on existing evidence linking infrastructure
- **Lens Architecture** (already exists): Manual edits trigger lens recomputation via existing staleness tracking

---

## Priority Justification

**Why P2 (not P0)?**
- Recommendation engine can work with AI-extracted data initially
- Validation becomes critical AFTER users see recommendations and want to refine inputs
- Advanced researchers need this for trust, but MVP can prove value without it

**When to prioritize:**
- After recommendation engine deployed and generating value
- When users report "AI got this wrong" feedback
- Before scaling to advanced/power users who demand precision
