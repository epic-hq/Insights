# Strategic Analysis: Agentic System Architecture

## The Core Insight

The feedback isn't asking for "survey question generation" - it's asking for an **intelligent guide** that:
- Knows where the user is in their journey
- Proactively suggests what to do next
- Delegates work to specialized capabilities
- Returns with synthesized answers

This is fundamentally different from building features. It's building an **orchestration layer** that can:
1. Assess state → Diagnose where the user is
2. Plan → Determine what would help most
3. Execute → Delegate to the right capability
4. Synthesize → Return actionable insight

---

## Decision Rules: Workflow vs Agent

**Core principle:** Use workflows for deterministic paths. Use agents only where genuine flexibility is required.

```
DECISION RULE:
- Steps predictable and understood → WORKFLOW (deterministic code paths)
- Path genuinely varies based on intermediate results → AGENT (LLM autonomy)
- Default to simplest solution: single LLM call > workflow > multi-agent
```

---

## Opinionated Direction (2025)

This is the operating stance for Upsight right now. It is intentionally restrictive.

### We will do this
- **Workflow-first orchestration** for any predictable path (setup, enrichment, data updates).
- **Single orchestrator** (projectStatusAgent) with capability tools for most user intents.
- **Dedicated setup agent** (projectSetupAgent) for guided goal capture only.
- **Capability tools over new agents** unless a domain needs a distinct memory, prompt, and tool set.
- **Trigger.dev for long-running work**, not in-chat loops.
- **Tool contracts required** for all new tools (see `docs/30-howtos/mastra-tools/tool-contracts.md`).
- **BAML contracts for LLM I/O** whenever outputs are used by code.

### We will not do this (yet)
- **No agent swarm / agent-to-agent delegation** until we have audited tool contracts, traceability, and explicit handoff routing.
- **No direct agent writes to core DB tables** outside vetted tools.
- **No adding tools without response_format + output schema** for new work.

### When a new agent is justified
Create a new agent only if all are true:
1. Needs a distinct system prompt and long-lived memory scope.
2. Requires a specialized, small tool set (not a subset of projectStatusAgent).
3. Has a dedicated UI entry point or API contract.

---

## Operating Policies (Upsight)

These are enforceable defaults for this repo:

1. **Read-first behavior**: internal search tools must run before any external research.
2. **Write actions require explicit intent**: no writes unless the user asks or confirms.
3. **Destructive actions are two-step**: list candidates -> dry run -> confirm -> execute.
4. **Links are mandatory**: any referenced record must include a URL from tools.
5. **Tool contract compliance**: new tools must follow `docs/30-howtos/mastra-tools/tool-contracts.md`.
6. **Keep tool surfaces small**: new features should add tools to the smallest viable agent.

---

## Current Architecture Assessment

### What Exists
- **10 specialized agents** with distinct roles (Uppy, setup, interview, survey, etc.)
- **50+ tools** for data operations
- **Request context** for project/account/user scoping
- **Workflow system** for deterministic multi-step processes
- **Memory system** for per-agent state persistence

### What's Missing
- **Agent delegation**: Agents can't programmatically invoke other agents
- **Dynamic planning**: No reasoning about what agents/tools to use
- **Shared state**: Agents don't share working memory
- **Task orchestration**: No concept of "start this, wait for result, continue"

---

## Strategic Options

### Option A: Enhanced Single Agent (Current Path)
Keep Uppy as the "one agent to rule them all" with more tools and smarter prompts.

**Pros:**
- Simple architecture
- Single context/memory
- Works with current system

**Cons:**
- Token limits become a problem (already using 100K limiter)
- One agent can't be expert in everything
- Prompt engineering becomes unwieldy
- No parallel execution

**Verdict:** This is where you are now. It works but doesn't scale to the vision.

---

### Option B: Agent Swarm / Multi-Agent Delegation

Create an orchestrator agent that can spawn specialist agents for tasks.

