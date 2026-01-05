# Product Plan & Roadmap

**Audience:** Product managers, designers, and stakeholders planning features and positioning.

This document links to key PRDs, specs, and positioning documents that define the product vision and roadmap.

## Product Positioning & Value Proposition

### Core Positioning
- **[User Value Proposition](50-market/user-value-prop.md)** - Onboarding experience for business leaders, ICP definition, personas
- **[Customer-Centric CRM Value Prop](50-market/customer-centric-crm-value-prop.md)** - Category positioning, differentiation, persona-specific value props

### Market & Positioning
- **Location:** `docs/50-market/`
- Defines: Category (Customer Intelligence Platform), wedge strategy, differentiators, target personas

## Feature PRDs

### Active Features
| Feature | Status | PRD Location | Notes |
|---------|--------|--------------|-------|
| **Conversation Lenses** | ✅ Live | `20-features-prds/features/conversation-lenses/PRD.md` | Structured analytical frameworks (BANT, Empathy Maps, etc.) |
| **Decision Reels** | 📋 Planned | `20-features-prds/features/reels/reels-PRD.md` | Video highlight reels for decision questions |
| **Insights System** | ✅ Live | `20-features-prds/features/insights/PRD.md` | Theme-based insights with evidence |
| **Meetings Integration** | 📋 Planned | `20-features-prds/features/meetings/meetings-PRD.md` | Calendar and meeting capture |
| **Integrations** | 📋 Planned | `20-features-prds/features/integrations/integrations-PRD.md` | Third-party tool connections |
| **Support View** | 📋 Planned | `20-features-prds/features/support-view/PRD.md` | Customer support lens |

### Feature Specifications

**Onboarding & Setup:**
- `20-features-prds/features/onboarding/onboarding-spec.md` - User onboarding flow
- `20-features-prds/features/onboarding/adaptive-companion-spec.md` - AI companion for setup

**Research & Analysis:**
- `20-features-prds/features/research-analysis/research-links-spec.md` - Evidence-to-question linking
- `20-features-prds/features/conversation-lenses/custom-lenses-v1-plan.md` - Custom lens creation

**Data Ingestion:**
- `20-features-prds/features/feature-spec-ingest.md` - Interview upload and processing
- `20-features-prds/features/feature-spec-transcription-pipeline.md` - Transcription workflow

## Implementation Plans

### Active Development
| Feature | Plan Location | Status |
|---------|---------------|--------|
| Decision Reels | `20-features-prds/features/reels/reels-implementation-plan.md` | Ready for dev |
| Custom Lenses v1 | `20-features-prds/features/conversation-lenses/custom-lenses-v1-plan.md` | In progress |
| Research Links | `20-features-prds/features/research-analysis/research-links-rollout-plan.md` | Complete |
| Public Link Sharing | `20-features-prds/features/sharing/public-link-sharing-plan.md` | Planned |
| Facets Cleanup | `20-features-prds/features/facets/FACETS_CLEANUP_PLAN.md` | In progress |

## Architecture & Technical Design

### Core Architecture
- **[Information Architecture](00-foundation/_information_architecture.md)** - System-wide IA, data model
- **[Lens Architecture](00-foundation/_lens-based-architecture-v2.md)** - Conversation lenses design
- **[Task System](20-features-prds/features/task-system-technical-design.md)** - Project prioritization and execution

### Technical Specs
- **[Discovery to CRM Hygiene](10-architecture/discovery-to-crm-hygiene-spec.md)** - Data flow and hygiene
- **[Example API Integration](20-features-prds/specs/example-api-integration-spec.md)** - API integration patterns
- **[Example Feature Specification](20-features-prds/specs/example-feature-specification.md)** - Spec template

## Roadmap Status

### Completed (✅)
- Conversation Lenses framework
- Evidence extraction and linking
- Themes and insights system
- People and personas tracking
- Interview processing pipeline
- Research structure management

### In Progress (🚧)
- Custom lens creation
- Facets cleanup and standardization
- Public link sharing

### Planned (📋)
- Decision Reels (video highlights)
- Meetings integration
- Third-party integrations
- Support view lens
- Advanced analytics

## How to Use This Document

**For Product Managers:**
1. Review positioning docs in `50-market/` for messaging and ICP
2. Check PRDs in `20-features-prds/features/` for feature details
3. Track implementation plans for development status

**For Designers:**
1. Start with user value prop and personas
2. Review feature PRDs for UX requirements
3. Check onboarding specs for user journey

**For Engineers:**
1. Review implementation plans for technical approach
2. Check architecture docs for system design
3. See `docs/00-foundation/agents/implementation.md` for coding patterns

## Related Documentation

- **Agent Implementation:** `docs/00-foundation/agents/implementation.md`
- **Database How-To:** `docs/30-howtos/supabase-howto.md`
- **Deployment:** `docs/30-howtos/deploy-howto.md`
- **Testing:** `docs/30-howtos/testing-howto.md`
