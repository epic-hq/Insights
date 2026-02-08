# My Daily Workflow

## Morning Ritual (5 min)

1. Open `_SPRINT.md` — what's the goal today?
2. `bv --robot-triage | jq '.recommendations[:3]'` — does anything urgent override?
3. Pick ONE thing. Start a single agent session for it.
4. Don't open a second workstream until the first is closed or blocked.

**Rule: Max 2 concurrent agent sessions** — one implementing, one speccing/planning.

## Finding Work

```bash
# See what's ready to work on
bv --robot-triage | jq '.recommendations[:3]'

# Or interactively
bv   # then press / and type "ready"

# Implement top priority
claude
> /next-task
```

---

## Spec & Architecture Discipline (BMad)

**You are the senior business leader and architect.** Agents execute specs — they don't decide what to build. Every feature goes through this gate before implementation.

### When to Spec

| Situation | Action |
|-----------|--------|
| New feature idea | Write it in `_SPRINT.md` Parking Lot first |
| Parking Lot item gets promoted to Goals | Run BMad spec flow |
| Bug fix or small tweak (< 1 day) | Skip spec, just implement |
| "While you're at it" from an agent | Create a bead, don't implement |

### The Spec Flow

Each step runs in a **fresh agent session**. Load context before every BMad command.

**Step 1: Context Loading** (always do this first)

```
Read docs/_information_architecture.md, docs/_lens-based-architecture-v2.md,
and docs/interview-processing-explained.md for existing product context.
Also read [any feature-specific docs].
```

**Step 2: Quick Spec** (features < 15 stories, 1-3 days work)

```
/bmad-quick-spec
```

**Step 3: Full Spec Flow** (major features, run in order)

```
/bmad-create-prd           # → _bmad-output/PRD.md
/bmad-create-architecture  # → _bmad-output/architecture.md (NEW SESSION)
/bmad-create-stories       # → _bmad-output/epics/*.md (NEW SESSION)
```

**Step 4: Architecture Review** (before implementation begins)

Before any agent starts coding, review the architecture output yourself:

- Does it reuse existing tables/components or create unnecessary new ones?
- Does it follow the patterns in `CLAUDE.md`?
- Are the stories small enough for a single agent session?
- Did it account for B2B AND B2C use cases?

**Step 5: Bridge to Beads**

```bash
# For each story in _bmad-output/epics/:
bd create "<story title>" -t task -p <priority> \
  --description "<acceptance criteria>" --json
bd dep add <story-id> <blocker-id> --type blocks
```

### Revision

```
/bmad-revise-prd
/bmad-revise-architecture
```

### Story Detail (complex implementation)

```
/bmad-create-story         # → docs/stories/story-X.md
```

---

## Marketing & Go-to-Market

### GTM Planning Space

| What | Where |
|------|-------|
| Brand brief | `docs/50-market/brand-brief.md` |
| Value proposition | `docs/50-market/customer-centric-crm-value-prop.md` |
| PLG strategy | `docs/70-PLG/nurture/plan.md` |
| Email sequences | `docs/70-PLG/nurture/email-sequences.md` |
| CRM dogfood plan | `docs/90-roadmap/crm-dogfood-kickoff.md` |

### Dogfooding Discipline

UpSight IS the CRM. Use it daily:

1. Every sales/discovery call → upload to UpSight
2. Every contact → create in People (not a spreadsheet)
3. Every deal → track in Opportunities
4. Weekly: review pipeline in Opportunities kanban
5. Monthly: review what CRM features are missing → feed into BMad spec queue

---

## Editing in bv (Beads Viewer TUI)

Run `bv` (no flags) to launch the interactive TUI:

### Navigation
| Key | Action |
|-----|--------|
| `↑/↓` or `j/k` | Move through issues |
| `Enter` | Expand/collapse issue details |
| `Tab` | Switch panels (list ↔ details) |
| `/` | Search/filter |
| `q` | Quit |

### Editing
| Key | Action |
|-----|--------|
| `e` | Edit selected issue (opens in $EDITOR) |
| `s` | Change status (cycles: open → in_progress → closed) |
| `p` | Change priority (0-4) |
| `t` | Change type (task/bug/feature/epic/chore) |
| `l` | Add/remove labels |
| `d` | Add dependency |
| `c` | Add comment |
| `n` | New issue |

### Useful Filters
| Command | Shows |
|---------|-------|
| `/status:open` | Only open issues |
| `/type:epic` | Only epics |
| `/label:auth` | Issues with auth label |
| `/ready` | Issues with no blockers |

### Quick Workflow in bv
```
1. Launch: bv
2. Press / and type "ready" to see unblocked work
3. Arrow to the one you want
4. Press s to mark "in_progress"
5. Press q to exit and start coding
6. When done: bv again, find issue, press s twice (→ closed)