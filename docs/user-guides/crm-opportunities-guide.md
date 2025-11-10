# CRM & Opportunities User Guide

Turn discovery conversations into actionable deal intelligence with built-in CRM features and AI-powered deal coaching.

## Table of Contents
- [Overview](#overview)
- [Creating Opportunities](#creating-opportunities)
- [Linking Conversations to Opportunities](#linking-conversations-to-opportunities)
- [Managing Stakeholders](#managing-stakeholders)
- [Tracking Next Steps](#tracking-next-steps)
- [AI Deal Advisor](#ai-deal-advisor)
- [Opportunity Details](#opportunity-details)

---

## Overview

The CRM & Opportunities feature transforms customer conversations into structured sales intelligence. Every interview can be linked to an opportunity, automatically extracting stakeholder relationships, next steps, and deal context. The AI Deal Advisor then analyzes this data to provide strategic recommendations for advancing deals.

**Key capabilities:**
- Create and manage opportunities (deals)
- Link conversations/interviews to opportunities
- Track stakeholders with role classification (Decision Maker, Influencer, Blocker)
- Extract and manage next steps with ownership
- Get AI-powered deal advice based on conversation history

---

## Creating Opportunities

### From the Opportunities Page

1. Navigate to **CRM** in the sidebar (or `/a/{accountId}/{projectId}/opportunities`)
2. Click **+ New Opportunity** in the header
3. Fill in the opportunity details:
   - **Title** (required): Deal name or company name
   - **Description**: Overview of the opportunity
   - **Stage**: Current deal stage (discovery, proposal, negotiation, closed-won, closed-lost)
   - **Amount**: Deal value in dollars
   - **Close Date**: Expected close date
   - **Product/Solution**: What you're selling
   - **Notes**: Additional context or internal notes
4. Click **Create Opportunity**

### From a Conversation

When processing an interview, you can create an opportunity directly from the conversation context:

1. Open an interview detail page
2. If the conversation mentions a potential deal, you'll see a prompt to **Link to Opportunity**
3. Click **Create New Opportunity**
4. The system will pre-fill fields based on the conversation context
5. Review and adjust details, then save

**Tip:** Creating opportunities from conversations automatically links the interview and extracts stakeholder information.

---

## Linking Conversations to Opportunities

Linking interviews to opportunities enables automatic extraction of stakeholders, next steps, and deal context.

### Manual Linking

1. Open an interview detail page
2. Click the **Link to Opportunity** button in the header
3. Select an existing opportunity from the dropdown, or click **Create New**
4. The interview will be reprocessed to extract sales-relevant information

### What Happens When You Link

When an interview is linked to an opportunity, the system automatically:
- **Extracts stakeholders** from the conversation with role classification
- **Identifies next steps** with owners and timing
- **Analyzes the conversation** using sales frameworks (BANT, MEDDIC, SPICED)
- **Updates the opportunity** with fresh insights

**Note:** The Sales Lens analysis runs in the background. You'll see stakeholders and next steps appear within 1-2 minutes.

### Viewing Linked Conversations

On the opportunity detail page, the **Linked Interviews** section shows all connected conversations:
- Interview title and date
- Participants
- Quick link to view full transcript

Click any interview to review the original conversation and evidence.

---

## Managing Stakeholders

The **Stakeholder Matrix** provides a centralized view of all people involved in the deal, extracted from linked conversations.

### Understanding the Stakeholder Matrix

Located at the top of the opportunity detail page, the matrix shows:

| Field | Description |
|-------|-------------|
| **Name** | Stakeholder name (editable inline) |
| **Type** | Role classification (see below) |
| **Role/Title** | Job title or organizational role |
| **Influence** | Level of buying influence (Low, Medium, High) |
| **Email** | Contact email |
| **Description** | Additional context or notes |

### Stakeholder Types

Each stakeholder is classified based on their role in the buying process:

- **DM (Decision Maker)** 🔴 - Has final authority to approve the purchase
- **I (Influencer)** 🟡 - Provides input and recommendations
- **B (Blocker)** 🔵 - Can prevent or delay the purchase
- **- (Unknown)** ⚪ - Role not yet determined

**Tip:** These classifications come from analyzing conversation content. The AI detects phrases like "I'll need to get approval from..." or "The team thinks..." to identify roles.

### Editing Stakeholder Information

All fields are **inline-editable**:

1. Click any cell in the matrix to edit
2. For **Type**, click to open a dropdown and select the role
3. For **Influence**, select Low/Medium/High
4. Changes save automatically

### Linking Stakeholders to People

Stakeholders extracted from conversations can be linked to existing **People** records in your CRM:

1. Click the stakeholder name to open the person profile
2. The system automatically matches based on name and email
3. Review and confirm the linkage
4. Linked stakeholders show enriched data (company, contact info, history)

**Why link?** Linking enables:
- Full conversation history across all opportunities
- Company/organization context
- Contact information synchronization
- Better AI recommendations based on historical interactions

---

## Tracking Next Steps

Next steps are automatically extracted from conversations and displayed in the **Next Steps** section.

### What Gets Extracted

The system identifies:
- **Action items** mentioned in the call ("I'll send you the proposal...")
- **Owner** (who's responsible)
- **Due date** or timeframe
- **Source evidence** from the transcript

### Viewing Next Steps

Next steps are organized by owner:
- **Your next steps** - Actions for your team
- **Customer next steps** - Actions for stakeholders
- **Unassigned** - Detected actions without clear ownership

### Editing Next Steps

Click any next step to edit inline:
- Update the description
- Change the owner (select from stakeholders)
- Adjust the due date
- Add notes

### Adding Manual Next Steps

While most next steps are auto-extracted, you can add manual ones:

1. Click **+ Add Next Step** in the section
2. Enter description and select owner
3. Set due date if known
4. Save

**Best Practice:** Review and update next steps immediately after each conversation to maintain deal momentum.

---

## AI Deal Advisor

The **AI Deal Advisor** analyzes your opportunity data and provides strategic recommendations.

### What It Analyzes

The AI reviews:
- ✅ **Stakeholder coverage** - Are you engaging the right people?
- ✅ **Next step momentum** - Are actions clear, owned, and time-bound?
- ✅ **Deal qualification** - Is this a real opportunity?
- ✅ **Risk factors** - What could prevent closing?
- ✅ **Conversation history** - Insights from linked interviews

### Getting Advice

1. Open an opportunity detail page
2. The **AI Deal Advisor** section appears at the top
3. Click **Get Advice** to generate recommendations
4. Wait 5-10 seconds for analysis

### Understanding the Recommendations

The AI provides:

#### Status Assessment
One-sentence summary of deal health and momentum.

**Example:**
> "Strong momentum with executive engagement, but timeline clarity needed before Q4 close."

#### Recommendations (2-3 actions)
Specific, actionable next steps with clear ownership and timing.

**Example:**
1. Schedule a technical deep-dive with Engineering VP within 2 weeks to validate feasibility
2. Request introduction to CFO by June 15th to discuss budget approval process
3. Send ROI analysis to Champion by EOW to arm them for internal advocacy

#### Risks (1-2 blockers)
Concrete risks or red flags that could derail the deal.

**Example:**
- No confirmed budget holder in stakeholder matrix
- Next steps lack specific timing/ownership

#### Confidence Level
- 🟢 **High** - Strong data quality, clear momentum
- 🟡 **Medium** - Some gaps but directionally sound
- 🔴 **Low** - Insufficient data or significant red flags

### When to Use the Advisor

Get fresh advice:
- ✅ **After every conversation** - Get immediate next steps
- ✅ **Before key meetings** - Strategic guidance on what to prioritize
- ✅ **When deals stall** - Identify blockers and re-engage strategies
- ✅ **Deal reviews** - Prepare data-driven updates for leadership

### Refreshing Recommendations

Click **Get Advice** again after:
- Adding new linked conversations
- Updating stakeholder information
- Completing next steps
- Significant time has passed (>1 week)

The AI will supersede previous recommendations with updated analysis.

**Note:** Each recommendation is versioned and stored. You can view the history to track how advice evolved over time.

---

## Opportunity Details

### Overview Section

The top of the page shows key deal metrics:
- **Stage** - Current position in sales cycle
- **Amount** - Deal value
- **Close Date** - Expected close
- **Owner** - Account executive

Click any field to edit inline.

### Description & Product Sections

**Description** (editable)
- Overview of the opportunity
- Key context or background
- Internal notes

**Product/Solution** (editable)
- What you're selling
- Configuration or SKU details
- Pricing structure

Both sections support inline editing - click to modify.

### Notes Section

Free-form area for:
- Meeting notes
- Internal discussions
- Strategy thoughts
- Risk tracking

**Tip:** The AI Advisor reads notes to provide contextual recommendations.

### Navigation

**Back to Opportunities** - Return to the opportunities list (kanban view)

---

## Tips & Best Practices

### 🎯 Maximize AI Accuracy
- Link conversations as soon as possible after calls
- Ensure stakeholder names/emails are correct (improves matching)
- Add manual context in Notes that wasn't captured in calls
- Update next steps ownership promptly

### 📊 Keep Data Fresh
- Review stakeholder matrix weekly
- Mark completed next steps or update status
- Get fresh AI advice before key meetings
- Link all relevant conversations, not just discovery calls

### 🤝 Improve Collaboration
- Share opportunity links with team members
- Use AI recommendations in deal reviews
- Reference specific conversation evidence when debating strategy
- Track recommendation history to show progress

### ⚡ Workflow Integration
1. **After every call:** Link conversation → Review stakeholders → Update next steps
2. **Weekly:** Get AI advice → Address top risk → Update deal stage if needed
3. **Before meetings:** Review conversation history → Check AI recommendations → Prep specific questions

---

## Troubleshooting

### "No stakeholders showing up"

**Cause:** Interview not yet processed or not linked
**Fix:**
1. Ensure interview is linked (look for "Linked Interviews" section)
2. Wait 1-2 minutes for Sales Lens extraction
3. Refresh the page
4. If still missing, manually add stakeholders

### "AI Advisor returns no recommendations"

**Cause:** Insufficient data (no conversations or stakeholders)
**Fix:**
1. Link at least one conversation
2. Ensure stakeholders are populated
3. Add some next steps (even manual ones)
4. Try again

### "Next steps seem inaccurate"

**Cause:** Ambiguous conversation language or poor audio quality
**Fix:**
1. Review the source evidence (hover to see transcript snippet)
2. Edit or remove inaccurate next steps
3. Add manual next steps for clarity
4. Ensure future calls have better audio quality

### "Can't find my opportunity"

**Cause:** Created in wrong project or not yet saved
**Fix:**
1. Check you're in the correct project (top nav)
2. Use the search/filter on opportunities page
3. Check if you clicked "Create" vs "Cancel"
4. Verify it's not in a different account

---

## Related Features

- **[Sales Lens User Guide](./sales-lens-user-guide.md)** - Deep dive on BANT/MEDDIC extraction
- **[Conversation Analyzer](../conversation-analyzer-user-guide.md)** - How interviews are processed
- **[Interview Upload Guide](./interview-question-manager.md)** - Recording and uploading conversations

---

## Feedback & Support

Have questions or suggestions?
- Report issues: [GitHub Issues](https://github.com/your-org/insights/issues)
- Feature requests: Share in your team Slack or via the in-app feedback button
- Documentation updates: Submit PRs to improve this guide

**Last updated:** 2025-11-10
