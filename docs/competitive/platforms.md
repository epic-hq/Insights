# AI Agent Platforms - Competitive Analysis

**Type**: Platform Competitors (Agent Infrastructure)
**Last Updated**: January 2026

These are platforms/frameworks we learn from, not direct product competitors.

---

## OpenAI Agents SDK

**Launched**: March 2025 (evolution of Swarm)

### What They Offer

- Session-based memory (automatic history management)
- Storage options: SQLite, SQLAlchemy, Dapr, encrypted sessions
- Minimal primitives: Agent, Tool, Handoff, Guardrail
- Built-in context length management

### Architecture Pattern

```
Session → Memory Object → run() repeatedly
            ↓
   SDK handles history, continuity, context length
```

### Memory Approach

**Session-based**: You call `session.run()` repeatedly, SDK handles context.

**Storage options**:
- File-based SQLite for persistent conversations
- SQLAlchemy for production systems
- Dapr state store for cloud-native (30+ backends)
- OpenAI-hosted via Conversations API
- Encrypted sessions with TTL

**Long-term memory pattern**:
1. State object as local-first memory store
2. Distill memories during a run (tool call → session notes)
3. Consolidate session notes into global notes at end
4. Inject state at start of each run

### Strengths

- Elegant API (just call `session.run()`)
- Multiple storage backends
- Context management built-in
- Low learning curve

### Gaps

- No domain knowledge (generic platform)
- Long-term memory is external responsibility
- No project state awareness
- No specialized research intelligence

### Learnings for Us

- Session-based memory pattern is clean
- Storage abstraction is useful
- "State object as local-first memory" is a good pattern

---

## Anthropic/Claude

**Memory Tool**: September 2025 (beta)

### What They Offer

- 200K-1M token context windows
- Memory tool (file-based CLAUDE.md approach)
- Context editing (84% token reduction in 100-turn workflows)
- Project-scoped memory (isolation between contexts)

### Memory Innovation

```
Memory as transparent Markdown files
├── Hierarchical organization
├── User-editable
├── Version-controllable
└── No vector DB complexity
```

Instead of complex vector DBs, Anthropic uses simple Markdown files (`CLAUDE.md`) that are:
- Transparent (you can read them)
- Hierarchical (organized structure)
- Version-controllable (git-friendly)

### Context Editing

Automatically clears stale tool calls and results from context window when approaching token limits. In 100-turn web search evaluation:
- Enabled workflows that would otherwise fail
- Reduced token consumption by 84%

### Strengths

- Massive context windows
- Transparent memory (not black box)
- Context editing for long workflows
- Strong reasoning capabilities

### Gaps

- General purpose (not research-specific)
- No integrations with research tools
- No multi-agent orchestration
- No domain workflows

### Learnings for Us

- Transparent, file-based memory is elegant
- Context editing is crucial for long workflows
- Project-scoped isolation is important

---

## LangGraph

**Part of**: LangChain ecosystem

### What They Offer

- Thread-scoped checkpointing
- Cross-session namespaced memory
- LangMem toolkit (procedural, episodic, semantic)
- Multi-agent coordination patterns

### Memory Pattern

```
Short-term: Thread-scoped checkpoints (working memory)
Long-term: Namespaced stores (cross-session)
           ├── Semantic (facts)
           ├── Episodic (experiences)
           └── Procedural (rules)
```

### Memory Types (Following Human Cognition)

| Type | Human Analog | Agent Use |
|------|--------------|-----------|
| Semantic | Facts | User preferences, project facts |
| Episodic | Experiences | Conversation history, action log |
| Procedural | Rules/skills | Learned patterns, workflows |

### Persistence Options

- `MemorySaver` - in-memory (tutorials only)
- `SqliteSaver` - local persistent
- `PostgresSaver` - production
- `RedisSaver` - with vector search

### Memory Update Strategies

**Hot path**: Extract memories during agent's application logic (before responding)
- Pros: Immediate availability
- Cons: Adds latency

**Background**: Extract memories as separate task
- Pros: No latency, separates concerns
- Cons: May miss context if session ends abruptly

### Strengths

- Comprehensive memory taxonomy
- Production-ready persistence (Postgres, Redis, MongoDB)
- Background memory extraction patterns
- Multi-agent state sharing

### Gaps

- Framework, not product
- Requires significant engineering
- No domain specialization
- Complex for simple use cases

### Learnings for Us

- Memory taxonomy (semantic, episodic, procedural) is useful framing
- Background memory consolidation pattern is valuable
- Thread-scoped vs cross-session distinction matters

---

## Sources

- [OpenAI Agents SDK: Session Memory](https://cookbook.openai.com/examples/agents_sdk/session_memory)
- [OpenAI Agents SDK: Long-Term Memory](https://cookbook.openai.com/examples/agents_sdk/context_personalization)
- [OpenAI Agents SDK Review (mem0)](https://mem0.ai/blog/openai-agents-sdk-review)
- [Anthropic: Context Management](https://www.anthropic.com/news/context-management)
- [Anthropic: Memory Tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Anthropic: Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [LangChain: Memory Overview](https://docs.langchain.com/oss/python/langgraph/memory)
- [LangGraph & Redis](https://redis.io/blog/langgraph-redis-build-smarter-ai-agents-with-memory-persistence/)
- [Practical Memory Patterns](https://www.ais.com/practical-memory-patterns-for-reliable-longer-horizon-agent-workflows/)
