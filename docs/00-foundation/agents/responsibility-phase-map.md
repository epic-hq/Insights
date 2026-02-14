# Agent Responsibility Phase Map

This document maps current agent responsibilities to the phased target architecture.

## Current (as of 2026-02-08)

| Agent | Current Role | Current Risks |
|------|--------------|---------------|
| `projectStatusAgent` | Primary orchestrator plus broad synthesis and many direct tools | Largest prompt/tool surface, most context pressure, slower responses |
| `chiefOfStaffAgent` | Strategic next-step guidance and recommendation rules | Under-utilized for broader strategic routing (especially ICP) |
| `researchAgent` | Surveys, interview prompts, interview operations | Some execution still routed through orchestrator first |
| `peopleAgent` | People/persona search and updates | Not always first stop for people-heavy turns |
| `opsAgent` | Opportunities, org research, annotations | Pipeline/ops mixed with orchestrator reasoning |
| `taskAgent` | Task CRUD and completion | Good boundary already |
| `projectSetupAgent` | Setup intake and research-structure generation | Good boundary already |

## Target by Phase

### Phase 0: Routing + Cost Controls
- `projectStatusAgent`: Lightweight router + concise synthesis only.
- `chiefOfStaffAgent`: Fast standardized guidance for generic "what next/status" turns.
- Routing: LLM intent router (structured output), no regex routing.

### Phase 1: Standardized Guidance
- `chiefOfStaffAgent`: Default strategic worker for non-specific guidance.
- `projectStatusAgent`: Keep context pulls minimal (`status`, `sections`) unless detail requested.

### Phase 2: Capability Rebalancing
- Move heavy execution tools from `projectStatusAgent` to specialists:
  - Research execution -> `researchAgent`
  - People execution -> `peopleAgent`
  - Pipeline/org execution -> `opsAgent`
  - Task execution -> `taskAgent`
- Keep `projectStatusAgent` tool surface under the soft limit (`<20`, target 12-16).

### Phase 3: Proactive Intelligence
- `chiefOfStaffAgent`: Scheduled recommendations, stale-signal prompts, confidence-gap nudges.
- `projectStatusAgent`: Orchestrates only and renders linked actions.

### Phase 4: Memory + Learning
- `chiefOfStaffAgent`: Decision/outcome learning loop (`accepted`, `declined`, `deferred`) and personalization.
- Orchestrator layer: thread rotation + summary compaction to control token growth.

## ICP Reasoning Placement

### Now
- ICP strategy lives in `chiefOfStaffAgent`:
  - Who to interview next
  - Where ICP confidence is weak
  - What to validate before decisions

### Later
- Promote to dedicated `icpStrategyAgent` only if ICP becomes a standalone workflow domain with:
  - Distinct memory scope
  - Distinct tool surface
  - Distinct UI/API entry points

## Decision Rules

1. Keep `projectStatusAgent` thin.
2. Push deep strategic reasoning to `chiefOfStaffAgent`.
3. Push data mutations/execution into domain specialists.
4. Add agents only when memory + tool + UX boundaries are clearly separate.
