# Agentic AI System Planning Guide

Technical guidance for designing production agentic AI systems that interact with humans, databases, and tools for CRM, marketing, and customer service applications.

---

## Core Architecture Principle

**Use workflows for deterministic paths. Use agents only where genuine flexibility is required.**

```
DECISION RULE:
- Steps predictable and understood -> WORKFLOW (deterministic code paths)
- Path genuinely varies based on intermediate results -> AGENT (LLM autonomy)
- Default to simplest solution: single LLM call > workflow > multi-agent
```

---

## Orchestration Patterns

### 1. Sequential Orchestration
**Use when:** Linear dependencies, progressive refinement, predictable workflow progression.  
**Structure:** Agent1 -> Agent2 -> Agent3 -> Result  
**Key rule:** Next agent choice is deterministic (code-defined), not agent-decided.

### 2. Concurrent Orchestration (Fan-out/Fan-in)
**Use when:** Tasks parallelizable, multiple independent perspectives needed, time-sensitive.  
**Structure:** Input -> [Agent1, Agent2, Agent3] -> Aggregator -> Result  
**Key rule:** Agents operate independently with separate context windows.

### 3. Handoff Orchestration
**Use when:** Optimal agent unknown upfront, expertise requirements emerge during processing.  
**Structure:** Agent1 <-> Agent2 <-> Agent3 (dynamic transfer)  
**Key rule:** Full control transfers; agents do not work in parallel.

### 4. Orchestrator-Worker Pattern (Recommended for complex tasks)
**Use when:** Open-ended problems, dynamic task decomposition, parallel information gathering.  
**Structure:** Lead Agent coordinates -> Specialized Subagents execute -> Lead synthesizes  
**Key rule:** Lead agent plans, delegates with explicit objectives, output formats, tool guidance, and task boundaries.

---

## Tool Design Rules

### Consolidation Principle
Tools should consolidate functionality around semantic actions, not mirror API endpoints 1:1.

```
BAD:  list_users, list_events, create_event (3 tools)
GOOD: schedule_event (finds availability + schedules) (1 tool)

BAD:  read_logs (returns all logs)
GOOD: search_logs (returns relevant lines + context)

BAD:  get_customer_by_id, list_transactions, list_notes (3 tools)
GOOD: get_customer_context (compiles all relevant info) (1 tool)
```

### Tool Response Design

1. **Return semantic identifiers over UUIDs**
   - BAD: {"id": "a1b2c3d4-e5f6-..."}
   - GOOD: {"id": 0, "name": "Jane Smith"}

2. **Implement response_format parameter**
   ```typescript
   enum ResponseFormat {
     DETAILED = "detailed",  // Full data + IDs for downstream tool calls
     CONCISE = "concise"     // Natural language summary only
   }
   ```

3. **Token efficiency controls**
   - Implement pagination, filtering, truncation with sensible defaults
   - Cap tool responses (~25,000 tokens max recommended)
   - Truncated responses should include instructions: "Use filters to narrow results"

4. **Error responses must be actionable**
   - BAD: {"error": "INVALID_PARAM", "code": 400}
   - GOOD: {"error": "Invalid date format. Expected: YYYY-MM-DD. Example: 2025-01-15"}

### Tool Definition Rules

1. **Fewer than 20 tools** at any time (soft limit)
2. **Unambiguous parameter names**: user_id not user
3. **Use enums to make invalid states unrepresentable**
4. **Pre-fill known arguments** in orchestration code - do not make model guess
5. **Namespace tools** when many exist: asana_projects_search, asana_users_search
6. **Pass the intern test**: Could someone use this tool correctly with only the description?

See `docs/30-howtos/mastra-tools/tool-contracts.md` for the Upsight tool contract template.

---

## Structured Output Requirements

All LLM interactions must use typed contracts. Benefits:
- Eliminates parsing errors
- Enables type-safe streaming
- Provides compile-time guarantees across agent boundaries
- Works across model providers without API-specific code

### Schema Design
- Define input/output types for every agent function
- Use enums for constrained choices
- Include field descriptions in schema
- Validate all outputs against schema before use

---

## Orchestrator Prompt Engineering

### Required Elements for Subagent Delegation

When lead agent delegates to subagent, provide:
1. **Objective**: Clear goal statement
2. **Output format**: Expected structure of response
3. **Tool guidance**: Which tools to use, which to avoid
4. **Task boundaries**: What is in scope, what is not
5. **Effort budget**: Expected number of tool calls

### Effort Scaling Rules

Embed explicit scaling guidance in orchestrator prompts:

