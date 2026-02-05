# Account Pipeline Settings

Pipeline configuration now lives at the **account** level so every project uses the same vocabulary.

**Where to edit**
- Navigate to `/a/{accountId}/settings`.
- Three lists are editable inline:
  - Opportunity stages (used for deal kanban columns and stage dropdowns)
  - Journey stages (customer journey steps for interviews/insights)
  - Priority clusters (roadmap/prioritization categories)

**How it works**
- Click **Edit** to inline-edit labels; stored values are auto-slugified from the label.
- Use **Reset** to restore best-practice defaults.
- Saving updates `account_settings.metadata` for the account and applies across all projects.

**Default sets**
- Opportunity: Prospect → Discovery → Evaluation → Proposal → Negotiation → Commit → Closed Won/Lost.
- Journey: Aware → Consider → Trial → Adopt → Expand.
- Priority clusters: Product – Workflows, Product – Intelligence, Foundation – UX & Reliability, Monetization, Engagement, Acquisition & GTM.

**UI surfaces using these**
- Opportunity kanban columns and stage dropdowns now read from account settings (not per-project).
- Future: journey/priorities can consume the same lists for consistent filters.

