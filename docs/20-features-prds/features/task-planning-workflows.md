# Task Planning Workflows (Long-Term + Weekly + Daily)

This document defines two workflows that use the task system to give users a long-term plan plus weekly/daily focus, and to generate follow-ups after meetings or events.

---

## Lightweight Mode (Now)

We are optimizing for speed and low overhead. No capacity/velocity modeling yet.

**Rules:**
- Weekly plan: 5-10 tasks max
- Daily plan: 3-5 tasks max
- Only use `priority=1` and `status=todo` unless user requests otherwise
- Skip blocked tasks or tasks with dependencies
- If user wants more/less, use an **energy level** control (low/medium/high) to adjust the cap

**Energy level storage (optional):**
- Store in `projects.project_settings.task_planning.energy_level`

We will add capacity/velocity only after we have consistent effort estimates and assignment data.

---

## Workflow 1: Task Planning (Horizon -> Week -> Day)

### Goal
Give users longer-term visibility (quarter/month) and a concrete weekly/daily plan built from existing tasks, project context, and status signals.

### Trigger
- User asks: "Plan my next month", "What should we do this week", "Daily focus".
- Scheduled cadence: weekly planning on Monday; daily plan each morning.

### Inputs
- Project goals and sections (`fetchProjectGoals`, `fetchProjectStatusContext`).
- Existing tasks (`fetchTasks`, `fetchFocusTasks`).
- Status/context: themes, evidence, opportunities, and risk signals.

### Outputs
- **Horizon plan** parent task (e.g., "Q2 Plan") with 3-5 outcome tasks.
- **Weekly plan** parent task (e.g., "Week of 2025-02-10") with 5-10 ready tasks.
- **Daily plan** parent task (e.g., "Today 2025-02-12") with 3-5 tasks.

### Storage Model (How Plans Live in the System)

We store plans using the existing `tasks` table:

- Create **parent plan tasks** for each horizon:
  - `title`: "Q2 2025 Plan" / "Week of 2025-02-10" / "Today 2025-02-12"
  - `tags`: `plan:horizon`, `plan:weekly`, `plan:daily`
  - `status`: `todo`
  - `priority`: 2 for horizon, 1 for weekly/daily
  - `cluster`: use the same cluster as the dominant child tasks or `Other`

- Create **child tasks** by setting `parent_task_id` to the plan task ID.
  - Child tasks can also exist independently; when pulled into a plan, set `parent_task_id`.

This keeps all planning data in a single table with no new schema.

### Agent-Runnable Tasks

We can mark specific tasks as safe for automation and let agents run them on a cadence.

**Conventions (lightweight):**
- Add an **agent assignee**: `assigned_to: [{ type: "agent", agent_type: "research" | "documentation" | ... }]`
- Add a **workflow tag**: `workflow:daily-brief`, `workflow:daily-closeout`
- Optional tag: `agent:runnable`

**Execution rule:**
- A scheduled job (Trigger.dev) picks tasks with `status=todo`, `due_date=today`, and `workflow:*` tags.
- Only read-only workflows auto-run by default. Writes require confirmation.

This requires no new schema and works with existing `assigned_to` and `tags`.

### Recurring Tasks (Weekdays / Weekly)

For recurring tasks, we will keep it lightweight and store the recurrence templates in `projects.project_settings`.

**Storage (no new tables):**
```
project_settings.task_planning.recurring = [
  {
    "title": "Daily brief",
    "schedule": "weekday",
    "workflow_key": "daily-brief",
    "agent_type": "documentation",
    "tags": ["workflow:daily-brief", "agent:runnable"],
    "cluster": "Ops & Scale",
    "priority": 1
  }
]
```

**Materialization:**
- A Trigger.dev cron creates actual tasks each morning (weekday) from these templates.
- Those tasks are attached to the daily plan via `parent_task_id`.

This keeps recurring logic out of the UI until needed, and avoids new tables.

### Linear Plan (Date-Less) + Scheduled Plan (Dated)

We support two views from the same task set:

1. **Linear plan (no dates)**  
   - Order tasks by dependency (`depends_on_task_ids`) using a topological sort.  
   - Show blockers inline and mark tasks that are not yet actionable.  
   - This is the default planning view when users want a clear sequence.

