# Gmail Integration: Setup & Testing Guide

> **Feature**: Gmail Email Integration for Survey Distribution
> **PRD**: [gmail-email-integration-PRD.md](./gmail-email-integration-PRD.md)
> **Branch**: `claude/gmail-email-integration-fJzb6`

---

## 1. PicaOS Setup (Gmail Platform)

Gmail OAuth is handled by PicaOS AuthKit, same as Google Calendar. You need to enable the **Gmail** platform in your Pica dashboard.

### Steps

1. Log in to [PicaOS Dashboard](https://app.picaos.com)
2. Navigate to **Connections** > **Available Platforms**
3. Find **Gmail** and click **Enable**
   - If Gmail isn't listed, check under Google integrations or contact Pica support
4. Configure the Gmail OAuth scopes. The minimum required scopes are:
   - `https://www.googleapis.com/auth/gmail.send` (send emails on behalf of user)
   - `https://www.googleapis.com/auth/gmail.readonly` (optional, for future features)
5. Verify your Pica API key is set in `.env`:
   ```
   PICA_API_KEY=sk_live_...
   PICA_API_URL=https://api.picaos.com
   ```
6. The AuthKit token endpoint (`/api/authkit/token`) uses `PICA_SECRET_KEY` or falls back to `PICA_API_KEY`. Make sure at least one is set.

### How Pica OAuth Works

```
User clicks "Connect Gmail"
  → PicaConnectButton calls useAuthKit() hook
  → AuthKit requests token from /api/authkit/token (our endpoint)
  → We generate a token using AuthKitToken(PICA_API_KEY)
  → Pica popup opens → user grants Gmail access
  → Pica returns connection record { _id, key, platform, identity }
  → We POST to /api/gmail/save-connection to store in gmail_connections table
  → Connection saved with pica_connection_key for future Passthrough API calls
```

**Important**: Gmail and Google Calendar are **separate platforms** in Pica. Each requires its own OAuth flow. A user connecting Calendar does NOT get Gmail access (and vice versa).

---

## 2. Database Setup

### Apply the Migration

```bash
# If using Supabase CLI against local:
pnpm supabase db push

# Or apply directly:
pnpm supabase migration up
```

The migration (`20260214200000_gmail_connections.sql`) creates:
- `gmail_connections` table — stores OAuth connection per user/account
- `survey_sends` table — tracks individual email invites with status + nudge tracking
- RLS policies for both tables
- Indexes for query performance (survey_id, status, nudge scheduling)

### Verify Tables Exist

```sql
SELECT count(*) FROM information_schema.tables
WHERE table_name IN ('gmail_connections', 'survey_sends');
-- Should return 2
```

---

## 3. Manual Testing

### 3.1 Connect Gmail (Settings Page)

1. Start dev server: `pnpm dev`
2. Navigate to **Settings** (`/a/:accountId/:projectId/settings`)
3. Scroll to **Integrations** section — 2x2 grid with Gmail, Calendar, Outlook (soon), Slack (soon)
4. Click **Connect** on the Gmail card
5. Pica AuthKit popup should open — sign in with a Gmail account
6. After success, the card shows green "Connected" badge + your email

**Verify**:
```sql
SELECT id, email, is_active, created_at FROM gmail_connections;
```

### 3.2 Connect Gmail (Survey Editor Inline)

1. Go to **Surveys** → edit any survey
2. Find the **Email Distribution** card
3. If not connected: shows "You're one step away" CTA with Connect button
4. After connecting: shows your Gmail address + "Send Survey" button

### 3.3 Send Survey Emails

1. On survey edit page (with Gmail connected), click **Send Survey**
2. **Step 1 — Recipients**:
   - Type an email and press Enter (or click +)
   - Try comma-separated: `alice@test.com, bob@test.com`
   - Search/select from CRM contacts
   - Remove recipients via X on badges
3. Click **Next: Preview**
4. **Step 2 — Preview & Send**:
   - Edit subject line if desired
   - Optionally add a custom message
   - Review the email preview
   - Click **Send N Emails**

**Verify**:
- Check your Gmail Sent folder — emails should appear from your account
- Each email contains a personalized survey link: `/ask/{slug}?ref=email&email=<recipient>`
- Check DB records:
  ```sql
  SELECT to_email, status, nudge_enabled, next_nudge_at, gmail_message_id
  FROM survey_sends
  WHERE survey_id = '<your-survey-id>'
  ORDER BY sent_at DESC;
  ```

### 3.4 Distribution Stats (Responses Page)

1. Go to **Surveys** → **View responses** on a survey you've sent emails for
2. Between the stats row and AI Analysis, look for the **Email Distribution** card:
   - 4 stat boxes: Sent / Opened / Completed / Pending Nudge
   - Green completion rate bar
   - Scrollable recipient table with name, status badge, sent date
3. Complete a survey using a recipient's email link → reload → status should be "completed"

### 3.5 Distribution Stats (Survey List)

1. Go to **Surveys** list page
2. Cards with email sends show a mini progress bar + "X/Y completed" below response count

### 3.6 Auto-Nudge (Trigger.dev)

The `survey.nudge-sends` task runs every hour at :30. To test:

1. Deploy/run trigger tasks:
   ```bash
   pnpm trigger dev    # local development
   # or
   pnpm trigger deploy # deploy to Trigger.dev cloud
   ```
2. Fast-forward a send's nudge time:
   ```sql
   UPDATE survey_sends
   SET next_nudge_at = NOW() - INTERVAL '1 minute'
   WHERE status = 'sent' AND nudge_enabled = true
   LIMIT 1;
   ```
3. Wait for the cron to fire (or trigger manually from Trigger.dev dashboard)
4. Check Gmail Sent folder — nudge appears as a **reply in the same thread**
5. Verify DB update:
   ```sql
   SELECT to_email, nudge_count, last_nudged_at, next_nudge_at, nudge_enabled
   FROM survey_sends
   WHERE last_nudged_at IS NOT NULL
   ORDER BY last_nudged_at DESC;
   ```

**Nudge schedule**:
- Nudge 1: Day 3 after initial send
- Nudge 2: Day 7 after initial send (4 days after nudge 1)
- After 2 nudges: `nudge_enabled` set to `false`, stops

### 3.7 Disconnect Gmail

1. Go to **Settings** → Integrations
2. Click **Disconnect** on the Gmail card
3. Card reverts to showing the Connect button
4. Verify:
   ```sql
   SELECT * FROM gmail_connections WHERE is_active = true;
   -- Should be empty for that user/account
   ```

---

## 4. Automated Tests

### Run Tests

```bash
# All Gmail integration tests (22 tests)
pnpm vitest run --config vitest.unit.config.ts \
  app/lib/integrations/__tests__/gmail.server.test.ts \
  src/trigger/survey/__tests__/nudgeSurveySends.test.ts \
  app/routes/__tests__/api.gmail.send-survey.test.ts

# Individual test files
pnpm vitest run --config vitest.unit.config.ts app/lib/integrations/__tests__/gmail.server.test.ts
pnpm vitest run --config vitest.unit.config.ts src/trigger/survey/__tests__/nudgeSurveySends.test.ts
pnpm vitest run --config vitest.unit.config.ts app/routes/__tests__/api.gmail.send-survey.test.ts
```

### Test Coverage

| File | Tests | What's covered |
|------|-------|----------------|
| `gmail.server.test.ts` | 12 | Connection CRUD, stats computation, batch stats, email sending via Pica, base64url encoding, threading headers, survey send creation, mark-completed |
| `nudgeSurveySends.test.ts` | 4 | Cron config, empty queue no-op, nudge send + update, missing connection handling |
| `api.gmail.send-survey.test.ts` | 6 | Auth validation, field validation, no recipients, disconnected Gmail, success counts, partial failure |

---

## 5. Troubleshooting

### "Gmail not connected" error when sending
- User needs to connect Gmail from Settings or the inline prompt on the survey editor
- Check `gmail_connections` table has an active row for this user + account

### Pica AuthKit popup doesn't open
- Verify `PICA_API_KEY` is set in `.env`
- Check browser console for AuthKit errors
- Ensure Gmail platform is enabled in your Pica dashboard

### Emails not appearing in Sent folder
- Check server logs for `[gmail] Email sent` or `[gmail] Failed to send` messages
- Verify the `pica_connection_key` is valid (hasn't been revoked)
- Check Google API quotas (250 emails/day for consumer Gmail, higher for Workspace)

### Nudge task not firing
- Confirm `survey.nudge-sends` is deployed: check Trigger.dev dashboard
- Verify `next_nudge_at` is in the past and `nudge_enabled = true`
- Check Trigger.dev logs for errors

### Migration errors (42710 "already exists")
- Migrations use `DROP POLICY IF EXISTS` before `CREATE POLICY` — re-run should be safe
- If you see other "already exists" errors, check if the migration was partially applied

---

## 6. Architecture Overview

```
Settings / Survey Editor
  └─ PicaConnectButton (Gmail OAuth via AuthKit)
       └─ POST /api/gmail/save-connection → gmail_connections table

Survey Editor
  └─ SendSurveyDialog (recipient picker → preview → send)
       └─ POST /api/gmail/send-survey
            └─ sendGmailEmail() → Pica Passthrough → Gmail API
            └─ createSurveySends() → survey_sends table

Responses Page / List Page
  └─ getSurveySendStats() / getBatchSurveySendStats()
       └─ Reads survey_sends for funnel metrics

Trigger.dev (hourly cron)
  └─ nudgeSurveySendsTask
       └─ Queries survey_sends WHERE next_nudge_at <= NOW()
       └─ sendGmailEmail() with In-Reply-To threading
       └─ Updates nudge_count, schedules next or stops
```

### Key Files

| File | Purpose |
|------|---------|
| `app/lib/integrations/gmail.server.ts` | All DB operations + email sending |
| `app/routes/api.gmail.save-connection.tsx` | Save OAuth connection |
| `app/routes/api.gmail.disconnect.tsx` | Remove connection |
| `app/routes/api.gmail.send-survey.tsx` | Batch send survey emails |
| `app/features/research-links/components/SendSurveyDialog.tsx` | Recipient picker + preview UI |
| `app/components/integrations/PicaConnectButton.tsx` | Reusable OAuth button |
| `src/trigger/survey/nudgeSurveySends.ts` | Auto-nudge scheduled task |
| `supabase/schemas/48_gmail_integration.sql` | Declarative schema |
| `supabase/migrations/20260214200000_gmail_connections.sql` | Migration |