```
┌────────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                      │
│   "I understand your goal. Let me coordinate help..."      │
├────────────────────────────────────────────────────────────┤
│                           │                                │
│    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│    │ Research │    │ Survey   │    │ Outreach │          │
│    │ Agent    │    │ Agent    │    │ Agent    │          │
│    └──────────┘    └──────────┘    └──────────┘          │
│         │              │               │                  │
│    "Found 3       "Created        "5 users match        │
│     themes"        survey"         criteria"             │
└────────────────────────────────────────────────────────────┘
```

**Implementation Pattern:**
1. Orchestrator receives user intent
2. Orchestrator reasons about which specialists to engage
3. Orchestrator delegates via tool that spawns sub-agent
4. Sub-agents execute with narrower context
5. Orchestrator synthesizes results

**Pros:**
- Specialists can be deeply expert
- Parallel execution possible
- Clean separation of concerns
- Each agent has smaller token budget

**Cons:**
- Coordination complexity
- Context passing between agents
- Debugging multi-agent flows
- Latency from multiple LLM calls

**Technical Requirement:**
```typescript
// New tool for orchestrator
const delegateToAgent = createTool({
  id: "delegate-to-agent",
  execute: async ({ agentId, task, context }) => {
    const result = await mastra.agents[agentId].generate(task, { context })
    return result.text
  }
})
```

---

### Option C: Workflow-First with Agent Steps

Use Mastra workflows as the orchestration layer, with agents as steps.

```
User: "Help me figure out what to do next"

Workflow: DetermineNextAction
├── Step 1: AssessState (agent call)
│   → "User has 5 interviews, 3 themes, no surveys yet"
├── Step 2: GenerateOptions (agent call)
│   → ["Validate themes", "Create survey", "Interview more"]
├── Step 3: RecommendAction (agent call)
│   → "Create survey to validate pricing theme"
└── Step 4: ExecuteOrAsk (conditional)
    → Return recommendation or start survey creation
```

**Pros:**
- Explicit control flow
- Each step has clear purpose
- State threading built-in
- Can mix deterministic + agentic steps

**Cons:**
- Less flexible than pure agent reasoning
- Requires pre-defined workflow for each scenario
- New use cases need new workflows

---

### Option D: Agentic Loop with Tool-Based Capabilities

Single orchestrator with "capability tools" that encapsulate complex behaviors.

```
┌─────────────────────────────────────────────────────────┐
│                   Orchestrator Agent                     │
│                                                         │
│  Tools:                                                 │
│  ├── assessProjectState()     → returns analysis       │
│  ├── recommendNextActions()   → returns options        │
│  ├── createSurvey()           → returns survey URL     │
│  ├── findTargetUsers()        → returns user list      │
│  ├── generateMarketingPlan()  → returns strategy       │
│  ├── analyzeCompetition()     → returns insights       │
│  └── planResearchRoadmap()    → returns roadmap        │
│                                                         │
│  Each tool internally uses:                             │
│  - Database queries                                     │
│  - LLM calls (as needed)                               │
│  - Trigger.dev tasks (for async work)                  │
└─────────────────────────────────────────────────────────┘
```

**Pattern:** "Fat tools" that encapsulate complex logic, including sub-agent calls.

**Pros:**
- Single agent context (simpler)
- Tools handle complexity
- Clean interface between orchestrator and capabilities
- Progressive enhancement (add tools as needed)

**Cons:**
- Tools become complex
- Still token-limited on orchestrator
- Not true delegation (synchronous)

---

## Recommended Architecture: Hybrid Approach

### Core Principle: **Orchestrator + Capability Agents + Async Workers**

**Decision:** Adopt Option C (workflow-first) + Option D (capability tools). Defer Option B (agent swarm) until tool contracts, observability, and handoff routing are fully enforced.

