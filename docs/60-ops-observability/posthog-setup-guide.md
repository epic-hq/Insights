# PostHog Setup Guide - Step by Step

This guide assumes you have PostHog access and events are already firing. Just follow the steps.

## 1. Verify Events Are Working (2 minutes)

1. Go to PostHog → **Activity** tab
2. You should see events like `account_signed_up`, `project_created`, `interview_added`
3. Click any event to see its properties
4. ✅ If you see events, you're good to go

## 2. Create Your First Funnel (5 minutes)

**Purpose:** See how many people complete signup → create project → add interview

1. Go to **Insights** → Click **+ New Insight**
2. Select **Funnel**
3. Add steps:
   - Step 1: Select event `account_signed_up`
   - Step 2: Select event `project_created`
   - Step 3: Select event `interview_added`
4. Name it "Activation Funnel"
5. Click **Save**

**What you'll see:** Conversion rates between each step (e.g., "80% of signups create a project, 50% add an interview")

## 3. Create Retention Analysis (3 minutes)

**Purpose:** See how many users come back

1. Go to **Insights** → Click **+ New Insight**
2. Select **Retention**
3. Configure:
   - **Cohorted by:** `account_signed_up`
   - **Returned to do:** `Any event` or specific event like `interview_detail_viewed`
   - **Interval:** Daily or Weekly
4. Name it "User Retention"
5. Click **Save**

**What you'll see:** Grid showing what % of users return on Day 1, Day 7, Day 30, etc.

## 4. Create Key Metrics Dashboard (10 minutes)

1. Go to **Dashboards** → Click **+ New Dashboard**
2. Name it "PLG Metrics"
3. Click **Add Insight** for each metric below:

### Metric 1: Signups Over Time
- Type: **Trends**
- Event: `account_signed_up`
- Graph type: **Line chart**
- Breakdown by: `signup_source` (optional - to see OAuth vs email)

### Metric 2: Projects Created
- Type: **Trends**
- Event: `project_created`
- Filter: `is_first_project = true` (shows new projects, not all)

### Metric 3: Interviews Added
- Type: **Trends**
- Event: `interview_added`
- Breakdown by: `source` (see upload vs record vs paste)

### Metric 4: Active Users (DAU/WAU)
- Type: **Trends**
- Select **Unique users** instead of event
- Filter by: `Any event`
- Interval: **Daily** (for DAU) or **Weekly** (for WAU)

### Metric 5: Task Completion Rate
- Type: **Trends**
- Event: `task_completed`
- Formula (optional): Show alongside `task_created` to see completion %

4. Arrange tiles, click **Save**

## 5. Set Up Cohorts (5 minutes)

**Purpose:** Group users by behavior to analyze segments

### Create "Active Users" Cohort
1. Go to **People** → **Cohorts** → **+ New Cohort**
2. Name: "Active Users"
3. Criteria:
   - **Performed event:** `Any event`
   - **In the last:** 7 days
4. Click **Save**

### Create "Activated Users" Cohort
1. Name: "Activated Users"
2. Criteria:
   - **Performed event:** `interview_added`
   - **At least once:** All time
3. Click **Save**

### Create "Paying Customers" Cohort
1. Name: "Paying Customers"
2. Criteria:
   - **Performed event:** `checkout_completed`
   - **At least once:** All time
3. Click **Save**

**Usage:** Now you can filter any insight by these cohorts

## 6. Create Billing Funnel (5 minutes)

1. Go to **Insights** → **+ New Insight** → **Funnel**
2. Add steps:
   - Step 1: `billing_page_viewed`
   - Step 2: `checkout_started`
   - Step 3: `checkout_completed`
3. Name it "Billing Conversion"
4. Click **Save**

**What you'll see:** How many people view billing → start checkout → complete purchase

## 7. Set Up Alerts (5 minutes)

1. Go to **Insights** → Open your "Signups Over Time" insight
2. Click **Subscriptions** tab
3. Click **+ New subscription**
4. Configure:
   - **Type:** Slack or Email
   - **When:** Value decreases by 20% week-over-week
   - **Channel/Email:** Your notification destination
5. Click **Save**

Repeat for other critical metrics (activation rate drops, checkout completion drops, etc.)

## 8. Group Analytics - View Account-Level Data (2 minutes)

1. Go to **People** → **Groups** tab
2. You should see accounts listed (since we track `$groups.account`)
3. Click any account to see:
   - All events from users in that account
   - Group properties (plan, seats)
   - Activity timeline

**Usage:** See which companies/accounts are most active

---

## Quick Reference: Most Useful Views

| View | Where to Find | What It Shows |
|------|---------------|---------------|
| **Live Events** | Activity tab | Real-time event stream |
| **User Lookup** | People → Search by email | Specific user's journey |
| **Account View** | People → Groups → account | Company-level activity |
| **Funnel Analysis** | Insights → Funnels | Conversion between steps |
| **Retention** | Insights → Retention | User comeback rate |
| **Trends** | Insights → Trends | Event volume over time |

---

## Common Questions

**Q: Why don't I see any data?**
- Check Activity tab - if events are there, dashboards just need time to populate
- If no events, check server logs for PostHog errors

**Q: Can I see individual user journeys?**
- Yes! Go to People → Search for user by email → View their session recordings and event timeline

**Q: How do I export data?**
- Any insight has an "Export" button (CSV or image)
- For bulk exports, use PostHog API or data warehouse integrations

**Q: How do I track a specific user?**
- Go to People → Find user → Click "Pin" to add to dashboard sidebar

---

## Next Steps

Once you're comfortable with the basics:

1. **Create Lifecycle Cohorts:**
   - New (signed up < 7 days ago)
   - Active (used in last 7 days)
   - Dormant (no activity in 30 days)
   - Churned (no activity in 90 days)

2. **Set Up Conversion Goals:**
   - Time to first project (goal: < 5 minutes)
   - Time to first interview (goal: < 10 minutes)
   - Activation rate (goal: > 60%)

3. **Weekly Review Routine:**
   - Check signup trends (growing or declining?)
   - Review activation funnel (where do people drop off?)
   - Monitor retention (are users coming back?)
   - Track revenue events (checkout completion rate)

---

**Need Help?**
- PostHog Docs: https://posthog.com/docs
- Our event catalog: `/docs/60-ops-observability/posthog-events-implemented.md`
