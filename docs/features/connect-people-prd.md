# UpSight Feature PRD: Connect with People

## 1. Overview

**Feature name**
Connect with People (Recruiting & Participation)

**One-liner**
Make it easy—and respectful—for the right customers and contacts to share feedback, across surveys, bots, and live calls, all tied back to projects.

**Related IA**
Nav: **People**
Tied steps: **Connect** in “Prepare → Connect → Collect → Synthesize → Act”.

---

## 2. Problem

Today:

- Recruiting participants happens in email, DMs, random Calendly links.
- No single view of:
  - Who we invited.
  - How they engaged (survey vs call).
  - What project each interaction supports.
- Asking for time often feels spammy or one-sided.

We need:

- A simple, humane system to:
  - Manage people + orgs.
  - Invite them to share feedback via multiple modes.
  - Track participation per project.

---

## 3. Goals & Non-goals

**Goals**

1. Capture a structured list of people and organizations across projects.
2. Let users invite participants with 2–3 pre-configured engagement options.
3. Track invite → response → completion across modes.
4. Tie all resulting evidence back to:
   - Person
   - Org
   - Project

**Non-goals (v1)**

- Full CRM replacement.
- Advanced nurture campaigns or sequences.
- Complex panel management (payment orchestration, tax, etc.).
- Multi-tenant marketplace of external panelists.

---

## 4. Users & Use Cases

**Primary users**

- Founders / PMs running discovery.
- Sales / CS leads running customer interviews or QBR prep.
- RevOps / Research leads coordinating studies.

**Key use cases**

1. “I want to recruit 10 customers for a churn deep-dive project.”
2. “I want to give our beta users a quick way to give feedback.”
3. “I want one email template that lets people choose survey, bot, or call.”
4. “I want to see which contacts we’ve already spoken with about a topic.”

---

## 5. User Stories

**People & orgs**

- As a PM, I can **import a set of contacts** from CSV or CRM into UpSight.
- As a founder, I can **manually add a key customer** with minimal fields.
- As a CS lead, I can **see all people linked to a given account/org**.

**Recruiting**

- As a PM, I can **open a project and quickly invite people** to contribute.
- As a founder, I can **send an email where customers choose how to engage**:
  - Quick survey
  - Chat with bot
  - Live call
- As a CS lead, I can **copy a ready-made email template** and paste into my email client.

**Tracking**

- As any user, I can **see invite status** for each contact:
  - Not invited / Invited / Responded / Completed.
- As any user, I can **filter People by project participation** (e.g. “who helped on Q1 churn project?”).

**Evidence linkage**

- As any user, I can **see all evidence** (calls, surveys, bot chats) attached to a person.
- As any user, I can **click from a project to see all participants and their contributions**.

---

## 6. UX / UI

### 6.1 People index page

**Nav:** People

**Main components**

- Table or card list:
  - Name
  - Role / Title
  - Company
  - Segments / tags
  - Projects involved
  - Last activity (date + type)
- Filters:
  - By project
  - By org
  - By segment (e.g. “Mid-market”, “Admin users”).
  - By status (Invited / Responded / Not yet invited).

**Empty state**

- Title: “Add the people who know the truth”
- Body:
  > Import from your CRM or add a few key customers manually. These are the people you’ll invite to share their perspective.
- CTAs:
  - “Import from CRM / CSV”
  - “Add a person”

---

### 6.2 Person detail page

**Sections**

- Header: name, role, org, key tags.
- Panel: “Projects & participation” – list of projects with:
  - Role: Participant / Champion / Prospect.
  - Mode: Survey / Bot / Call.
  - Status: Invited / Responded / Completed.
- Panel: “Evidence” – list of related calls, notes, surveys, bot chats.

---

### 6.3 Recruit participants flow (from Project)

**Entry points**

- Project detail page → “Participants” tab.
- Project overview → “Invite participants” button.

**Step 1: Select people**

- List of People with checkboxes.
- Filters by segment, org, previous participation.
- Option: “Add new person.”

**Step 2: Choose engagement options**

- Toggle which options to include:
  - [x] 2-minute survey
  - [x] 3–5 minute bot chat
  - [x] 5–10 minute live call
