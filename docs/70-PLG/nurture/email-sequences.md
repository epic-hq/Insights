# PLG Email Nurture Sequences

> **Purpose**: Automated email sequences to activate, convert, and retain users through the PLG funnel
>
> **Email Platform**: Brevo (see [Email Campaigns Setup](../../60-ops-observability/email-campaigns-setup.md))
>
> **Tracking**: PostHog cohorts trigger sequences (see [PLG Instrumentation](../../60-ops-observability/plg-instrumentation-plan.md))

---

## Sequence Overview

| Sequence | Trigger | Goal | Emails | Timing |
|----------|---------|------|--------|--------|
| [Welcome & First Data](#1-welcome--first-data-playbook) | Signup | First meaningful action | 4 | Days 0-5 |
| [Aha Activation](#2-aha-activation-sequence) | Data in, no insight | Publish first insight | 3 | Days 7-14 |
| [Power User Expansion](#3-power-user-expansion) | High engagement | Add team seats | 3 | Days 21-35 |
| [Churn Rescue](#4-churn-rescue-sequence) | Activity drop | Re-engage | 4 | Days 14-28 |
| [Trial Conversion](#5-trial-conversion-sequence) | Trial active | Convert to paid | 4 | Days -7 to 0 |

---

## Design System

### Visual Guidelines

Based on leading PLG SaaS patterns (Brevo, Slack, Loom, Notion):

| Element | Specification |
|---------|---------------|
| **Layout** | Single column, 600px max width |
| **CTA Buttons** | Primary blue (#0066ff), 44px min height, rounded corners |
| **Icons** | Lucide-style line icons, 24px, paired with feature benefits |
| **Images** | Product screenshots with subtle shadows, GIFs for demos |
| **Typography** | System fonts, 16px body, 24px headings |
| **Spacing** | 24px between sections, 40px before CTA |

### Illustration Themes

Each sequence has a visual story arc:

| Sequence | Visual Theme | Illustration Style |
|----------|--------------|-------------------|
| Welcome & First Data | **Journey begins** | Rocket launch, open door, sunrise |
| Aha Activation | **Discovery moment** | Lightbulb, magnifying glass, treasure |
| Power User Expansion | **Team collaboration** | People together, network, growth chart |
| Churn Rescue | **Reconnection** | Bridge, handshake, compass |
| Trial Conversion | **Unlock value** | Key, open lock, graduation cap |

### Recommended Imagery Assets

Create these illustration sets for email headers:

```
/assets/email/
├── welcome/
│   ├── hero-rocket-launch.svg      # Day 0: Blast off
│   ├── hero-survey-builder.gif     # Day 2: Quick survey creation
│   └── hero-upload-insights.gif    # Day 5: Upload → insights demo
├── activation/
│   ├── hero-lightbulb-moment.svg   # Aha discovery
│   ├── hero-insight-checklist.svg  # Checklist with checkmarks
│   └── hero-publish-celebrate.svg  # Celebration/confetti
├── expansion/
│   ├── hero-team-collaboration.svg # People working together
│   ├── hero-growth-metrics.svg     # Charts going up
│   └── hero-invite-team.svg        # Adding team members
├── rescue/
│   ├── hero-compass-direction.svg  # Finding the way
│   ├── hero-meeting-bot.svg        # Calendar/bot integration
│   └── hero-quick-win.svg          # Easy win illustration
└── conversion/
    ├── hero-unlock-features.svg    # Key unlocking
    ├── hero-value-recap.svg        # Value summary
    └── hero-countdown.svg          # Urgency/timer
```

---

## 1. Welcome & First Data Playbook

**Trigger**: `account_signed_up` event
**Goal**: Get user to add their first data (survey or interview upload)
**Cohort**: `lc-new-no-content`

### Sequence Flow

```
Day 0 ─────► Day 2 ─────► Day 4 ─────► Day 5
  │            │            │            │
  ▼            ▼            ▼            ▼
Welcome    Survey CTA   Concierge    Video demo
+ Context   (easiest     data import  upload →
  setup      path)                    insights
```

---

### Email 1.1: Welcome + Context Setup (Day 0, Immediate)

**Subject**: Welcome to UpSight — let's capture your first insight
**Preview**: Set up your research context in 3 minutes

**Hero Image**: `hero-rocket-launch.svg` — Stylized rocket with UpSight logo, launching from laptop

```html
<header-image src="hero-rocket-launch.svg" alt="Your insight journey begins" />

<h1>Welcome aboard, {{ contact.FIRSTNAME | default: "there" }}!</h1>

<p>You're now part of a growing community turning customer conversations into
evidence your whole team can trust.</p>

<h2>Your 3-minute quick start:</h2>

<feature-grid>
  <feature icon="target">
    <title>Define your research goal</title>
    <desc>What do you want to learn? Our AI tailors analysis to your questions.</desc>
  </feature>

  <feature icon="users">
    <title>Set your target audience</title>
    <desc>Who are you learning from? Customers, prospects, internal teams?</desc>
  </feature>

  <feature icon="message-circle">
    <title>Add your first conversation</title>
    <desc>Upload a recording, paste notes, or create a quick survey.</desc>
  </feature>
</feature-grid>

<cta-button href="https://getupsight.com/app/projects">
  Set Up Your Research Context →
</cta-button>

<p class="subtle">Most teams see their first AI-generated insight within 10 minutes
of adding a conversation.</p>
```

**Design Notes**:
- Clean, spacious layout with icon grid (like Brevo example)
- Single primary CTA
- Social proof in subtle text

---

### Email 1.2: Quick Survey Path (Day 2)

**Subject**: The fastest way to get insights? A 2-minute survey
**Preview**: No recordings needed — start collecting feedback today

**Hero Image**: `hero-survey-builder.gif` — 3-second loop showing survey creation

```html
<header-image src="hero-survey-builder.gif" alt="Create a survey in seconds" />

<h1>No recordings? No problem.</h1>

<p>{{ contact.FIRSTNAME | default: "Hey" }}, surveys are the fastest path to insights.
Create one in 2 minutes, share it anywhere, and let our AI analyze the responses.</p>

<callout type="tip">
  <icon name="zap" />
  <text><strong>Pro tip:</strong> Teams using surveys get their first insight
  3x faster than upload-only users.</text>
</callout>

<h2>How it works:</h2>

<steps>
  <step number="1">
    <title>Create your survey</title>
    <desc>Pick a template or build from scratch</desc>
  </step>
  <step number="2">
    <title>Share the link</title>
    <desc>Email, Slack, embed on your site — anywhere</desc>
  </step>
  <step number="3">
    <title>Watch insights emerge</title>
    <desc>AI analyzes responses and surfaces patterns</desc>
  </step>
</steps>

<cta-button href="https://getupsight.com/app/surveys/new">
  Create Your First Survey →
</cta-button>

<secondary-link href="https://getupsight.com/templates">
  Or browse survey templates
</secondary-link>
```

**Design Notes**:
- Animated GIF shows the ease of survey creation
- Numbered steps create clear path
- Secondary CTA for template browsers

---

### Email 1.3: Concierge Import Offer (Day 4)

**Subject**: Need help importing your existing research?
**Preview**: We'll migrate your data for free — just reply to this email

**Hero Image**: `hero-import-assist.svg` — Friendly illustration of data flowing into UpSight

```html
<header-image src="hero-import-assist.svg" alt="We'll help you import" />

<h1>Already have research data?</h1>

<p>{{ contact.FIRSTNAME | default: "Hi" }}, if you have existing interviews,
transcripts, or research notes, we'd love to help you bring them into UpSight.</p>

<h2>Free concierge import includes:</h2>

<checklist>
  <item checked>Upload your recordings (Zoom, Meet, Loom, etc.)</item>
  <item checked>Import transcripts from other tools</item>
  <item checked>Migrate notes and documents</item>
  <item checked>Set up your first project structure</item>
</checklist>

<callout type="offer">
  <icon name="gift" />
  <text><strong>Free for early users:</strong> Just reply to this email with
  what you'd like to import, and we'll handle the rest.</text>
</callout>

<cta-button href="mailto:support@getupsight.com?subject=Data%20Import%20Help">
  Reply for Import Help →
</cta-button>

<divider />

<p class="subtle">Prefer to do it yourself?
<a href="https://getupsight.com/app/upload">Upload directly here</a>.</p>
```

**Design Notes**:
- Concierge offer creates personal connection
- Reply-to-email CTA is low friction
- Checklist shows comprehensive support

---

### Email 1.4: Video Demo — Upload to Insights (Day 5)

**Subject**: See UpSight in action (90-second demo)
**Preview**: Watch a recording turn into actionable insights

**Hero Image**: Video thumbnail with play button overlay

```html
<video-thumbnail
  src="hero-upload-insights-thumb.jpg"
  play-button="true"
  href="https://www.loom.com/share/upsight-demo-upload"
  alt="Watch: Upload to insights in 90 seconds"
/>

<h1>90 seconds to your first insight</h1>

<p>{{ contact.FIRSTNAME | default: "Hey" }}, seeing is believing. Watch how a
simple recording upload turns into searchable, actionable insights.</p>

<h2>In this quick demo:</h2>

<checklist>
  <item>0:00 — Upload a recording or transcript</item>
  <item>0:20 — AI transcription + speaker detection</item>
  <item>0:45 — Automatic evidence extraction</item>
  <item>1:10 — Theme clustering + insight generation</item>
</checklist>

<cta-button href="https://www.loom.com/share/upsight-demo-upload">
  Watch the Demo →
</cta-button>

<divider />

<secondary-section>
  <h3>Ready to try it yourself?</h3>
  <p>Upload any recording — Zoom, Meet, Loom, or voice memo.</p>
  <secondary-button href="https://getupsight.com/app/upload">
    Upload Now
  </secondary-button>
</secondary-section>
```

**Design Notes**:
- Video thumbnail with play button (300% higher CTR)
- Timestamp breakdown reduces friction
- Secondary CTA for ready-to-act users

---

## 2. Aha Activation Sequence

**Trigger**: `data_ingested >= 1` AND `insight_published = 0` for 7+ days
**Goal**: User publishes their first insight
**Cohort**: `lc-stalled-no-insight`

### Sequence Flow

```
Day 7 ─────► Day 10 ─────► Day 14
  │            │             │
  ▼            ▼             ▼
Checklist   AI draft      Success
+ guidance   offer        story
```

---

### Email 2.1: Insight Checklist (Day 7)

**Subject**: You're one step away from your first insight
**Preview**: Here's your personalized checklist to get there

**Hero Image**: `hero-insight-checklist.svg` — Checklist with some items checked

```html
<header-image src="hero-insight-checklist.svg" alt="Almost there!" />

<h1>Your data is in — now let's make it actionable</h1>

<p>{{ contact.FIRSTNAME | default: "Hi" }}, you've added
{{ contact.INTERVIEW_COUNT | default: "some" }} conversations to UpSight.
That's the hard part done!</p>

<p>Now let's turn that raw data into insights your team can actually use.</p>

<h2>Your insight checklist:</h2>

<checklist-interactive>
  <item status="done" icon="check-circle">
    Add your first conversation
  </item>
  <item status="current" icon="circle">
    <strong>Review extracted evidence</strong>
    <desc>See what our AI found in your conversations</desc>
    <action href="https://getupsight.com/app/evidence">View Evidence →</action>
  </item>
  <item status="pending" icon="circle">
    Generate your first insight
    <desc>Cluster evidence into a shareable finding</desc>
  </item>
  <item status="pending" icon="circle">
    Share with your team
    <desc>Get feedback and alignment</desc>
  </item>
</checklist-interactive>

<cta-button href="https://getupsight.com/app/evidence">
  Review Your Evidence →
</cta-button>
```

**Design Notes**:
- Progress indicator shows momentum
- Current step is highlighted
- Deep link to specific next action

---

### Email 2.2: AI Draft Insight Offer (Day 10)

**Subject**: Let AI write your first insight (you just approve)
**Preview**: One click to generate a draft insight from your evidence

**Hero Image**: `hero-lightbulb-moment.svg` — Lightbulb with sparkles

```html
<header-image src="hero-lightbulb-moment.svg" alt="Let AI help" />

<h1>What if AI wrote the first draft?</h1>

<p>{{ contact.FIRSTNAME | default: "Hey" }}, we noticed you have
{{ contact.INTERVIEW_COUNT | default: "several" }} conversations with extracted evidence,
but no published insights yet.</p>

<p>Good news: You don't have to start from scratch.</p>

<callout type="feature">
  <icon name="sparkles" />
  <text><strong>Generate Draft Insight:</strong> Our AI will analyze your evidence,
  identify the strongest pattern, and write a draft insight. You just review and publish.</text>
</callout>

<h2>Here's what happens:</h2>

<steps>
  <step number="1">Click "Generate Draft Insight"</step>
  <step number="2">AI clusters your evidence by theme</step>
  <step number="3">Review the draft, edit if needed</step>
  <step number="4">Publish to your team</step>
</steps>

<cta-button href="https://getupsight.com/app/insights/generate">
  Generate Draft Insight →
</cta-button>

<p class="subtle">Takes about 30 seconds. You stay in control of what gets published.</p>
```

**Design Notes**:
- Removes friction with AI-assisted workflow
- Clear expectation setting (30 seconds, you control)
- Feature callout box highlights the capability

---

### Email 2.3: Success Story + Social Proof (Day 14)

**Subject**: How [Company] turned 5 interviews into a product decision
**Preview**: Real story of insights driving action

**Hero Image**: Customer logo or abstract success illustration

```html
<header-image src="hero-success-story.svg" alt="Customer success" />

<h1>From conversations to conviction</h1>

<p>{{ contact.FIRSTNAME | default: "Hi" }}, here's how one team used UpSight to
make a confident product decision:</p>

<quote-block>
  <quote>"We had 5 customer interviews but couldn't see the pattern. UpSight
  surfaced that 4 out of 5 customers mentioned the same pain point — something
  we'd been debating for months. The evidence made the decision obvious."</quote>
  <attribution>— Product Manager, B2B SaaS</attribution>
</quote-block>

<h2>Their process:</h2>

<timeline>
  <event time="Day 1">Uploaded 5 interview recordings</event>
  <event time="Day 1">AI extracted 47 pieces of evidence</event>
  <event time="Day 2">Generated insight: "Onboarding friction is the #1 churn driver"</event>
  <event time="Day 3">Shared with team, prioritized fix</event>
</timeline>

<p>Your conversations are waiting to tell a similar story.</p>

<cta-button href="https://getupsight.com/app/insights/generate">
  Generate Your First Insight →
</cta-button>
```

**Design Notes**:
- Real customer quote builds credibility
- Timeline shows quick time-to-value
- Connects their situation to the success story

---

## 3. Power User Expansion

**Trigger**: `is_power_user = true` (3+ sessions/week, 5+ tasks completed) AND `team_size = 1`
**Goal**: Add team members / expand seats
**Cohort**: `lc-power-user` + `team_size = 1`

### Sequence Flow

```
Day 21 ─────► Day 28 ─────► Day 35
   │            │             │
   ▼            ▼             ▼
 Usage       Team ROI      Invite
 stats       calculator     offer
```

---

### Email 3.1: Your Impact Stats (Day 21)

**Subject**: You've saved {{ time_saved_hours }} hours this month
**Preview**: Your UpSight usage report + what's next

**Hero Image**: `hero-growth-metrics.svg` — Upward trending chart

```html
<header-image src="hero-growth-metrics.svg" alt="Your impact" />

<h1>{{ contact.FIRSTNAME | default: "Hey" }}, you're getting real value</h1>

<p>Here's what you've accomplished with UpSight:</p>

<stats-grid>
  <stat>
    <number>{{ contact.INTERVIEW_COUNT | default: "12" }}</number>
    <label>Conversations analyzed</label>
  </stat>
  <stat>
    <number>{{ contact.INSIGHT_COUNT | default: "8" }}</number>
    <label>Insights generated</label>
  </stat>
  <stat>
    <number>{{ contact.TASK_COMPLETED_COUNT | default: "15" }}</number>
    <label>Actions completed</label>
  </stat>
  <stat highlight>
    <number>~{{ time_saved_hours | default: "6" }}h</number>
    <label>Time saved (est.)</label>
  </stat>
</stats-grid>

<callout type="insight">
  <icon name="trending-up" />
  <text>Your <strong>insights-to-actions ratio</strong> is {{ ratio | default: "73%" }} —
  that's {{ comparison | default: "above average" }} for UpSight users.</text>
</callout>

<p>Imagine if your whole team had this visibility into customer conversations.</p>

<cta-button href="https://getupsight.com/app/team/invite">
  Invite Your Team →
</cta-button>
```

**Design Notes**:
- Personalized stats create ownership
- ROI metric (time saved) justifies expansion
- Natural bridge to team invitation

---

### Email 3.2: Team ROI Calculator (Day 28)

**Subject**: What if everyone on your team could search customer conversations?
**Preview**: The compound value of shared insights

**Hero Image**: `hero-team-collaboration.svg` — People working together around insights

```html
<header-image src="hero-team-collaboration.svg" alt="Team collaboration" />

<h1>Insights are more valuable when shared</h1>

<p>{{ contact.FIRSTNAME | default: "Hi" }}, you're getting great results solo.
But here's what happens when your team joins:</p>

<comparison-table>
  <row>
    <label>Finding past research</label>
    <solo>You search your memory</solo>
    <team>Everyone searches the same source of truth</team>
  </row>
  <row>
    <label>Customer context in meetings</label>
    <solo>You share what you remember</solo>
    <team>Anyone can pull up the exact quote</team>
  </row>
  <row>
    <label>Onboarding new hires</label>
    <solo>Long knowledge transfer</solo>
    <team>They search and learn independently</team>
  </row>
</comparison-table>

<callout type="math">
  <text>If you save ~6 hours/month, a team of 5 could save 30+ hours/month
  in research synthesis time alone.</text>
</callout>

<cta-button href="https://getupsight.com/app/team/invite">
  Add Your First Teammate →
</cta-button>

<p class="subtle">Free to invite during your current plan. Team features
unlock at 3+ members.</p>
```

**Design Notes**:
- Solo vs. Team comparison makes value concrete
- Simple math reinforces ROI
- Low-friction CTA (free to invite)

---

### Email 3.3: Direct Invite Offer (Day 35)

**Subject**: Invite 2 teammates — we'll extend your trial
**Preview**: Special offer for power users like you

**Hero Image**: `hero-invite-team.svg` — Adding team members illustration

```html
<header-image src="hero-invite-team.svg" alt="Invite your team" />

<h1>You've earned an exclusive offer</h1>

<p>{{ contact.FIRSTNAME | default: "Hey" }}, because you're one of our most
engaged users, we're making it easy to bring your team on board:</p>

<offer-box>
  <title>Power User Bonus</title>
  <offer>Invite 2+ teammates this week</offer>
  <benefit>Get 14 extra days on your trial</benefit>
  <code>Auto-applied when teammates join</code>
</offer-box>

<h2>Who should you invite?</h2>

<suggestions>
  <suggestion icon="user-check">
    <role>Product managers</role>
    <reason>So they can find customer evidence for roadmap decisions</reason>
  </suggestion>
  <suggestion icon="user-check">
    <role>Designers</role>
    <reason>So they can hear customer language for better UX copy</reason>
  </suggestion>
  <suggestion icon="user-check">
    <role>Customer success</role>
    <reason>So they can search for solutions mentioned by other customers</reason>
  </suggestion>
</suggestions>

<cta-button href="https://getupsight.com/app/team/invite">
  Invite Teammates Now →
</cta-button>
```

**Design Notes**:
- Exclusive offer creates urgency
- Role-based suggestions make invitation actionable
- Auto-applied benefit reduces friction

---

## 4. Churn Rescue Sequence

**Trigger**: Was activated (`is_activated = true`) but no activity in 14+ days
**Goal**: Re-engage with clear next step
**Cohort**: `lc-dormant-14d`

### Sequence Flow

```
Day 14 ─────► Day 18 ─────► Day 24 ─────► Day 28
   │            │             │             │
   ▼            ▼             ▼             ▼
 Check-in    Meeting      Last project    Final
 + goal ask   bot offer    reminder       offer
```

---

### Email 4.1: Friendly Check-In (Day 14)

**Subject**: Quick question, {{ contact.FIRSTNAME | default: "there" }}
**Preview**: What would make UpSight more useful for you?

**Hero Image**: `hero-compass-direction.svg` — Compass illustration

```html
<header-image src="hero-compass-direction.svg" alt="Finding your way" />

<h1>We noticed you've been away</h1>

<p>{{ contact.FIRSTNAME | default: "Hi" }}, no pressure — just checking in.</p>

<p>When you signed up, you wanted to turn customer conversations into insights.
Is that still a priority? If so, we'd love to help you get there.</p>

<question-block>
  <question>What's the biggest thing slowing you down?</question>
  <options>
    <option href="...?reason=time">I don't have time right now</option>
    <option href="...?reason=data">I don't have data to upload</option>
    <option href="...?reason=unclear">I'm not sure how to use it</option>
    <option href="...?reason=other">Something else</option>
  </options>
</question-block>

<p>Just click the one that fits — we'll send you personalized help.</p>

<divider />

<p class="subtle">Or if you're ready to dive back in:
<a href="https://getupsight.com/app">Open UpSight →</a></p>
```

**Design Notes**:
- Soft, non-pushy tone
- One-click feedback captures blockers
- Personalized follow-up based on response

---

### Email 4.2: Meeting Bot Offer (Day 18)

**Subject**: What if insights captured themselves?
**Preview**: Install our meeting bot — never miss customer feedback again

**Hero Image**: `hero-meeting-bot.svg` — Calendar with bot integration

```html
<header-image src="hero-meeting-bot.svg" alt="Meeting bot" />

<h1>Too busy for manual uploads?</h1>

<p>{{ contact.FIRSTNAME | default: "Hey" }}, we get it. Uploading recordings
takes time you don't have.</p>

<p>Here's the fix: <strong>Install our meeting bot once, and it automatically
captures every customer call.</strong></p>

<h2>One-click setup:</h2>

<integration-grid>
  <integration icon="video" name="Zoom" status="available" />
  <integration icon="video" name="Google Meet" status="available" />
  <integration icon="video" name="Microsoft Teams" status="available" />
</integration-grid>

<steps>
  <step number="1">Connect your calendar</step>
  <step number="2">Bot joins your customer calls automatically</step>
  <step number="3">Recordings flow into UpSight</step>
  <step number="4">Insights surface without any work from you</step>
</steps>

<cta-button href="https://getupsight.com/app/settings/integrations">
  Install Meeting Bot →
</cta-button>

<p class="subtle">Takes 60 seconds. Works with your existing workflow.</p>
```

**Design Notes**:
- Addresses "no time" objection directly
- Integration logos build credibility
- "Set it and forget it" value prop

---

### Email 4.3: Last Project Reminder (Day 24)

**Subject**: Your {{ project_name | default: "research project" }} is waiting
**Preview**: Pick up where you left off

**Hero Image**: Personalized project screenshot or abstract "continue" illustration

```html
<header-image src="hero-continue-project.svg" alt="Continue your project" />

<h1>You left some insights on the table</h1>

<p>{{ contact.FIRSTNAME | default: "Hi" }}, here's what's in your
{{ project_name | default: "project" }}:</p>

<project-summary>
  <stat>
    <number>{{ evidence_count | default: "23" }}</number>
    <label>pieces of evidence extracted</label>
  </stat>
  <stat>
    <number>{{ theme_count | default: "5" }}</number>
    <label>themes identified</label>
  </stat>
  <stat highlight>
    <number>{{ unacted_insights | default: "3" }}</number>
    <label>insights without actions</label>
  </stat>
</project-summary>

<callout type="tip">
  <icon name="lightbulb" />
  <text><strong>Quick win:</strong> Review your top insight and create one
  next step. Takes 2 minutes.</text>
</callout>

<cta-button href="https://getupsight.com/app/projects/{{ project_id }}">
  Continue {{ project_name | default: "Your Project" }} →
</cta-button>
```

**Design Notes**:
- Personalized with actual project data
- Shows value already created
- Clear "quick win" next step

---

### Email 4.4: Final Win-Back Offer (Day 28)

**Subject**: Before we stop emailing you...
**Preview**: One last thing that might help

**Hero Image**: `hero-wave-goodbye.svg` — Friendly wave illustration

```html
<header-image src="hero-wave-goodbye.svg" alt="Checking in one last time" />

<h1>One more thing before we go quiet</h1>

<p>{{ contact.FIRSTNAME | default: "Hey" }}, we don't want to clutter your inbox
if UpSight isn't right for you right now.</p>

<p>But before we stop these emails, here's our best offer:</p>

<offer-box>
  <title>Come Back Bonus</title>
  <offer>Book a 15-min call with our team</offer>
  <benefit>We'll set up your workflow + give you 30 days free Pro access</benefit>
  <cta href="https://calendly.com/upsight/rescue">Book a Call →</cta>
</offer-box>

<divider />

<p>Not ready? No worries. Your account stays active, and we'll be here when
the timing is right.</p>

<footer-links>
  <link href="https://getupsight.com/app">Log back in anytime →</link>
  <link href="{{ unsubscribe }}">Unsubscribe from these emails</link>
</footer-links>
```

**Design Notes**:
- Respects their attention ("stop emailing you")
- High-touch offer (call) for rescue
- Clean exit with goodwill maintained

---

## 5. Trial Conversion Sequence

**Trigger**: Trial started (reverse trial or standard trial)
**Goal**: Convert to paid plan
**Cohort**: `trial-active`, `trial-expiring`

### Sequence Flow

```
Day -7 ─────► Day -3 ─────► Day -1 ─────► Day 0
   │            │             │             │
   ▼            ▼             ▼             ▼
 Value       Urgency +     Last         Trial
 recap       discount      chance       ended
```

---

### Email 5.1: Value Recap (7 Days Before Expiry)

**Subject**: Your Pro trial: Here's what you've unlocked
**Preview**: A look at what stays and what changes

**Hero Image**: `hero-unlock-features.svg` — Key unlocking features

```html
<header-image src="hero-unlock-features.svg" alt="What you've unlocked" />

<h1>Your trial ends in 7 days</h1>

<p>{{ contact.FIRSTNAME | default: "Hi" }}, here's what you've been using
on your Pro trial:</p>

<feature-usage>
  <feature used="{{ ai_analyses_used | default: '12' }}">
    <name>AI Analyses</name>
    <pro>Unlimited</pro>
    <free>5/month</free>
  </feature>
  <feature used="{{ voice_minutes | default: '45' }}">
    <name>Voice Chat Minutes</name>
    <pro>180 min</pro>
    <free>5 min</free>
  </feature>
  <feature used="{{ lens_count | default: '3' }}">
    <name>Custom Lenses</name>
    <pro>Unlimited</pro>
    <free>Not available</free>
  </feature>
</feature-usage>

<p>When your trial ends on <strong>{{ contact.TRIAL_END | date: "%B %d" }}</strong>,
you'll move to the Free plan unless you upgrade.</p>

<h2>Keep everything you've built:</h2>

<plan-comparison href="https://getupsight.com/pricing" />

<cta-button href="https://getupsight.com/app/billing/upgrade">
  Upgrade to Pro →
</cta-button>

<p class="subtle">Questions about plans? <a href="mailto:support@getupsight.com">Reply to this email</a>.</p>
```

**Design Notes**:
- Shows actual usage data (personalized)
- Clear comparison of Pro vs. Free
- No discount yet — value-first

---

### Email 5.2: Urgency + Discount (3 Days Before)

**Subject**: 3 days left — save 25% on Pro
**Preview**: Early bird pricing ends when your trial does

**Hero Image**: `hero-countdown.svg` — Timer/countdown illustration

```html
<header-image src="hero-countdown.svg" alt="3 days left" />

<h1>Your trial ends in 3 days</h1>

<p>{{ contact.FIRSTNAME | default: "Hey" }}, as an early user, you can lock in
our best rate before your trial ends.</p>

<offer-box highlight>
  <badge>EARLY BIRD</badge>
  <title>25% off your first year</title>
  <code>EARLYBIRD25</code>
  <expiry>Expires with your trial</expiry>
</offer-box>

<h2>What you keep with Pro:</h2>

<checklist>
  <item checked>Unlimited AI analyses</item>
  <item checked>180 minutes of voice chat</item>
  <item checked>Custom Conversation Lenses</item>
  <item checked>Smart Personas</item>
  <item checked>Priority support</item>
</checklist>

<cta-button href="https://getupsight.com/app/billing/upgrade?code=EARLYBIRD25">
  Claim 25% Off →
</cta-button>

<p class="subtle">Discount applies to annual billing only.</p>
```

**Design Notes**:
- Discount code creates urgency
- Feature checklist reinforces value
- Clear expiry tied to trial end

---

### Email 5.3: Last Chance (1 Day Before)

**Subject**: Tomorrow: Your Pro features pause
**Preview**: Last day to keep unlimited access

**Hero Image**: Simple, clean "1 day" badge or countdown

```html
<header-image src="hero-last-day.svg" alt="1 day remaining" />

<h1>This is your last day of Pro</h1>

<p>{{ contact.FIRSTNAME | default: "Hi" }}, tomorrow your account moves to Free.
Here's exactly what changes:</p>

<changes-table>
  <change>
    <feature>AI Analyses</feature>
    <from>Unlimited</from>
    <to>5/month</to>
  </change>
  <change>
    <feature>Voice Chat</feature>
    <from>180 min</from>
    <to>5 min</to>
  </change>
  <change>
    <feature>Custom Lenses</feature>
    <from>Yes</from>
    <to>No</to>
  </change>
</changes-table>

<callout type="urgent">
  <icon name="clock" />
  <text>Your 25% discount expires tonight at midnight.</text>
</callout>

<cta-button href="https://getupsight.com/app/billing/upgrade?code=EARLYBIRD25">
  Upgrade Now — Keep Everything →
</cta-button>

<divider />

<p>Not ready to commit? <a href="mailto:support@getupsight.com">Let's chat</a> —
we may be able to extend your trial.</p>
```

**Design Notes**:
- Clear before/after comparison
- Urgency without being aggressive
- Exit ramp (extend trial) maintains goodwill

---

### Email 5.4: Trial Ended (Day 0)

**Subject**: Your Pro features are now paused
**Preview**: Here's how to reactivate anytime

**Hero Image**: Calm "paused" illustration (not negative)

```html
<header-image src="hero-paused.svg" alt="Pro features paused" />

<h1>Your trial has ended</h1>

<p>{{ contact.FIRSTNAME | default: "Hi" }}, your account is now on the Free plan.
Your data is safe — nothing is deleted.</p>

<h2>What you can still do:</h2>

<checklist>
  <item checked>Access all your projects and insights</item>
  <item checked>View all evidence and themes</item>
  <item checked>5 AI analyses per month</item>
  <item checked>Basic survey features</item>
</checklist>

<h2>What's paused:</h2>

<checklist-disabled>
  <item>Unlimited AI analyses</item>
  <item>Extended voice chat</item>
  <item>Custom Lenses</item>
  <item>Smart Personas</item>
</checklist-disabled>

<p>Ready to unlock Pro again? Your discount is still valid for 48 hours:</p>

<cta-button href="https://getupsight.com/app/billing/upgrade?code=EARLYBIRD25">
  Reactivate Pro (25% Off) →
</cta-button>

<p class="subtle">After 48 hours, standard pricing applies.</p>
```

**Design Notes**:
- Not punitive — "paused" not "lost"
- Clear what still works
- Grace period on discount

---

## Email Design Template (HTML/CSS Reference)

### Base Template Structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ subject }}</title>
  <style>
    /* Reset */
    body { margin: 0; padding: 0; background: #f5f5f5; }

    /* Container */
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }

    /* Header image */
    .header-image { width: 100%; height: auto; display: block; }

    /* Content */
    .content { padding: 32px 24px; }

    /* Typography */
    h1 { font-size: 24px; color: #1a1a1a; margin: 0 0 16px; }
    p { font-size: 16px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px; }

    /* CTA Button */
    .cta-button {
      display: inline-block;
      background: #0066ff;
      color: #ffffff !important;
      padding: 14px 28px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      margin: 24px 0;
    }

    /* Feature grid */
    .feature-grid { display: table; width: 100%; }
    .feature { display: table-row; }
    .feature-icon { display: table-cell; width: 48px; padding: 12px 0; }
    .feature-content { display: table-cell; padding: 12px 0 12px 12px; }

    /* Callout box */
    .callout {
      background: #f0f7ff;
      border-left: 4px solid #0066ff;
      padding: 16px;
      margin: 24px 0;
    }

    /* Footer */
    .footer {
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <img class="header-image" src="{{ header_image_url }}" alt="{{ header_alt }}" />

    <div class="content">
      {{ content }}
    </div>

    <div class="footer">
      <p>UpSight Inc. • 823 Congress Ave, Austin TX 78701</p>
      <p>
        <a href="{{ unsubscribe }}">Unsubscribe</a> •
        <a href="https://getupsight.com/privacy">Privacy Policy</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

## Brevo Automation Setup

### Workflow Configuration

| Workflow | Entry Trigger | Exit Condition |
|----------|---------------|----------------|
| Welcome & First Data | Added to `all-users` list | `interview_count >= 1` OR `survey_count >= 1` |
| Aha Activation | Added to `activation-stalled` | `insight_count >= 1` |
| Power User Expansion | Added to `power-user-solo` | `team_size >= 2` |
| Churn Rescue | Added to `activation-dormant` | Any event in last 7 days |
| Trial Conversion | Added to `trial-active` | `has_paid_subscription = true` |

### Contact Attributes for Personalization

| Attribute | Type | Source |
|-----------|------|--------|
| `FIRSTNAME` | Text | Signup |
| `INTERVIEW_COUNT` | Number | Daily sync |
| `INSIGHT_COUNT` | Number | Daily sync |
| `TASK_COMPLETED_COUNT` | Number | Daily sync |
| `TRIAL_END` | Date | Trial grant |
| `PROJECT_NAME` | Text | Last active project |
| `TIME_SAVED_HOURS` | Number | Calculated (interviews × 0.5h) |

---

## Metrics & Optimization

### Target Benchmarks

| Metric | Target | Industry Avg |
|--------|--------|--------------|
| Welcome email open rate | 50%+ | 40% |
| Sequence open rate | 35%+ | 25% |
| Click-through rate | 8%+ | 3-5% |
| Unsubscribe rate | <0.5% | 0.5% |
| Trial conversion | 25%+ | 15-20% |

### A/B Testing Priorities

1. **Subject lines**: Test personalization vs. benefit-led
2. **Send times**: 10am vs. 2pm local time
3. **CTA copy**: Action verbs vs. benefit statements
4. **Email length**: Short (100 words) vs. detailed (300 words)
5. **Hero images**: Illustrations vs. product screenshots

### Weekly Review Checklist

- [ ] Check open rates by sequence
- [ ] Review click-through rates by CTA
- [ ] Monitor unsubscribe rate (flag if >0.5%)
- [ ] Analyze conversion funnel dropoff
- [ ] Update cohort definitions if needed

---

## Related Documentation

- [Email Campaigns Setup](../../60-ops-observability/email-campaigns-setup.md) — Brevo configuration
- [Activation Strategy](../../60-ops-observability/activation-strategy.md) — Reverse trial design
- [PLG Instrumentation](../../60-ops-observability/plg-instrumentation-plan.md) — Event tracking

---

*Last updated: {{ current_date }}*
