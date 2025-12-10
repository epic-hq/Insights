# Documentation Architecture

This project has extensive documentation organized by purpose. AI agents should consult relevant docs when working on features.

---

## Tier 1: Essential Reading (Every Session)

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](/CLAUDE.md) | Project overview, coding conventions, quick reference |
| [agents.md](/agents.md) | **Current todos**, recent implementations, routing patterns |
| [Project Structure](project-structure.md) | Tech stack, file tree, architectural patterns |

---

## Tier 2: How-To Guides

### Database & Backend
| Guide | When to Use |
|-------|-------------|
| [Supabase Guide](/docs/supabase-howto.md) | Any database work, migrations, RLS |
| [Declarative Schemas](/docs/@supabase/howto/declarative-schemas.md) | Schema changes (required approach) |
| [CRUD Patterns](/docs/crud-pattern-howto.md) | Standard data operation patterns |
| [DB Types](/docs/dbtypes.md) | Understanding generated types |
| [Junction Tables](/docs/junction-tables-guide.md) | Many-to-many relationships |

### Deployment & Infrastructure
| Guide | When to Use |
|-------|-------------|
| [Deploy Guide](/docs/deploy-howto.md) | Deploying to Fly.io |
| [Trigger.dev Deploy](/docs/trigger-dev-deployment.md) | Background task deployment |
| [Deploy to Supabase](/docs/deploy-to-supabase.md) | Database deployment |

### Development
| Guide | When to Use |
|-------|-------------|
| [Testing Guide](/docs/testing-howto.md) | Writing tests |
| [Storybook Guide](/docs/storybook-guide.md) | Component development |
| [Storybook Workflow](/docs/storybook-workflow.md) | Storybook best practices |
| [UI Style](/docs/ui-style.md) | Design system and styling |
| [UI Component Best Practices](/docs/development/ui-component-best-practices.md) | Component patterns |

### Analytics & Monitoring
| Guide | When to Use |
|-------|-------------|
| [PostHog Tracking](/docs/posthog-tracking.md) | Adding analytics events |
| [PostHog Events](/docs/posthog-events-implemented.md) | Existing event catalog |
| [Langfuse](/docs/observability/langfuse.md) | LLM observability |

---

## Tier 3: Architecture & Design Docs

### Core Architecture
| Document | Description |
|----------|-------------|
| [Information Architecture](/docs/_information_architecture.md) | System-wide IA and data model |
| [Lens Architecture v2](/docs/_lens-based-architecture-v2.md) | Conversation lenses design |
| [Interview Processing](/docs/interview-processing-explained.md) | Core transcription/analysis pipeline |
| [Interview Processing Flows](/docs/interview-processing-flows.md) | Detailed pipeline diagrams |
| [User Flow](/docs/user-flow.md) | End-to-end user journeys |

### Feature-Specific Architecture
| Document | Feature |
|----------|---------|
| [Segments & Targeting](/docs/architecture/segments-and-targeting.md) | User segmentation |
| [Evidence-Based Extraction](/docs/architecture/evidence-based-extraction.md) | Evidence system |
| [Anchor Schema Standard](/docs/architecture/anchor-schema-standard.md) | Timestamp linking |
| [Interview Processing Refactor](/docs/architecture/interview-processing-refactor.md) | V2 pipeline |

---

## Tier 4: Feature PRDs & Specs

### Active Features
| Feature | PRD | Technical Design |
|---------|-----|------------------|
| **Conversation Lenses** | [PRD](/docs/features/conversation-lenses/PRD.md) | [Technical](/docs/features/conversation-lenses/technical-design.md) |
| **Task System** | [Proposal](/docs/features/task-system-proposal.md) | [Design](/docs/features/task-system-technical-design.md) |
| **BANT Lens** | [User Guide](/docs/features/bant-lens-user-guide.md) | [Technical](/docs/features/bant-lens-technical-design.md) |
| **Onboarding** | [Flow](/docs/features/onboarding-flow.md) | [Storyboard](/docs/features/onboarding-storyboard.md) |
| **People Linking** | [Overview](/docs/features/people-linking/README.md) | [Implementation](/docs/features/people-linking/implementation.md) |
| **Settings** | - | [Architecture](/docs/features/settings-architecture.md) |
| **Project Chat** | [PRD](/docs/features/project-chat.md) | - |
| **Signup Chat** | [PRD](/docs/features/signup-chat.md) | - |

### Implementation Guides
| Document | Purpose |
|----------|---------|
| [Sales Lens Implementation](/docs/sales-lens-implementation.md) | Sales BANT lens |
| [Product Lens Implementation](/docs/product-lens-implementation.md) | Product lens |
| [Lens Testing Guide](/docs/lens-architecture-testing-guide.md) | Testing lenses |
| [BAML Extraction](/docs/sales-lens-baml-extraction.md) | BAML for lenses |

### AI Agents
| Document | Purpose |
|----------|---------|
| [Agents Vision](/docs/agents/vision.md) | Agent system goals |
| [Agents Planning](/docs/agents/planning.md) | Agent roadmap |
| [Agents Implementation](/docs/agents/implementation.md) | Current implementation |
| [Agentic Workflow](/docs/features/agentic-workflow.md) | Workflow patterns |

---

## Tier 5: User Guides & Quick Reference

| Document | Audience |
|----------|----------|
| [Research Analysis Guide](/docs/quick-reference/research-analysis-guide.md) | Researchers |
| [CRM Workflow](/docs/quick-reference/crm-workflow.md) | Sales teams |
| [CRM Opportunities Guide](/docs/user-guides/crm-opportunities-guide.md) | Sales teams |
| [ICP Discovery Guide](/docs/user-guide-icp-discovery.md) | Product teams |
| [Annotations Quick Start](/docs/quick-reference/annotations-quick-start.md) | All users |
| [Document Vocabulary](/docs/quick-reference/document-vocabulary.md) | Terminology reference |

---

## Finding Documentation

| Need | Where to Look |
|------|---------------|
| **Current tasks & todos** | `agents.md` (project root) |
| **New feature work** | `docs/features/` for PRDs |
| **Database changes** | `docs/supabase-howto.md` |
| **Deployment** | `docs/deploy-howto.md` |
| **Architecture questions** | `docs/architecture/` or `docs/_information_architecture.md` |
| **Component patterns** | `docs/development/ui-component-best-practices.md` |
