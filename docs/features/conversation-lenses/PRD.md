# Conversation Lenses - Product Requirements Document

## Overview

Conversation Lenses is a feature that enables users to apply structured analytical frameworks ("lenses") to interview conversations, extracting specific insights like sales qualification data, customer research findings, product feedback, and more.

## Problem Statement

Users need to quickly extract actionable insights from interview conversations without manually reviewing transcripts. Different use cases (sales calls, user research, product feedback) require different analytical frameworks.

## Target Users

1. **Sales Teams** - Need to qualify leads and track deal progression
2. **Product Managers** - Need to understand user needs, pain points, and feature requests
3. **UX Researchers** - Need to extract behavioral patterns and user journey insights
4. **Customer Success** - Need to identify satisfaction signals and escalation risks

---

## User Flows

### Flow 1: View Analyzed Interview

**Trigger:** User opens an interview that has already been analyzed

**Steps:**
1. User navigates to interview detail page
2. System displays conversation lenses section with tabs for each lens type
3. User clicks a tab (e.g., "Sales BANT", "Customer Discovery", "Product Feedback")
4. System shows the extracted data for that lens
5. User sees:
   - Structured fields with extracted values
   - Confidence scores for each extraction
   - **Clickable evidence timestamps** linking to exact points in recording
   - Recommendations/next steps

**Acceptance Criteria:**
- [ ] All completed lens analyses appear as tabs
- [ ] Each tab shows status icon (complete, processing, failed, pending)
- [ ] Evidence timestamps are clickable and navigate to media playback
- [ ] Timestamp format: MM:SS (e.g., "12:45")
- [ ] Fields display with proper formatting by type (text, array, boolean, numeric, date)

### Flow 2: Edit Lens Field Values

**Trigger:** User wants to correct or supplement AI-extracted data

**Steps:**
1. User views a lens analysis
2. User clicks on any text field value
3. Field becomes editable (inline edit mode)
4. User modifies the value
5. User clicks away or presses Enter
6. System saves the updated value
7. Original AI confidence indicator updates to show "edited"

**Acceptance Criteria:**
- [ ] Text fields are editable via inline edit
- [ ] Changes save immediately on blur
- [ ] Visual feedback shows save in progress
- [ ] Edited fields are distinguishable from AI-extracted values

### Flow 3: Apply Lens to Interview

**Trigger:** User wants to analyze an interview with a specific lens

**Steps:**
1. User opens interview without lens analysis
2. User sees lens selector dropdown
3. User selects a lens template (e.g., "Sales BANT")
4. User clicks "Apply" button
5. System queues lens analysis
6. Tab shows "Processing" status with spinner
7. When complete, tab shows green checkmark and analysis is visible

**Acceptance Criteria:**
- [ ] Dropdown shows all available lens templates grouped by category
- [ ] Already-applied lenses show "Done" badge and are disabled
- [ ] "Apply All" button triggers all unapplied lenses
- [ ] Status updates in real-time (polling or webhooks)

### Flow 4: Navigate to Evidence

**Trigger:** User wants to see/hear the source of an extraction

**Steps:**
1. User sees a field with evidence timestamp badges
2. User clicks on a timestamp badge (e.g., "12:45")
3. System navigates to evidence detail page with `?t=765` parameter
4. Media player starts at that timestamp
5. User can see the transcript context and hear the audio/video

**Acceptance Criteria:**
- [ ] Timestamp badges are styled consistently
- [ ] Clicking opens evidence in same tab or new tab (configurable)
- [ ] Media player auto-seeks to the timestamp
- [ ] Transcript highlights the relevant portion

### Flow 5: View All Lenses for Interview

**Trigger:** User wants to see summary across all applied lenses

**Steps:**
1. User views interview with multiple lenses applied
2. User sees tabs for each lens
3. Tab list shows status icons for quick scan
4. User can quickly switch between lenses
5. Each lens shows its specific extractions

**Acceptance Criteria:**
- [ ] Tabs scroll horizontally if many lenses
- [ ] Active tab is visually distinguished
- [ ] Status icons are consistent (check, spinner, X)

---

## Data Model

### Lens Template
- `template_key`: Unique identifier (e.g., "sales-bant")
- `template_name`: Display name (e.g., "Sales BANT")
- `category`: Category for grouping (e.g., "sales", "research", "product")
- `template_definition`: JSON defining sections, fields, and field types
- `display_order`: Sort order in UI

### Lens Analysis
- `interview_id`: Interview being analyzed
- `template_key`: Which lens template was used
- `analysis_data`: JSON containing extracted sections, fields, entities, recommendations
- `confidence_score`: Overall confidence (0.0-1.0)
- `status`: pending | processing | completed | failed

### Field Types
- `text`: Single text value (editable)
- `text_array`: List of text values
- `numeric`: Number value
- `boolean`: Yes/No value
- `date`: Date value

---

## UI Components

### LensTabs
- Tabbed interface for switching between lens analyses
- Status indicators per tab
- Template name and category badge

### GenericLensView
- Renders any lens based on template definition
- Supports all field types
- Inline editing for text fields
- Evidence timestamp badges

### EvidenceTimestampBadges
- Reusable component for displaying clickable timestamps
- Formats MM:SS
- Links to evidence detail with `?t=` parameter

### LensSelector
- Dropdown for selecting lens to apply
- "Apply" and "Apply All" buttons
- Status badges for processing/complete

---

## Success Metrics

1. **Lens Adoption**: % of interviews with at least one lens applied
2. **Completion Rate**: % of triggered lenses that complete successfully
3. **Edit Rate**: % of lens fields edited by users (indicates AI accuracy)
4. **Evidence Navigation**: Click-through rate on evidence timestamps
5. **Time to Insight**: Time from interview upload to first lens result

---

## Future Enhancements (v2+)

1. **Custom Lenses**: Users create their own lens templates via NLP authoring
2. **Feed/Subscriptions**: Subscribe to lens outputs with hashtag filtering
3. **Slack/Email Alerts**: Notify when high-priority insights are extracted
4. **Person Linking**: Link extracted entities (stakeholders, next steps) to person records
5. **Batch Analysis**: Apply lenses across multiple interviews at once
