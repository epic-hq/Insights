# Agent Workflows

## The Loop

```
Idea → Spec → Beads → Triage → Implement → Close → Push
```

```
Your idea
    ↓
/bmad-quick-spec  OR  /bmad-create-prd → architecture → stories
    ↓
_bmad-output/*.md (committed to git)
    ↓
bd create (bridge specs to Beads issues)
    ↓
bv --robot-triage → pick top task → implement → bd close → repeat
```

---

## 1. Spec with BMad

### Quick Spec (features < 15 stories)

```
/bmad-quick-spec
```

Produces: single `tech-spec.md` with requirements + stories.

### Full Spec Flow (major features)

Run in order, each in a **fresh session**:

```
/bmad-create-prd           # → _bmad-output/PRD.md
/bmad-create-architecture  # → _bmad-output/architecture.md
/bmad-create-stories       # → _bmad-output/epics/*.md
```

### Story Detail (complex implementation)

```
/bmad-create-story         # → docs/stories/story-X.md
```

### Revision

```
/bmad-revise-prd
/bmad-revise-architecture
```

### Context Loading

Before any BMad command, load existing product context:

```
Read docs/_information_architecture.md, docs/_lens-based-architecture-v2.md,
and docs/interview-processing-explained.md for existing product context.
Then run /bmad-quick-spec for: [your feature]
```

| Document | Contains |
|----------|----------|
| `docs/_information_architecture.md` | System-wide IA, entity relationships |
| `docs/_lens-based-architecture-v2.md` | Conversation lens design |
| `docs/interview-processing-explained.md` | Core processing pipeline |
| `docs/features/*/PRD.md` | Existing feature specs |

---

## 2. Bridge Specs to Beads

After BMad generates specs, convert stories to trackable issues:

```bash
# For each story in _bmad-output/epics/:
bd create "<story title>" -t task -p <priority> \
  --description "<acceptance criteria>" --json

# Add dependencies between stories
bd dep add <story-id> <blocker-id> --type blocks
bd dep add <story-id> <epic-id> --type parent-child
```

---

## 3. Work with Beads

Issues stored in `.beads/`, tracked in git. **⚠️ Never run bare `bv`** — it launches an interactive TUI that blocks agent sessions.

### Triage (start here)

```bash
bv --robot-triage                # Ranked recommendations, blockers, quick wins
bv --robot-triage --format toon  # Token-optimized output for LLMs
bv --robot-next                  # Single top pick + claim command
```

### The Work Cycle

```bash
# 1. Find work
bd ready                                          # Unblocked issues

# 2. Claim
bd update <id> --status in_progress --json

# 3. Implement the task

# 4. Complete
bd close <id> --reason "Implemented: <description>" --json

# 5. Sync
bd sync
```

### Issue Management

```bash
bd list --status=open             # All open issues
bd show <id>                      # Full details with dependencies
bd create --title="..." --type=task --priority=2
bd dep add <issue> <depends-on>   # Add dependency
bd close <id1> <id2>              # Close multiple at once
```

### Issue Types & Priority

- **Types**: `epic`, `task`, `bug`, `feature`, `chore`, `question`, `docs`
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers)

### Advanced Triage Commands

| Command | Returns |
|---------|---------|
| `--robot-plan` | Parallel execution tracks with `unblocks` lists |
| `--robot-priority` | Priority misalignment detection |
| `--robot-alerts` | Stale issues, blocking cascades |
| `--robot-suggest` | Hygiene: duplicates, missing deps, cycle breaks |
| `--robot-insights` | Full graph metrics: PageRank, betweenness, critical path, cycles |
| `--robot-label-health` | Per-label health: healthy/warning/critical |

```bash
# Scoping
bv --robot-plan --label backend              # Scope to label
bv --recipe actionable --robot-plan          # Only unblocked work
bv --recipe high-impact --robot-triage       # Top PageRank scores
bv --robot-triage --robot-triage-by-track    # Group by work streams
```

---

## 4. Session Completion (MANDATORY)

**Work is NOT complete until `git push` succeeds.**

```bash
# 1. File issues for remaining work
bd create --title="..." --type=task --priority=2

# 2. Run quality gates (if code changed)
# Tests, linters, builds

# 3. Close finished work
bd close <id> --reason="Completed"

# 4. Capture lessons learned
# If you discovered a quirk, workaround, or pattern during this session:
#   - Critical (many features): Add to CLAUDE.md "Technical Lessons" section
#   - Detailed (needs write-up): Add to docs/30-howtos/development/lessons-learned.md
#   - Workflow change: Update this file or create a bead

# 5. Push to remote (MANDATORY)
git add <files>
git commit -m "..."
bd sync
git pull --rebase
git push
git status  # MUST show "up to date with origin"
```

---

## 5. Mastra Agent Tools

Located in `app/mastra/agents/` and `app/mastra/tools/`.

### Tool Implementation Rules

1. **No static `~/` imports** at top of tool files
2. **Use dynamic imports** inside `execute()`:

```typescript
execute: async (input) => {
  const { supabaseAdmin } = await import("~/lib/supabase/client.server");
}
```

3. External packages (`@mastra/core`, `zod`) can use static imports
4. Relative imports within `app/mastra/` are fine