```
                    ┌─────────────────────────────┐
                    │     User Conversation        │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │     Orchestrator Agent       │
                    │  (Uppy - enhanced)           │
                    │                              │
                    │  Responsibilities:           │
                    │  - Understand intent         │
                    │  - Assess current state      │
                    │  - Decide what to delegate   │
                    │  - Synthesize results        │
                    │  - Maintain conversation     │
                    └──────────────┬──────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│  State Tool   │        │ Planning Tool │        │ Execution Tool│
│               │        │               │        │               │
│ assessState() │        │ recommend()   │        │ delegate()    │
│ diagnose()    │        │ prioritize()  │        │ create()      │
│ gaps()        │        │ roadmap()     │        │ schedule()    │
└───────┬───────┘        └───────┬───────┘        └───────┬───────┘
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐        ┌───────────────┐        ┌───────────────┐
│   Database    │        │   LLM Calls   │        │ Trigger.dev   │
│   Queries     │        │   (if needed) │        │ Async Tasks   │
└───────────────┘        └───────────────┘        └───────────────┘
```

### Key Architectural Decisions

1. **Single Orchestrator**: Uppy remains the primary conversational agent
2. **Capability Tools**: Complex behaviors wrapped in tools (not separate agents)
3. **Internal LLM Calls**: Tools can make LLM calls for analysis/generation
4. **Async Delegation**: Long-running work goes to Trigger.dev

---

## Production Requirements (Non-Negotiables)

### Tool Design Rules

1. **Consolidate tools around semantic actions**, not API endpoints (e.g., `getCustomerContext` over `getCustomerById` + `listNotes`).
2. **Return semantic identifiers**, not raw UUIDs, whenever possible.
3. **Add response verbosity controls** (e.g., `response_format: "concise" | "detailed"`).
4. **Token efficiency controls**: pagination, filtering, truncation with clear guidance.
5. **Actionable errors**: errors should explain what to fix and include examples.
6. **Soft limit: fewer than 20 tools** per agent context at once.
7. **Pre-fill known arguments** in orchestration code (don’t make the model guess).
8. **Pass the intern test**: a human should be able to use the tool correctly from its description.

### Tool Contract Standard (Upsight)

Every new tool must:
- Define `inputSchema` and `outputSchema` with Zod.
- Return `{ success, message, ... }` and **never** throw raw errors to the model.
- Include `responseFormat` (concise | detailed) or `limit` + truncation guidance.
- Resolve account/project via runtime context, not user input.
- Include linkable URLs in outputs when referencing records.

See `docs/30-howtos/mastra-tools/tool-contracts.md` for the full contract template.

### Structured Output Requirements (BAML)

All LLM interactions should use typed contracts:
- Define input/output types for every agent function.
- Use enums for constrained choices.
- Validate outputs against schema before use.
- Prefer BAML contracts for agent-to-agent and agent-to-tool boundaries.

### Reliability & Safety

**Required safeguards:**
- Timeouts (per tool call and per task)
- Retries with exponential backoff
- Circuit breakers for external dependencies
- Graceful degradation paths
- Error surfacing (don’t hide errors from downstream steps)
- Checkpointing for resume-from-failure
- Human escalation triggers

### Observability & Evaluation

Log and trace each agent run:
- Input, context, tools available
- Tool calls and responses
- Model usage (tokens, latency, cost)
- Output and confidence
- Errors and recovery actions

Evaluation basics:
- Start with ~20 realistic test cases.
- Track accuracy, tool call counts, token usage, latency, error rates.
- Use human review + LLM-as-judge with explicit rubric.

### Human-in-the-Loop Defaults

Require approval for:
- Destructive operations (deletes, bulk updates)
- High-stakes actions (customer-facing, legal, financial)
- Low-confidence outputs

### Security & Permissions

- Authenticate agent-to-agent communication.
- Implement least-privilege tool access per agent.
- Enforce user permissions for all data access.
- Record audit trails for tool invocations.
- Sanitize user input before tool parameters.
- Never expose API keys in agent context.

### State & Memory

- Summarize long histories and store externally when needed.
- Avoid shared mutable state between concurrent agents.
- Prefer message passing or immutable snapshots.

---

## Integration Notes (Upsight)

- **Mastra agents** live in `app/mastra/agents/*` and are orchestrated in `app/mastra/index.ts`.
- **Tools** live in `app/mastra/tools/*` and are wrapped by `wrapToolsWithStatusEvents` for UI progress.
- **BAML contracts** live in `baml_src/*` and should define all agent/tool outputs.
- **Workflows** live in `app/mastra/workflows/*` (deterministic orchestration).
- **Async work** should use Trigger.dev (`src/trigger/*`) for durable execution.
- **Observability** is via Langfuse in `app/routes/api.chat.*` handlers.

