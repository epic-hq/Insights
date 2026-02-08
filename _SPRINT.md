# Sprint: Feb 10-14, 2026

Two parallel tracks. 2 primary goals per track + a Tier 2 list for bugs and quick wins. See `docs/plan.md` for full epic roadmap.

## Product Track (Builder)

1. [ ] **Desktop Realtime Agent** — Align realtime evidence pipeline with post-analysis Trigger.dev flow (Insights-xph, Insights-32v, Insights-65r)
2. [ ] **Surveys Quick Win** — Get survey builder to "wow" state: voice responses or personalized invites (Insights-4ud)
3. [ ] Insights-3ml (ICP Match Lens & Recommendation Engine)

**Tier 2** (from `bv --robot-triage`, pick when blocked):

- [ ] Gen-UI component library — unblocks 7 downstream widgets (Insights-1yh, score 0.54)
- [x] Streamline setup UX — single assistant + context card center (Insights-dwy, score 0.32)
- [ ] Track user decisions and outcomes — unblocks weekly digest (Insights-43a.10, score 0.21)

## Business Track (Operator)

1. [ ] **CRM Dogfood Spec** — Run `/bmad-quick-spec` for CRM MVP 
	1. [ ] related to good data quality in service of ICP focus Insights-3ml (ICP)
	2. [ ] (gap analysis ready at `docs/90-roadmap/crm-dogfood-kickoff.md`)
2. [ ] **GTM Outreach Start** — Landing page copy + demo flow script draft
3. [ ] Survey script demo recording (crp)

**Tier 2** (from `bv --robot-triage`, pick when blocked):

- [ ] Instrument onboarding milestones in PostHog — unblocks Brevo automations + email sequences (Insights-y2v, score 0.23)
- [ ] Smart email CTA redirects — `/go/:destination` resolver, unblocks email imagery (Insights-3qt, score 0.19)
- [ ] Set up lifecycle nurture workflows in Brevo (Insights-aim, blocked by Insights-y2v)

## Today (scratchpad)

Jot notes here as you work. Close beads with `bd close`. When you ask me to update the sprint, I'll read this + `bv --robot-triage` to refresh everything.

```
2/7 
- building sprint management plan
- CRM-dogfooding spec
  
- Survey script demo recording (crp)
- QA Interview Upload flow. 
  - issues: 
    - no progress. bc going straight to R2?
```

## Parking Lot (not this sprint)

- Smarter agent loop / recommendation memory (next sprint)
- Actionable insights for ICP (next sprint)
- Gen-UI component expansion (backlog)
- Code quality / lint cleanup (backlog)
- PLG email sequences in Brevo (backlog)

## BMad Spec Queue

Run each in a **fresh session** (Cmd+N). Output goes to `_bmad-output/`.

| Feature | Command | Context to Load | Status |
|---------|---------|-----------------|--------|
| CRM Dogfood MVP | `/bmad-quick-spec` | `docs/90-roadmap/crm-dogfood-kickoff.md` + CRM docs | Queued |
| Desktop Pipeline Alignment | `/bmad-quick-spec` | `docs/features/desktop-speaker-identification.md` | Queued |

## Completed This Sprint

_Auto-populated: ask me to "update sprint" and I'll pull from `bd list --status=closed`._

## Beads Hygiene (do once)

Label open issues by stream for `bv --robot-triage --label` filtering. See `docs/plan.md` → Beads Hygiene.

---

## How This File Works

- **You**: Jot notes in Today, close beads with `bd close`
- **Agent**: Say "update sprint" → I read Today + `bv --robot-triage` + `bd list --status=closed`, then refresh goals, Tier 2, and Completed
- **Monday**: Fresh sprint from `bv --robot-triage`
- **Friday**: Archive to `docs/90-roadmap/archive/sprint-YYYY-MM-DD.md`
- **Rule**: If it's not in goals, it goes in Parking Lot.
