# Agents & Automation Index

**Audience:** Anyone invoking agents or automation workflows.

This is the landing pad for every AI agent, automation workflow, or CopilotKit action that touches discovery data. Use this index to understand what's live and where to find detailed guidance.

## Purpose

Single entry point for agents to understand:
- What agents exist and their current status
- Where to find implementation patterns and conventions
- Load order for documentation

## Load Order

When starting work, read documentation in this order:

1. **This file** (`agents.md`) - Understand what exists and where to look
2. **`CLAUDE.md`** (root) - Global rulebook for all AI/humans with tech stack and patterns
3. **`agents/implementation.md`** - Detailed playbook for builders (patterns, checklists, conventions)
4. **`docs/plan.md`** - Product roadmap, PRDs, and positioning documents

## Agent Catalog & Status

| Agent / Workflow | Purpose | Status | Documentation |
| --- | --- | --- | --- |
| `projectStatusAgent` | Answers discovery progress questions, suggests next steps | ✅ Live | `agents/implementation.md` |
| `insightsAgent` + `dailyBriefWorkflow` | Synthesizes insights, surfacing high-vote findings | ✅ Live | `agents/implementation.md` |
| `projectSetupAgent` | Onboarding journey: collects 8 setup questions, auto-generates research structure | ✅ Live | `agents/implementation.md` |
| Legacy helpers | Historical workflows | 💤 Dormant | Archived |

## Key Documentation Links

### For Builders
- **`agents/implementation.md`** - Comprehensive patterns, checklists, and conventions
- **`CLAUDE.md`** - Tech stack, coding conventions, quick reference
- **`docs/supabase-howto.md`** - Database schema workflow and migrations
- **`docs/deploy-howto.md`** - Deployment and release checklists

### For Planners
- **`docs/plan.md`** - Product roadmap, PRDs, and positioning
- **`docs/_task-board.md`** - Current task board
- **`docs/_information_architecture.md`** - System-wide IA and data model

### Specialized Topics
- **Conversation Lenses:** `docs/features/conversation-lenses/`
- **Task System:** `docs/features/task-system-technical-design.md`
- **Interview Processing:** `docs/interview-processing-explained.md`
- **Testing:** `docs/testing-howto.md`

## Quick Start

**New to the codebase?**
1. Read `CLAUDE.md` for tech stack overview
2. Read `agents/implementation.md` for patterns
3. Check `docs/plan.md` for product roadmap and PRDs

**Adding a feature?**
1. Check `docs/plan.md` for PRD and implementation plan
2. Follow checklist in `agents/implementation.md`
3. Document new patterns in `agents/implementation.md`

**Working with agents?**
1. Check agent status in table above
2. Review `docs/plan.md` for product direction
3. Coordinate tasks via `docs/_task-board.md`