For a deeper operational checklist, see: `docs/architecture/agentic-system-planning-guide.md`.

---

## User Journey-Centric Design

Instead of features, think in **user journeys**:

### Journey: "I just started a project"
```
User: "I just created a project for my SaaS product"

Orchestrator assesses:
- Empty project (no interviews, no themes)
- Has account context (company description)

Orchestrator responds:
"Great! To get started, you'll want to gather initial customer insights.
I recommend:
1. **Run 3-5 discovery interviews** to understand customer pains
2. **Create a discovery survey** to reach more people quickly

Want me to help you prepare interview questions, or create a survey?"
```

### Journey: "I've done some interviews, now what?"
```
User: "I've done 5 interviews, what should I do next?"

Orchestrator assesses:
- 5 interviews completed
- 3 themes extracted (pricing, onboarding, support)
- 12 pieces of evidence
- No surveys yet

Orchestrator responds:
"Based on your 5 interviews, I've identified 3 emerging themes:
1. **Pricing concerns** (4 mentions) - needs validation
2. **Onboarding friction** (3 mentions) - actionable insight
3. **Support expectations** (2 mentions) - early signal

I recommend:
- **Validate pricing** with a targeted survey (you have enough signal)
- **Interview 2 more users** about onboarding (deepen understanding)

Want me to create a pricing validation survey?"
```

### Journey: "Help me reach the right users"
```
User: "Who should I talk to next?"

Orchestrator assesses:
- Current personas: CTOs, Engineers
- Gaps: No Product Managers interviewed yet
- Theme coverage: pricing validated by technical roles only

Orchestrator responds:
"You've talked to 3 CTOs and 2 Engineers, but haven't spoken with Product Managers yet.

This matters because:
- Your pricing theme has only technical validation
- PMs often influence buying decisions

I found 5 Product Managers in your CRM who haven't been interviewed.
Want me to help you prioritize who to reach out to?"
```

---

## Market Differentiation

### What Competitors Do
- **Dovetail**: Manual tagging, basic AI summaries
- **Notion AI**: General-purpose Q&A on docs
- **ChatGPT**: No domain knowledge, no state

### What This Architecture Enables

1. **State-Aware Guidance**
   - Knows exactly where you are in research journey
   - Recommendations based on actual project data
   - Not generic advice

2. **Proactive Intelligence**
   - Surfaces gaps before you ask
   - Identifies contradictions in evidence
   - Suggests actions based on patterns

3. **Seamless Delegation**
   - "Create a survey" → actually creates it
   - "Find users to interview" → actually searches CRM
   - No manual follow-up needed

4. **Learning Memory**
   - Remembers what you've validated
   - Tracks decision history
   - Builds on previous conversations

---

## Implementation Approach

### Phase 1: Foundation
1. Create `assessProjectState` tool - comprehensive state analysis
2. Create `recommendNextActions` tool - smart suggestions
3. Enhance Uppy instructions for state-aware responses

### Phase 2: Capability Expansion
4. Create `createSurveyFromRecommendation` tool
5. Create `findTargetUsers` tool
6. Create `generateMarketingInsights` tool

### Phase 3: Proactive Intelligence
7. Add scheduled state assessments
8. Surface recommendations in UI (not just chat)
9. Implement notification triggers

### Phase 4: Memory & Learning
10. Track user decisions and outcomes
11. Learn from patterns across users
12. Personalize recommendations

---

## Deep Dive: Memory & Learning Architecture

Memory is not an afterthought—it's architecture. As work shifts from single-turn chats to multi-step, tool-using workflows, continuity, auditability, and revocability become product requirements.

### Memory Types (Following Human Cognition)

| Type | Human Analog | Agent Use | Upsight Example |
|------|--------------|-----------|-----------------|
| **Working Memory** | Current focus | Active task state, scratchpad | Current survey being built |
| **Episodic Memory** | Experiences | Conversation history, action log | "User validated pricing theme last week" |
| **Semantic Memory** | Facts | User preferences, project facts | "Target market is SMB SaaS" |
| **Procedural Memory** | Rules/skills | Learned patterns, workflows | "User prefers detailed recommendations" |

