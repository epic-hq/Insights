# Project Structure

This document provides the complete technology stack and file tree structure for the Insights project. **AI agents MUST read this file to understand the project organization before making any changes.**

## Technology Stack

### Frontend
- **React 19.2** with **TypeScript 5.8** - UI framework with strict typing
- **React Router 7.9** - File-based routing with layouts and loaders
- **Tailwind CSS 4.1** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **Zustand 5.0** - Lightweight state management
- **Framer Motion 12** - Animations
- **Recharts 3.1** - Charts and data visualization
- **React Three Fiber** - 3D graphics (used sparingly)

### Backend & Server
- **Hono** - Lightweight web framework (via react-router-hono-server)
- **Supabase** - PostgreSQL database, auth, storage, edge functions
- **Trigger.dev v4** - Background job processing and scheduled tasks

### AI & LLM Integration
- **BAML (Boundary ML)** - Type-safe LLM prompts and structured outputs
- **Mastra** - AI agent orchestration framework
- **Vercel AI SDK** - Streaming AI responses
- **Anthropic Claude** - Primary LLM provider
- **OpenAI** - Secondary LLM provider
- **Langfuse** - LLM observability and tracing

### Real-time & Media
- **LiveKit** - Real-time voice/video communication
- **AssemblyAI** - Speech-to-text transcription

### Development & Quality
- **pnpm 10** - Package management
- **Vite 7** - Build tooling
- **Biome** - Linting and formatting (replaces ESLint/Prettier)
- **Vitest** - Unit and integration testing
- **Storybook 9** - Component development and documentation
- **Knip** - Dead code detection

### Deployment & Monitoring
- **Fly.io** - Container deployment
- **PostHog** - Product analytics and feature flags
- **dotenvx** - Environment variable management

---

## Complete Project Structure

```
Insights/
├── CLAUDE.md                           # Master AI context (Trigger.dev patterns)
├── package.json                        # Dependencies and scripts
├── react-router.config.ts              # React Router configuration
├── trigger.config.ts                   # Trigger.dev configuration
├── vite.config.ts                      # Vite build configuration
├── biome.json                          # Linting/formatting rules
├── tsconfig.json                       # TypeScript configuration
│
├── app/                                # Main application code
│   ├── root.tsx                        # Root layout component
│   ├── routes.ts                       # Route definitions (imports feature routes)
│   ├── entry.client.tsx                # Client-side entry point
│   ├── entry.server.tsx                # Server-side entry point
│   ├── env.server.ts                   # Environment variables (server-only)
│   ├── database.types.ts               # Generated Supabase types
│   ├── types.ts                        # Shared application types
│   ├── schemas.ts                      # Zod validation schemas
│   ├── tailwind.css                    # Global styles
│   │
│   ├── components/                     # Shared UI components
│   │   ├── ui/                         # shadcn/ui primitives (Button, Dialog, etc.)
│   │   ├── navigation/                 # Sidebar, nav components
│   │   ├── chat/                       # Chat UI components
│   │   ├── charts/                     # Chart components
│   │   ├── dialogs/                    # Modal dialogs
│   │   ├── ai-elements/                # AI-specific UI (streaming, etc.)
│   │   └── layout/                     # Layout components
│   │
│   ├── features/                       # Feature modules (domain-organized)
│   │   ├── lenses/                     # Conversation Lenses feature
│   │   │   ├── routes.ts               # Feature route definitions
│   │   │   ├── pages/                  # Page components
│   │   │   ├── components/             # Feature-specific components
│   │   │   └── api/                    # Feature API utilities
│   │   ├── assets/                     # Project assets (tables, files, documents)
│   │   ├── interviews/                 # Interview management
│   │   ├── evidence/                   # Evidence extraction & display
│   │   ├── insights/                   # AI-generated insights
│   │   ├── opportunities/              # Sales opportunity tracking
│   │   ├── people/                     # Person/contact management
│   │   ├── personas/                   # User persona management
│   │   ├── projects/                   # Project management
│   │   ├── questions/                  # Research questions
│   │   ├── themes/                     # Theme/topic clustering
│   │   ├── tasks/                      # Task management
│   │   ├── voice/                      # Voice chat feature
│   │   ├── home/                       # Dashboard/home page
│   │   ├── accounts/                   # Account settings
│   │   ├── teams/                      # Team management
│   │   └── [other features]/           # Additional feature modules
│   │
│   ├── routes/                         # Route handlers (flat file routing)
│   │   ├── _ProtectedLayout.tsx        # Auth-protected layout
│   │   ├── _protected/                 # Protected route handlers
│   │   ├── api/                        # API route handlers
│   │   ├── api.*.tsx                   # Individual API endpoints
│   │   └── (auth)+/                    # Auth-related routes
│   │
│   ├── mastra/                         # AI agent system
│   │   ├── agents/                     # Agent definitions
│   │   ├── tools/                      # Agent tools
│   │   ├── workflows/                  # Multi-step workflows
│   │   └── storage/                    # Agent state storage
│   │
│   ├── lib/                            # Core libraries
│   │   ├── supabase/                   # Supabase client setup
│   │   └── [utilities]/                # Other core utilities
│   │
│   ├── hooks/                          # React hooks
│   ├── contexts/                       # React contexts
│   ├── utils/                          # Utility functions
│   ├── types/                          # Additional type definitions
│   └── test/                           # Test utilities and setup
│
├── src/                                # Background processing (Trigger.dev)
│   └── trigger/                        # Trigger.dev tasks
│       ├── asset/                      # Asset indexing/embedding tasks
│       ├── interview/                  # Interview processing tasks
│       │   └── v2/                     # V2 interview pipeline
│       ├── lens/                       # Lens application tasks
│       ├── persona/                    # Persona extraction tasks
│       ├── sales/                      # Sales-related tasks
│       └── survey/                     # Survey stats and evidence extraction
│
├── baml_src/                           # BAML prompt definitions
│   ├── clients.baml                    # LLM client configurations
│   ├── generators.baml                 # Code generation settings
│   ├── apply_conversation_lens.baml    # Lens extraction prompts
│   ├── extract_evidence.baml           # Evidence extraction
│   ├── extract_insights.baml           # Insight generation
│   ├── sales_lens_extraction.baml      # Sales BANT extraction
│   ├── research_lens_extraction.baml   # Research lens extraction
│   └── [other].baml                    # Additional prompt files
│
├── baml_client/                        # Generated BAML client code
│
├── supabase/                           # Database configuration
│   ├── config.toml                     # Supabase local config
│   ├── migrations/                     # Database migrations
│   ├── functions/                      # Edge functions
│   ├── schemas/                        # Schema definitions
│   └── types.ts                        # Generated database types
│
├── agents/                             # LiveKit voice agents
│   └── livekit/                        # LiveKit agent implementation
│
├── docs/                               # Documentation
│   ├── ai-context/                     # AI agent documentation
│   │   ├── project-structure.md        # This file
│   │   └── docs-overview.md            # Documentation architecture
│   ├── features/                       # Feature specifications
│   │   └── conversation-lenses/        # Lenses PRD
│   └── specs/                          # Technical specifications
│
├── scripts/                            # Build and utility scripts
├── public/                             # Static assets
└── .storybook/                         # Storybook configuration
```

