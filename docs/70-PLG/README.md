# PLG Documentation

This folder owns PLG strategy and nurture execution.

## Strategy
- `/docs/70-PLG/strategy/activation-strategy.md` -- Reverse trial design, campaign flows, feature gates
- `/docs/70-PLG/strategy/instrumentation-plan.md` -- User journey stages, behavioral triggers, cohort definitions

## Nurture (Brevo-first)
- `/docs/70-PLG/nurture/plan.md` (single source of truth for nurture orchestration)
- `/docs/70-PLG/nurture/brevo-setup.md` -- Brevo configuration, webhook setup
- `/docs/70-PLG/nurture/email-sequences.md` -- Full email content for 18 templates
- `/docs/70-PLG/nurture/dashboard-spec.md` -- PostHog nurture dashboard spec

## PostHog Implementation (Developer Reference)
- `/docs/features/analytics/posthog-server-implementation-guide.md` -- **Canonical event catalog**: all 21 implemented events, code patterns, PLG mapping, unimplemented event backlog

## PostHog Operations
- `/docs/60-ops-observability/posthog-setup-guide.md` -- Dashboard and funnel setup steps
- `/docs/60-ops-observability/posthog-events-implemented.md` -- Legacy detailed event reference (being consolidated)
- `/docs/60-ops-observability/posthog-tracking.md` -- Legacy tracking guide (being consolidated)
- `/docs/60-ops-observability/posthog-implementation-summary.md` -- Historical: first event implementation notes