### Current State (What We Have)

- **Thread-scoped memory**: Postgres-backed via `@mastra/memory`
- **Working memory**: `ProjectStatusMemoryState` schema
- **Token limiter**: 100K cap to prevent overflow
- **Thread key pattern**: `{agentType}-{userId}-{projectId}`

### Memory Patterns to Implement

#### 1. Sliding Window + Summary Hybrid
```
Approach: Keep last N turns verbatim + periodic summaries

Pros:
- Deterministic, no extra LLM calls for recent context
- Maintains fidelity for recent work
- Summaries provide long-range anchors

Cons:
- Summary drift over time
- Requires tuning compaction threshold

Implementation:
- Keep last 20 turns verbatim
- Every 50 turns, create summary checkpoint
- Store summaries in `project_memory_summaries` table
```

#### 2. Write-Ahead Activity Log
```
Approach: Append-only log of what happened, when, with which tool

Use when:
- Multi-step work spanning hours/days
- Handoffs between sessions
- Audit trail requirements

Schema:
{
  timestamp: string,
  action: string,
  tool_used: string | null,
  outcome: string,
  entities_affected: string[]
}
```

#### 3. Background Memory Consolidation
```
Approach: Extract memories as background task, not in hot path

Advantages:
- No latency in primary interaction
- Separates application logic from memory management
- More focused task completion

Trigger.dev task:
- After conversation ends (no messages for 5 min)
- Extract: user preferences, project facts, decisions made
- Store in cross-session memory namespace
```

### Memory Update Strategies

| Strategy | When to Use | Trade-offs |
|----------|-------------|------------|
| **Hot path** | Critical facts that must be remembered immediately | Adds latency, user sees delay |
| **Background** | Patterns, preferences, non-urgent facts | May miss context if session ends abruptly |
| **Batch** | Daily/weekly consolidation of episodic → semantic | Requires scheduled job, delay to availability |

### Cross-Session Personalization

```typescript
// Pseudocode for personalization injection
interface UserPreferences {
  communicationStyle: 'concise' | 'detailed'
  preferredActionLevel: 'recommend' | 'execute'
  expertiseLevel: 'beginner' | 'intermediate' | 'expert'
  recentTopics: string[]
}

// Inject at start of each session
const systemContext = `
User preferences:
- Prefers ${prefs.communicationStyle} responses
- Expertise: ${prefs.expertiseLevel}
- Recent focus: ${prefs.recentTopics.join(', ')}
- Action level: ${prefs.preferredActionLevel}
`
```

### Learning from Outcomes

Track what recommendations led to what outcomes:
1. **Decision tracking**: When user accepts/rejects suggestion
2. **Outcome correlation**: Did "create pricing survey" lead to validated theme?
3. **Pattern extraction**: "Users at this stage typically do X"
4. **Personalization**: "This user prefers deep-dive over breadth"

### Memory Compaction Strategy

```
Goal: Maximize recall, then iterate to improve precision

Triggers:
- Context approaching 80% of limit
- Session end (consolidation)
- Explicit user request ("summarize our progress")

Preserve (high priority):
- Current task state
- User decisions and their reasoning
- Unresolved questions
- Active entity references (people, themes, surveys)

Compact (lower priority):
- Tool call details (keep outcomes, drop inputs)
- Repeated similar queries
- Failed attempts (keep final success)
```

---

## Deep Dive: Competitive Analysis

### Dovetail (Direct Competitor)

**What they launched (Fall 2025):**
- AI Agents (closed beta) - automated VoC summaries, issue flagging, Slack alerts
- AI Dashboards - qualitative → quantitative visualization
- AI Docs - auto-generate PRDs, research reports
- AI Chat (GA) - surface insights, answer questions
- Integrations: Linear, Salesforce, Gong, Alloy

