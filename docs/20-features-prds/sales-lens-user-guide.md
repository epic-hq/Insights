# Sales Lens User Guide

> **Note:** For the complete CRM & Opportunities workflow, see the [CRM & Opportunities Guide](./user-guides/crm-opportunities-guide.md). This guide covers the technical details of Sales Lens extraction.

This guide explains how sales methodology lenses (BANT, MEDDIC, SPICED, MAP) are automatically extracted from customer conversations.

## Accessing the page

1. Open any project and choose **Sales Lenses** from the sidebar navigation.
2. The page renders one card per supported framework (SPICED, BANT/GPCT, MEDDIC, MAP). Each card represents the latest interview-derived snapshot.

## What you will see

- **Header** – framework name, last-updated timestamp, and the attendees whose records are already linked to people in your workspace.
- **Stakeholders** – a roster showing:
  - Name and linkage status ("Linked to …" if a Supabase person record is connected).
  - Auto-assigned labels such as economic buyer, decision maker, or influencer.
  - Confidence, role, influence, person key, email, and linked organization when the People record already names a company.
  - An "Unlinked attendees" list to flag anyone who still needs to be matched to a CRM contact/person.
- **Hygiene chips** – badges for aggregate hygiene findings plus per-slot issues.
- **Framework slots** – extracted values, owners, due dates, evidence counts, and confidence levels.

## Actions available today

- **Commit to CRM** – sends a placeholder write-back request (the action currently confirms success and displays "CRM write-back coming soon" while the integration is being implemented).
- **Refresh lens** – re-runs the Trigger.dev pipeline for the underlying interview so you can pull in late transcript edits or relabeled stakeholders.

Both buttons submit through fetcher forms and will disable while the request is in flight.

## Managing attendee linkages

- When a stakeholder is captured but not linked to a person record, the UI surfaces the generated `personKey`. Use this key as a hint when matching to existing people or creating new contacts.
- Linking unassigned attendees before committing to CRM will ensure owners/labels flow into downstream systems without manual cleanup.
- Confirm the suggested organization and contact details on the underlying People record (`primary_email`, `primary_phone`, `default_organization_id`) so the eventual write-back can populate CRM fields without rework.

## Troubleshooting tips

- If a lens fails to refresh, check the Trigger.dev dashboard for the `sales.generate-sales-lens` task logs.
- Re-run the upstream interview processing (Regenerate evidence) if stakeholders or themes look outdated before refreshing the lens.
- Use the stakeholder list to confirm the economic buyer and decision maker were picked up—update the transcript or slot manually if the heuristics miss a key role.

---

## CRM & Opportunities Integration

**Sales Lens extraction now powers the CRM & Opportunities feature!**

When you link a conversation to an opportunity:
1. Sales Lens automatically extracts stakeholders with role classification (DM, Influencer, Blocker)
2. Next steps are identified with owners and due dates
3. The AI Deal Advisor analyzes the extracted data to provide strategic recommendations

**To use the complete workflow:**
- See [CRM & Opportunities Guide](./user-guides/crm-opportunities-guide.md) for full documentation
- See [CRM Workflow Quick Reference](./quick-reference/crm-workflow.md) for a cheat sheet

**Key differences between Sales Lens page and Opportunity detail:**
- **Sales Lens page** - Technical view of extraction results across all conversations
- **Opportunity detail** - Business view focused on a specific deal with AI coaching

For most users, the Opportunity detail page provides the most actionable workflow.