---

## Key Architectural Patterns

### Feature Module Structure
Each feature in `app/features/` follows this pattern:
```
feature-name/
├── routes.ts           # Route definitions exported to app/routes.ts
├── pages/              # Page components (route handlers)
├── components/         # Feature-specific components
├── api/                # Server utilities and data fetching
├── lib/                # Feature-specific business logic
└── server/             # Server-only code
```

### Route Organization
- Routes are defined in `app/routes.ts` using React Router's config-based routing
- Feature routes are imported and composed in the main routes file
- API routes follow the pattern `api.[resource].[action].tsx`
- Protected routes are wrapped in `_ProtectedLayout.tsx`

### Database Access
- Use Supabase client from `app/lib/supabase`
- Types are generated via `pnpm db:types` from the live schema
- Migrations live in `supabase/migrations/`

### Background Jobs
- All background tasks use Trigger.dev v4 SDK
- Tasks are defined in `src/trigger/`
- Use `schemaTask` for type-safe payloads with Zod validation
- Never use deprecated v2 patterns (`client.defineJob`)

### AI/LLM Integration
- BAML files define structured prompts in `baml_src/`
- Generated client is in `baml_client/`
- Run `pnpm baml-generate` after modifying BAML files
- Mastra agents handle complex multi-step AI workflows

---

## Important Files

| File | Purpose |
|------|---------|
| `app/routes.ts` | All route definitions |
| `app/database.types.ts` | Generated Supabase types |
| `app/env.server.ts` | Environment variables |
| `trigger.config.ts` | Trigger.dev configuration |
| `baml_src/clients.baml` | LLM provider configuration |
| `supabase/config.toml` | Local Supabase settings |

---

## Common Commands

```bash
# Development
pnpm dev                    # Start Vite + Mastra dev servers
pnpm dev:with-agent         # Also start LiveKit agent

# Database
pnpm db:types               # Regenerate Supabase types
pnpm migrate                # Run pending migrations

# AI/LLM
pnpm baml-generate          # Regenerate BAML client

# Quality
pnpm check                  # Run Biome linting
pnpm check:fix              # Auto-fix lint issues
pnpm typecheck              # TypeScript type checking
pnpm test                   # Run tests

# Build
pnpm build                  # Production build
```