2. **Scheduled plan (with dates)**  
   - Use the linear order and apply a daily cap (3-5 tasks/day by default).  
   - Assign `due_date` only after user confirms the schedule.  
   - If the user changes energy level (low/medium/high), regenerate dates.

This keeps the plan grounded in dependencies without forcing dates until the user accepts a schedule.

### Task Structure

```
Q2 2025 Plan (parent)
  - Outcome: Validate pricing sensitivity (child)
  - Outcome: Improve onboarding completion (child)
  - Outcome: Expand sales pipeline (child)

Week of 2025-02-10 (parent)
  - Draft pricing survey (child)
  - Schedule 3 interviews (child)
  - Update sales deck (child)

Today 2025-02-12 (parent)
  - Send recap to Acme (child)
  - Draft pricing survey (child)
  - Review interview notes (child)
```

Use:
- `parent_task_id` to represent hierarchy.
- `tags` to mark scope: `plan:horizon`, `plan:weekly`, `plan:daily`.
- `priority`: 1 for daily/weekly, 2 for horizon, 3 for backlog.

### Selection Rules

1. **Horizon plan**
   - 3-5 outcomes tied to project goals or high-impact themes.
   - Outcomes become parent tasks with `priority=2`.

2. **Weekly plan**
   - Pull from ready tasks with `priority=1` or `status=todo`.
   - Exclude blocked tasks or tasks with open dependencies.

3. **Daily plan**
   - Choose 3-5 tasks max.
   - Prefer short or medium effort (S/M) and tasks due today.
   - Ensure one task advances a long-term outcome.

### Safety
- Propose plan first. Ask for confirmation before creating or updating tasks.
- Edits follow the standard two-step confirmation for destructive changes.

### Success Criteria
- User can see a quarterly/monthly plan at a glance.
- Weekly plan is always actionable (no blocked tasks).
- Daily plan is realistic (<= 3-5 tasks).

---

## Workflow 2: Follow-up With Client (Meeting/Event)

### Goal
Generate follow-up tasks after meetings or events (meeting, new feature release, decision request).

### Trigger
- Meeting completed (manual or automated).
- New feature release that a client asked for.
- User asks: "Create follow-ups from this meeting".

### Inputs
- Meeting summary or notes (document or transcript).
- Attendees (people records).
- Related opportunity or account context.
- Feature request history (themes or tasks).

### Outputs
- A **Follow-up** parent task with time-bound child tasks.
- Links and context embedded in task descriptions.

### Default Task Set (Meeting)

Create a parent task:
```
Follow-up: <Meeting Name> (parent)
```

Then add:
- Send recap email (due in 24h).
- Share promised materials (due in 48h).
- Schedule next step (if needed).
- Update opportunity stage / next steps.
- Log key decisions and risks.

### Default Task Set (Feature Release)

Create a parent task:
```
Follow-up: <Feature Release Name> (parent)
```

Then add:
- Notify interested clients (due in 24h).
- Update docs or release notes (due in 48h).
- Schedule feedback check-in (7-14 days).
- Capture adoption signals (if metrics available).

### Safety
- Ask for confirmation before creating tasks.
- Never auto-update opportunities without explicit intent.

### Success Criteria
- Follow-up tasks are created within 24 hours of a meeting.
- Each task has a due date and clear owner.
- Client-facing steps always exist (recap, next step, feedback).

---

## Implementation Notes

- Use `manageTasks` to create/update tasks.
- Use `generateProjectRoutes` to embed links in task descriptions.
- Tag follow-ups with `followup`, `meeting`, or `feature-release`.
- Keep task descriptions short and reference source documents by link.
- Recurring templates live in `projects.project_settings.task_planning.recurring`.

## UI Notes (Sequence + Schedule)

Provide two plan views for the same plan:

- **Sequence view** (default): ordered list with dependency indicators.  
  - Each item shows: status, dependency chain, and "blocked by" chips.
  - No dates shown.

- **Schedule view**: calendar or timeline with auto-assigned dates.  
  - Show the daily task cap and allow an "energy level" toggle.
  - Dates are editable and can be applied to tasks on confirmation.