**Their architecture (4-stage cycle):**
1. **Assemble**: Centralize customer signals (sales calls, support, surveys, app reviews)
2. **Analyze**: AI classification, dashboards, segment comparison, sentiment tracking
3. **Uncover**: AI Chat for insights, question answering, document generation
4. **Act**: Linear tickets, Slack alerts, automated reports, prototypes

**Their strengths:**
- Deep integrations (Gong, Salesforce, Linear)
- Strong enterprise presence (Atlassian, Shopify, Canva)
- Fast AI feature shipping (2-week cycles via Bedrock)
- Mature data pipeline (transcription, highlights, redaction)

**Their gaps (our opportunity):**
- Agents are in closed beta, not generally available
- No true state-aware orchestration (still feature-based)
- No proactive guidance ("what should I do next?")
- Manual workflow assembly (Assemble → Analyze → Uncover → Act requires user driving)

### OpenAI Agents SDK (Platform Competitor)

**What they offer:**
- Session-based memory (automatic history management)
- Storage options: SQLite, SQLAlchemy, Dapr, encrypted sessions
- Minimal primitives: Agent, Tool, Handoff, Guardrail
- Built-in context length management

**Their architecture pattern:**
```
Session → Memory Object → run() repeatedly
            ↓
   SDK handles history, continuity, context length
```

**Their strengths:**
- Elegant API (just call `session.run()`)
- Multiple storage backends
- Context management built-in
- Low learning curve

**Their gaps:**
- No domain knowledge (generic platform)
- Long-term memory is external responsibility
- No project state awareness
- No specialized research intelligence

### Anthropic/Claude (Platform + Product)

**What they offer:**
- 200K-1M token context windows
- Memory tool (file-based CLAUDE.md approach)
- Context editing (84% token reduction in 100-turn workflows)
- Project-scoped memory (isolation between contexts)

**Their innovation (Sept 2025):**
```
Memory as transparent Markdown files
├── Hierarchical organization
├── User-editable
├── Version-controllable
└── No vector DB complexity
```

**Their strengths:**
- Massive context windows
- Transparent memory (not black box)
- Context editing for long workflows
- Strong reasoning capabilities

**Their gaps:**
- General purpose (not research-specific)
- No integrations with research tools
- No multi-agent orchestration
- No domain workflows

### LangGraph (Framework Competitor)

**What they offer:**
- Thread-scoped checkpointing
- Cross-session namespaced memory
- LangMem toolkit (procedural, episodic, semantic)
- Multi-agent coordination patterns

**Their memory pattern:**
```
Short-term: Thread-scoped checkpoints (working memory)
Long-term: Namespaced stores (cross-session)
           ├── Semantic (facts)
           ├── Episodic (experiences)
           └── Procedural (rules)
```

**Their strengths:**
- Comprehensive memory taxonomy
- Production-ready persistence (Postgres, Redis, MongoDB)
- Background memory extraction patterns
- Multi-agent state sharing

**Their gaps:**
- Framework, not product
- Requires significant engineering
- No domain specialization
- Complex for simple use cases

### Competitive Positioning Matrix

| Capability | Dovetail | OpenAI SDK | Claude | LangGraph | **Upsight** |
|------------|----------|------------|--------|-----------|-------------|
| Research domain knowledge | ★★★★★ | ☆☆☆☆☆ | ★☆☆☆☆ | ☆☆☆☆☆ | ★★★★★ |
| State-aware guidance | ★★☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ | ★★☆☆☆ | ★★★★☆ |
| Proactive recommendations | ★★☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ | ☆☆☆☆☆ | ★★★★★ |
| Memory/learning | ★★★☆☆ | ★★★☆☆ | ★★★★☆ | ★★★★★ | ★★★☆☆ |
| Multi-agent orchestration | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ | ★★☆☆☆ |
| Enterprise integrations | ★★★★★ | ★★☆☆☆ | ★★☆☆☆ | ★★★☆☆ | ★★☆☆☆ |
| Ease of use | ★★★★☆ | ★★★★★ | ★★★★☆ | ★★☆☆☆ | ★★★☆☆ |

### Where We Win

1. **Research journey awareness**: We know where users are in discovery → validation → decision
2. **Proactive intelligence**: Suggest what to do, not just answer questions
3. **End-to-end execution**: "Create a survey" actually creates it
4. **Evidence grounding**: Recommendations tied to real interview data

