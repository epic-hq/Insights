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
2/7 Work Done
- built sprint management plan
- CRM-dogfooding spec & starting to do it
- Survey script demo recording (crp): Drafted script
- Fixed QA on Interview Upload flow. 
    - no progress. bc going straight to R2?
    - open: no thumbnails - Insights-hf26
- applied biome linting entire 1100 file codebase
- Desktop app testing & person upsert fixes in APIs
- 43a agentic orchestration improvements: lower token and tool count to agents
  - picked up some more optimizations via codex

2/8
- people-org schema confusion needs to be cleared up. this is impacting facets, ICP functions - no bead or doc yet. Claude analysis https://claude.ai/code/session_01M8nLXmam7dhmxrzpM1oRyw 
  
Yikes: explain this query result:
You

what do john rubey and jered lish have in common

Uppy Assistant

Top themes right now:

1. [Enhance Integration with Existing Tools](http://localhost:4280/a/d7b69d5e-a952-41a6-931f-e2fed1d82e85/6dbcbb68-0662-4ebc-9f84-dd13b8ff758d/insights/e21f0093-2d10-48b1-9712-213f510640ae) (22 mentions) — People: Fatima A, Rick Moy, Rick, John Rubey
2. [Enhance Survey and Interview Customization](http://localhost:4280/a/d7b69d5e-a952-41a6-931f-e2fed1d82e85/6dbcbb68-0662-4ebc-9f84-dd13b8ff758d/insights/9bd813ad-aa30-4aa1-9f72-e2cf5898c113) (18 mentions) — People: Rick Moy, Rick, Mona Fendereski, Mona Fendereski • Dec 26, 2025, Fatima A, John Rubey
```

## Parking Lot (not this sprint)

- Smarter agent loop / recommendation memory (next sprint) -- ha, kinda doing it now a bit.
- Actionable insights for ICP (next sprint)
- Gen-UI component expansion (backlog)
- Code quality / lint cleanup (backlog)
- PLG email sequences in Brevo (backlog)**NEED at least onboarding**

NEW & RAW:
- Simple person detail should have a nicer experience. user wants to see pithy udnerstanding of the user and "next steps" field. But data quality is an issue, and nobody likes data entry into CRMs. HMW make this more pleasant and useful?  Solution ideas: Make display of key data more prominent. waste less space by rearranging the layout. have UX expert review it. Offer a Nice "Record updates" via voice widget prominently. Make frequent actions more obvious in the UI. Those would be: update, make a task, send a survey link or meeting request (& copy to email)
- 

## BMad Spec Queue

Run each in a **fresh session** (Cmd+N). Output goes to `_bmad-output/`.

| Feature                    | Command            | Context to Load                                     | Status                                         |
| -------------------------- | ------------------ | --------------------------------------------------- | ---------------------------------------------- |
| CRM Dogfood MVP            | `/bmad-quick-spec` | `docs/90-roadmap/crm-dogfood-kickoff.md` + CRM docs | Queued                                         |
| Desktop Pipeline Alignment | `/bmad-quick-spec` | `docs/features/desktop-speaker-identification.md`   | Working on people ID. Need to test it. {CODEX} |

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
