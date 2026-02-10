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

## Today 2/7 -8 (scratchpad)

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


## Yikes: Agent Testing quality 
```

## Sunday 2/8
2/8
- **people-org schema confusion** needs to be cleared up. this is impacting facets, ICP functions - no bead or doc yet. Claude analysis https://claude.ai/code/session_01M8nLXmam7dhmxrzpM1oRyw 
  - phase 3e currently removing old references to fields (2/9) (DONE)
  - there may be some functions referring to old code (Found a few DONE?)
  - merged PR  (2/9)

## Monday 2/9
```
- Agent Orchestrator perf & delegation (43a)
  - new HowTo UX Researcher and GTM agent (Insights-7a00) DONE
    
- Bryan Rill UX Researcher feedback digestion into plan
  - taxonomy architecture audit (Codex)
    [ux-research-party-mode-analysis-2026-02-09.md](app://-/index.html# "/Users/richardmoy/Code/ai/Insights/_bmad-output/ux-research-party-mode-analysis-2026-02-09.md (line 1)")
	- UI refactor Interview page monolith, light touch on Evidence Correction in this (r713 and 64cp) -- (DONE)
	  DO THIS: file:///Users/richardmoy/Code/ai/Insights/_bmad-output/interview-detail-mockup.html# (ALMOST DONE)
	  
- UI Refactoring with BMAD UX for mobile & person page to make more insightful & actionable
  

- DJ found bug in survey responses. column people not found. (DONE)
  - user wants to capture company and other info. how do we allow users to specify fields they can collect? need to allow for some existing fields we need to have special rules about (title, industry, etc) bc organizations is linked record, and some custom
- url uploads (DONE)
- not deleting (DONE)

```

## Tuesday 2/10 - Sales & Marketing

- survey demo prod
	- send to dennis, cheryl, eric, bryan
- platform invites
	- eric, bryan
- email campaign start
- usage visibility in PH

* event promo for 2/19


## Parking Lot (not this sprint)

- Smarter agent loop / recommendation memory (next sprint) -- ha, kinda doing it now a bit.
- Actionable insights for ICP (next sprint)
- Gen-UI component expansion (backlog)
- Code quality / lint cleanup (backlog)
- PLG email sequences in Brevo (backlog)**NEED at least onboarding**

NEW & RAW TODO:
- Simple person detail should have a nicer experience. user wants to see pithy udnerstanding of the user and "next steps" field. But data quality is an issue, and nobody likes data entry into CRMs. HMW make this more pleasant and useful?  Solution ideas: Make display of key data more prominent. waste less space by rearranging the layout. have UX expert review it. Offer a Nice "Record updates" via voice widget prominently. Make frequent actions more obvious in the UI. Those would be: update, make a task, send a survey link or meeting request (& copy to email)
- QA Test Agent responses;
	- ```
	  watch out for stock answers
	  ```

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