### Where We Need Investment

1. **Memory sophistication**: Move beyond thread-scoped to cross-session learning
2. **Enterprise integrations**: Gong, Salesforce, Linear connections
3. **Agent reliability**: Evaluation coverage, error handling, graceful degradation

---

## Questions to Consider

1. **How much autonomy?**
   - Should agents act autonomously or always ask permission?
   - e.g., "I created a survey" vs "Should I create a survey?"

2. **How to handle errors?**
   - If a capability fails, what does orchestrator do?
   - Retry? Fall back? Ask user?

3. **How to maintain coherence?**
   - Conversations can be long
   - How to not forget context from 10 messages ago?

4. **How to scale?**
   - More capabilities = more tools = bigger prompt
   - When to split into sub-agents?
5. **When to use workflows vs agents?**
   - Are the steps predictable enough for deterministic routing?
6. **Do we have evaluation coverage?**
   - Do we have minimum test cases and trace review?
7. **What are the safety gates?**
   - Which actions require explicit user approval?

---

## Quick Win: Workflow-Based Recommendations

Based on the task-planning-workflows.md patterns, here's a concrete first implementation:

### Why Workflow-First Works Here

The "what should I do next?" journey is **deterministic enough** for a workflow:
1. Assess project state (database queries)
2. Apply recommendation rules (code logic)
3. Generate suggestions (LLM call if needed)
4. Present options (structured output)

This avoids agent autonomy complexity while delivering the core value.

### Implementation: `recommendNextActionsWorkflow`

```typescript
// File: app/mastra/workflows/recommend-next-actions.ts

const recommendNextActionsWorkflow = createWorkflow({
  name: 'recommend-next-actions',
  triggerSchema: z.object({
    projectId: z.string(),
    accountId: z.string(),
    userId: z.string(),
  }),
})
  .step('fetchProjectState', async ({ context }) => {
    // Deterministic: queries only
    const state = await getProjectResearchContext(supabase, context.projectId)
    return {
      interviewCount: state.interviews.length,
      themeCount: state.themes.length,
      lowEvidenceThemes: state.themes.filter(t => t.evidence_count < 3),
      surveyCount: state.surveys.length,
      recentSurveyResponses: state.surveyResponses.filter(isRecent),
      hasGoals: state.projectSections.some(s => s.kind === 'goal'),
    }
  })
  .step('generateRecommendations', async ({ context, previousStepResult }) => {
    const state = previousStepResult
    const recommendations: Recommendation[] = []

    // Rule-based logic (no LLM needed)
    if (!state.hasGoals) {
      recommendations.push({
        id: 'setup-project',
        priority: 1,
        title: 'Complete project setup',
        description: 'Define your research goals to get personalized guidance',
        action: { type: 'navigate', path: '/chat' },
        reasoning: 'Project goals help me give better recommendations',
      })
    }

    if (state.interviewCount === 0 && state.surveyCount === 0) {
      recommendations.push({
        id: 'first-research',
        priority: 2,
        title: 'Start gathering insights',
        description: 'Run discovery interviews or create a survey',
        action: { type: 'choice', options: ['interviews', 'survey'] },
        reasoning: 'You have no research data yet',
      })
    }

    if (state.lowEvidenceThemes.length > 0) {
      recommendations.push({
        id: 'validate-theme',
        priority: 3,
        title: `Validate: ${state.lowEvidenceThemes[0].name}`,
        description: 'This theme needs more evidence to be confident',
        action: { type: 'create-survey', focusTheme: state.lowEvidenceThemes[0].id },
        reasoning: `Only ${state.lowEvidenceThemes[0].evidence_count} pieces of evidence`,
      })
    }

    // ... more rules

    return { recommendations: recommendations.slice(0, 3) }
  })
  .commit()
```

### Tool Wrapper for Agent Access