- For each option:
  - Link preview (survey URL, bot URL, calendar link).
  - Time estimate label (displayed in email).

**Step 3: Compose invite**

- Pre-filled subject: “3 quick ways to share your feedback” (editable).
- Pre-filled body (markdown) with placeholders:
  - `{{first_name}}`
  - `{{survey_link}}`
  - `{{bot_link}}`
  - `{{calendar_link}}`
- Buttons:
  - “Copy email to clipboard.”
  - Future: “Send via connected email provider” (non-goal v1).

**Invite body (template)**

> Hi {{first_name}},
>
> I’d really value your perspective on how we’re doing and where we can improve.
> You can choose whatever works best for you:
>
> 1. **2 minutes** – Answer a few quick questions → {{survey_link}}
> 2. **3–5 minutes** – Chat with our virtual assistant → {{bot_link}}
> 3. **5–10 minutes** – Talk with me directly → {{calendar_link}}
>
> We’ll use your feedback to make it easier for teams like yours to turn customer conversations into action.
>
> Thanks so much,
> {{sender_name}}

---

### 6.4 Project → Participants view

On each project:

- Participants tab:

  - Table: Person | Org | Last mode used | Status | Last activity.
  - Chip showing mode: Survey / Bot / Call.
  - Count pills: `Invited (10) • Responded (6) • Completed (4)`.

- CTA: “Invite more participants.”

---

## 7. Functional Requirements

### 7.1 Data model (rough)

**Tables / entities (simplified)**

- `people`
  - `id`
  - `account_id`
  - `name`
  - `email`
  - `role_title`
  - `org_id`
  - `segments` (array)
  - `created_at`, `updated_at`

- `organizations`
  - `id`
  - `account_id`
  - `name`
  - `domain`
  - `segments` (array)
  - `created_at`, `updated_at`

- `project_participants`
  - `id`
  - `project_id`
  - `person_id`
  - `invite_status` (enum: NOT_INVITED, INVITED, RESPONDED, COMPLETED)
  - `invite_channel` (MANUAL_EMAIL, AUTOMATED, OTHER)
  - `last_mode` (SURVEY, BOT, CALL, UNKNOWN)
  - `last_activity_at`
  - `created_at`, `updated_at`

- `invites` (optional v1 or v2)
  - `id`
  - `project_id`
  - `person_id`
  - `mode` (SURVEY, BOT, CALL)
  - `invite_sent_at`
  - `response_at`
  - `status` (PENDING, STARTED, COMPLETED)

Evidence itself ties back via existing `evidence` table referencing `project_id` + `person_id`.

---

## 8. Non-functional Requirements

- RLS: People and orgs scoped per UpSight account/tenant.
- Performance: list views should handle at least 5–10k people without choking (pagination, search).
- Privacy: links and emails must not expose other participants.

---

## 9. Analytics & Success Metrics

**Leading**

- # of people created/imported per account.
- # of projects with at least 1 participant.
- # of invites generated (per mode).

**Core**

- Invite → Response conversion rate.
- # of participants with at least one completed contribution.
- # of projects that reach ≥5 participants.

**Downstream**

- Increase in # of insights tagged with “customer evidence.”
- Increase in # of actions created from projects with participants.

---

## 10. Risks & Open Questions

**Risks**

- Overlap with existing CRMs → must stay “lightweight insight layer,” not full CRM.
- Email sending from UpSight (deliverability, auth) → might defer to copy-paste into user’s email.

**Open questions**

1. Do we integrate with CRMs (HubSpot/Salesforce) in v1 for People import, or start with CSV/manual only?
2. Do we track invite sending inside UpSight in v1, or just assume “invite generated” once user copies template?
3. How do we want to manage incentives (text-only vs real payout integration later)?

---

## 11. v1 Scope Cut

**Include**

- People and Org entities, with simple list and detail.
- Project participants table and UI (per project).
- Invite flow: generate links (assuming other subsystems provide URLs) + email template copy.
- Basic status tracking (manual or inferred from evidence presence).

**Exclude (later)**

- Automated email sending.
- Payment / incentive handling.
- Deep CRM two-way sync.
- Complex segmentation UI.