| Task Complexity | Subagents | Tool Calls per Agent |
|-----------------|-----------|----------------------|
| Simple fact-finding | 1 | 3-10 |
| Direct comparison | 2-4 | 10-15 each |
| Complex research | 5-10+ | Clearly divided |

### Search Strategy Guidance

Include in prompts:
- "Start with short, broad queries"
- "Evaluate what is available before drilling into specifics"
- "Progressively narrow focus based on results"

Agents default to overly long, specific queries that return few results.

---

## Failure Modes and Mitigations

### Common Failures

| Failure Mode | Symptom | Mitigation |
|--------------|---------|------------|
| Context overflow | Agent forgets earlier steps, drifts off-topic | Summarize completed phases, store in external memory |
| Hallucination cascade | Agent1 hallucinates -> Agent2 accepts -> Agent3 reinforces | Add verification checkpoints, ground in tool results |
| Infinite loops | Agent keeps calling same tools, no progress | Implement max iterations, detect repeated actions |
| Tool selection errors | Wrong tool, wrong params, too few calls | Improve tool descriptions, add examples |
| Agent drift | Works perfectly sometimes, fails on similar inputs | Add comprehensive test cases, monitor patterns |

### Required Safeguards

```
EVERY AGENT SYSTEM MUST IMPLEMENT:
├── Timeout mechanisms (per tool call and per task)
├── Retry logic with exponential backoff
├── Circuit breakers for external dependencies
├── Graceful degradation paths
├── Error surfacing (not hiding) for downstream handling
├── Checkpointing for resume-from-failure
└── Human escalation triggers
```

### Reliability Architecture

```
Client
  ↓
Backend-for-Frontend
  ↓
AI Orchestrator Layer
├── Prompt Assembly
├── Context Retrieval
├── Tool Execution
├── Response Validation
├── Cost Guards
├── Caching
  ↓
Model Providers
  ↓
Post-Processing & Schema Validation
```

**Critical rule:** LLMs are unreliable subsystems. Never call directly from core business API.

---

## State Management

### Context Window Management

- Multi-agent systems use ~15x more tokens than single-turn chat
- Agent token usage explains 80% of performance variance
- When context limit approaches: summarize, store externally, spawn fresh subagent with clean context

### Checkpointing Strategy

1. Checkpoint after each significant state change
2. Store: current plan, completed steps, intermediate results, error history
3. Design agents to resume from checkpoint, not restart
4. Use durable execution framework (Temporal, Inngest) for long-running workflows

### Shared State Rules

- Avoid mutable shared state between concurrent agents
- If unavoidable: implement optimistic locking or last-write-wins with conflict detection
- Prefer message passing over shared memory

---

## Human-in-the-Loop Design

### When to Require Human Input

- Confidence score below threshold
- High-stakes decisions (financial, legal, customer-facing)
- Edge cases outside training distribution
- Destructive operations (deletes, bulk updates)
- Escalation signals detected in conversation

### Integration Patterns

1. **Approval gates**: Pause workflow, present plan, wait for approval
2. **Confidence routing**: Low confidence -> human queue; high confidence -> auto-proceed
3. **Hybrid execution**: AI drafts, human reviews, AI finalizes
4. **Override capability**: Human can redirect agent at any checkpoint

---

## Observability Requirements

### Minimum Instrumentation

```
FOR EVERY AGENT INTERACTION, LOG:
├── Input (prompt, context, tools available)
├── Tool calls (name, params, response, latency)
├── Model calls (model, tokens in/out, latency, cost)
├── Agent reasoning (if using CoT/extended thinking)
├── Output (final response, confidence)
├── Errors (type, message, recovery action)
└── Handoffs (from agent, to agent, reason)
```

### Evaluation Strategy

1. **Start immediately with small samples** (~20 test cases)
2. **Generate realistic tasks** from production patterns, not toy examples
3. **Use LLM-as-judge** for free-form outputs with clear rubric
4. **Human evaluation** catches edge cases automation misses
5. **Track**: accuracy, tool call counts, token usage, latency, error rates
6. **Hold out test set** to detect overfitting

### Meta-optimization

Use the same LLM to analyze failure transcripts and suggest tool/prompt improvements. This can yield 40%+ improvement in task completion time.

---

## Security Constraints

```
SECURITY RULES:
├── Authenticate agent-to-agent communication
├── Implement least-privilege per agent (only tools it needs)
├── Security-trim all data access to user's permissions
├── Audit trail for all tool invocations
├── Sanitize all user input before tool parameters
├── Rate limit tool calls to prevent runaway costs
└── Never expose raw API keys to agent context
```

---

## Decision Framework Summary