```typescript
// File: app/mastra/tools/recommend-next-actions.ts

export const recommendNextActionsTool = createTool({
  id: 'recommendNextActions',
  description: `Get personalized recommendations for what the user should do next.
    Returns 1-3 actionable suggestions based on project state.
    Use this proactively when user asks "what should I do?" or seems stuck.`,
  inputSchema: z.object({
    reason: z.string().describe('Why you are fetching recommendations'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    recommendations: z.array(RecommendationSchema),
    projectState: z.object({
      stage: z.enum(['setup', 'discovery', 'validation', 'synthesis']),
      interviewCount: z.number(),
      themeCount: z.number(),
    }),
  }),
  execute: async (input, { requestContext }) => {
    const projectId = requestContext.get('project_id')
    const accountId = requestContext.get('account_id')
    const userId = requestContext.get('user_id')

    const result = await recommendNextActionsWorkflow.execute({
      projectId, accountId, userId,
    })

    return {
      success: true,
      recommendations: result.recommendations,
      projectState: result.state,
    }
  },
})
```

### Why This Approach

1. **Workflow handles determinism**: State assessment is just queries + rules
2. **Tool provides agent interface**: Uppy can call it conversationally
3. **No autonomy debate yet**: Just recommendations, user decides
4. **Extensible**: Add more rules without agent changes
5. **Testable**: Pure functions, mock database state

### Testing Strategy

```typescript
// Test cases for recommendation rules
describe('recommendNextActions', () => {
  it('recommends setup when no goals', async () => {
    const state = { hasGoals: false, interviewCount: 0, ... }
    const result = await generateRecommendations(state)
    expect(result[0].id).toBe('setup-project')
  })

  it('recommends theme validation when low evidence', async () => {
    const state = { lowEvidenceThemes: [{ name: 'Pricing', evidence_count: 1 }], ... }
    const result = await generateRecommendations(state)
    expect(result.some(r => r.id === 'validate-theme')).toBe(true)
  })

  // ... 20+ test cases covering all rules
})
```

---

## Next Steps

Before building, decide:

1. **Orchestrator design**: Single enhanced agent or multi-agent swarm?
2. **Capability boundary**: What's a tool vs. what's an agent?
3. **Autonomy level**: Proactive execution vs. recommendation-only?
4. **First use case**: Which journey to implement first?
5. **Evaluation & observability**: What's the minimum test set and trace policy?
6. **Tool contracts**: Which tool outputs require BAML schemas first?

---

## Research Sources

### Memory & Agent Architecture
- [OpenAI Agents SDK: Session Memory](https://cookbook.openai.com/examples/agents_sdk/session_memory)
- [OpenAI Agents SDK: Long-Term Memory](https://cookbook.openai.com/examples/agents_sdk/context_personalization)
- [Anthropic: Context Management](https://www.anthropic.com/news/context-management)
- [Anthropic: Memory Tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Anthropic: Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [LangChain: Memory Overview](https://docs.langchain.com/oss/python/langgraph/memory)
- [LangGraph & Redis: Memory Persistence](https://redis.io/blog/langgraph-redis-build-smarter-ai-agents-with-memory-persistence/)
- [Practical Memory Patterns for Agent Workflows](https://www.ais.com/practical-memory-patterns-for-reliable-longer-horizon-agent-workflows/)
- [It's Not Magic, It's Memory (Jit)](https://www.jit.io/resources/ai-security/its-not-magic-its-memory-how-to-architect-short-term-memory-for-agentic-ai)

### Competitive Intelligence
- [Dovetail: Fall 2025 Launch](https://dovetail.com/blog/2025-fall-launch/)
- [Dovetail: Spring 2025 Launch](https://dovetail.com/blog/dovetail-2025-spring-launch/)
- [Dovetail: AI Vision](https://dovetail.com/blog/ai-vision/)
- [Dovetail: Customer Intelligence Platform](https://dovetail.com/blog/dovetail-launches-customer-intelligence-platform/)
- [OpenAI Agents SDK Review (mem0)](https://mem0.ai/blog/openai-agents-sdk-review)
- [Top AI Tools for User Research](https://www.usehubble.io/blog/top-ai-tools-for-user-research)
- [AI Transforming UX Research 2025](https://www.looppanel.com/blog/ai-uxresearch-10-powerful-tools)