```
PLANNING CHECKLIST:

□ Can a single LLM call with tools solve this?
  -> YES: Do not over-engineer. Use single agent.
  -> NO: Continue.

□ Are the steps predictable and linear?
  -> YES: Use WORKFLOW with deterministic routing.
  -> NO: Continue.

□ Can steps run in parallel independently?
  -> YES: Use CONCURRENT orchestration.
  -> NO: Continue.

□ Does optimal path emerge during execution?
  -> YES: Use HANDOFF or ORCHESTRATOR-WORKER pattern.

□ For each tool:
  - Does it consolidate related operations?
  - Does it return semantic (not cryptic) identifiers?
  - Is the description unambiguous?
  - Are error messages actionable?

□ For the system:
  - Are all outputs schema-validated?
  - Are timeouts and retries implemented?
  - Is there a human escalation path?
  - Is every step logged for debugging?
```

---

## Anti-Patterns to Avoid

1. Over-agentic design: using agents where simple code suffices
2. API-mirroring tools: 1:1 mapping of REST endpoints to tools
3. Context hoarding: passing full history when summary suffices
4. Silent failures: swallowing errors instead of surfacing them
5. Prototype-as-production: shipping demo architecture to production
6. Shared mutable state between concurrent agents without coordination
7. Missing observability: tracking only final outcomes, not intermediate steps
8. Unbounded loops: no max iterations or progress detection
9. Overloaded prompts: mixing too many responsibilities without decomposition
10. Rigid tool responses: not adapting verbosity to task needs

---

## Integration Notes (Upsight)

- **Mastra agents**: `app/mastra/agents/*` are the primary execution units.
- **Tooling**: `app/mastra/tools/*` should follow semantic tool design and include response controls.
- **BAML**: contracts live in `baml_src/*` and should be the default for agent/tool outputs.
- **Workflows**: deterministic orchestration lives in `app/mastra/workflows/*`.
- **Async tasks**: long-running work should use Trigger.dev (`src/trigger/*`).
- **Observability**: Langfuse tracing is used in `app/routes/api.chat.*` handlers.

---

## Current Audit: projectStatusAgent (Jan 2025)

**Snapshot**
- Tool count is 47, exceeding the soft limit (<20) and mixing retrieval, CRUD, ingestion, and web research.
- The orchestrator is doing both planning and execution, increasing context size and cost.
- Several tools should be delegated to specialists or moved into deterministic workflows.

**Primary Issues**
- Overloaded prompt and tool surface violate the consolidation principle.
- Tool outputs are inconsistent on `response_format` and some actions are too granular.
- Read vs write responsibilities are not separated at the agent level.

**Target Tool Budget (Lean Orchestrator)**
- Orchestrator tools (keep ~9):
  - `fetchProjectStatusContext`, `recommendNextActions`
  - `semanticSearchEvidence`, `searchSurveyResponses`
  - `generateProjectRoutes`, `navigateToPage`
  - `capabilityLookup`, `suggestNextSteps`, `getCurrentDate`

**Delegation Plan (Specialists)**
- PeopleAgent: `fetchPeopleDetails`, `semanticSearchPeople`, `upsertPerson`, `upsertPersonFacets`, `managePeople`, `managePersonOrganizations`, `fetchPersonas`
- ResearchAgent: `fetchEvidence`, `fetchThemes`, `fetchSegments`, `fetchPainMatrixCache`, `fetchConversationLenses`, `fetchProjectGoals`
- DocsAndDataAgent: `manageDocuments`, `generateDocumentLink`, `saveTableToAssets`, `updateTableAsset`, `parseSpreadsheet`, `importPeopleFromTable`, `importOpportunitiesFromTable`
- WebResearchAgent: `fetchWebContent`, `webResearch`, `findSimilarPages`, `researchOrganization`
- OpsAgent: `manageInterviews`, interview prompts, `manageAnnotations`, `createOpportunity`, `updateOpportunity`, `fetchOpportunities`, `createSurvey`
- TaskAgent: task tools as-is

**Workflow vs Agent Decisions**
- Workflow (deterministic):
  - Spreadsheet import: parse -> confirm mapping -> import -> summarize
  - Survey creation: draft -> createSurvey -> navigate -> summarize
  - Deletions: list candidates -> dry-run -> confirm -> execute
  - URL ingest: classify URL -> fetch/import -> save -> summarize
- Agent (flexible):
  - “What should I do next?” synthesis over project state
  - Evidence synthesis and theme prioritization
  - Exploration queries across evidence/people/segments

**Expected Outcomes**
- Smaller prompts and tool sets for faster routing and lower cost.
- Clear separation of read vs write responsibilities.
- Safer execution with deterministic workflows for high-risk paths.
