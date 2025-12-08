# Distribution & Growth PRD

## Summary
Build sharing and distribution loops that help researchers and consultants spread insights quickly, attract new collaborators, and convert viewers into active users while protecting sensitive data.

## Objectives
- Increase share rate and external engagement for published insights.
- Reduce friction for stakeholders to consume insights without full account creation.
- Attribute distribution loop performance and conversion back to the sharer.
- Enable embeddable, provable insight artifacts that drive traffic back to the app.

## Success Metrics
- **Share creation**: ≥40% of published insights have at least one external share within 7 days.
- **View-to-signup**: ≥10% of unique external viewers start a trial or request access.
- **Loop health**: ≥25% of active researchers share at least twice per month with positive engagement (views or reactions).
- **Quality**: ≥90% of external views render with evidence provenance and timestamps.

## User Stories
- As a researcher or consultant, I can generate a read-only link to an insight with optional expiration and passcode so stakeholders can view without joining the workspace.
- As a collaborator, I can react or comment on a shared insight to signal feedback and request access to the project.
- As a consultant, I can invite multiple interview participants, capture their perspectives, and share a consensus view with clients while preserving who said what.
- As a marketer, I can embed a highlight card in Notion or a newsletter that links back to the full insight.
- As an admin, I can see who viewed shared links and how many sign-ups those views generated.

## Functional Requirements
1. **Shareable insight links**
   - Generate unique, access-controlled links for an insight or highlight.
   - Configurable access levels: public read-only, passcode-protected, or email-verified.
   - Optional expiration dates and revoke controls.
2. **Identity & mentions**
   - Support usernames/nicknames for clear attribution on comments, tasks, and shared pages.
   - Enable @mentions in comments and tasks so collaborators can pull the right people (including AI bot assignees) into conversations without exposing full emails in external views.
3. **Lightweight consumption experience**
   - Read-only share page with summary, key highlights, evidence provenance, and CTA to request access or start a trial.
   - Mobile-friendly layout; no login wall for read-only access.
4. **Embeddable cards**
   - Markdown/HTML snippet to embed a highlight or summary card that deep-links back to the app.
   - Basic theme options (light/dark) and small/large layouts; auto-refreshes title/summary when updated.
5. **Social proof and reactions**
   - View and reaction counts on shared pages; optional badge for “Updated recently.”
   - Simple reactions (👍 👀 ✅) with rate limits; aggregate counts visible to sharer.
6. **Attribution and analytics**
   - Track views, reactions, and conversions per shared link with UTM-friendly URLs.
   - Surface metrics in a “Share Performance” panel on each insight and in a workspace-level dashboard.
   - Gamified “conversations this week / last 7 days” KPI leveraging existing interview logging to encourage more interviews and shares.
7. **Contextual prompts**
   - After publishing or updating an insight, show a nudge to create a share link and embed highlights.
   - In interview completion flow, recommend creating a highlight share or summary card.
   - In the Task system, suggest converting comments/feedback on shared pages into tasks assigned to people or AI bots.

## Non-Functional Requirements
- Respect privacy settings; default to private with explicit opt-in to share externally.
- Links and embeds must be performant (<1.5s LCP on share pages) and accessible (WCAG AA for shared surfaces).
- Audit logs for link creation, changes, and revocation.
- Favor configuration over new systems; reuse existing Task framework, calendar/email/SMS integrations, and planned Feed rather than bespoke notification or gamification services.

## Risks & Mitigations
- **Data leakage**: Ensure private by default, with clear scopes on links and revoke controls; watermarks for sensitive workspaces.
- **Low adoption**: Add contextual prompts and show performance analytics to reinforce the habit of sharing.
- **Spam/abuse**: Rate-limit reactions and link creation; apply bot checks on high-volume public links.

## Dependencies
- Existing project/insight data models; need extension for share tokens, link metadata, and analytics events.
- Email service for verification and notifications.
- Frontend routing for shareable read-only pages and embed rendering.

## Implementation Plan

### Phase 1: Foundations (Highest Priority)
- Add database/table support for share links (token, scope, access level, expiration, attribution metadata).
- Implement username/nickname support and surface handles on comments/tasks to enable @mentions while protecting PII on shared views.
- Create read-only share page for insights/highlights with summary, evidence provenance, reactions, and CTA to request access or start a trial.
- Implement share link creation UI with default private settings and revoke/expiration controls.
- Instrument view/reaction/conversion tracking for each link; expose basic counts on the insight page.

### Phase 2: Embeds, Social Proof, and Task Integrations
- Publish embeddable highlight/summary cards (HTML/Markdown snippets) with light/dark themes and auto-refreshing content.
- Add social proof elements to shared pages (view counts, “Updated recently” badge, reactions surface) with rate limits.
- Improve share performance panel to show per-link metrics, trendlines, and “conversations this week / rolling 7 days.”
- Wire comments and feedback on shared pages into the existing Task system, enabling quick task creation/assignment to people or AI bots.

### Phase 3: Growth Loops & Expansion
- Add contextual prompts post-publish and post-interview to encourage sharing and embedding.
- Use planned Feed to surface new shared insights, embeds, and completed tasks; include light gamified prompts instead of building a new notification channel.
- Launch referral path for engaged viewers to start a guided trial or request access with sharer attribution.
- Workspace-level dashboard aggregating share performance, conversion, repeat-sharing behavior, and conversation momentum.
- Tighten governance: audit logs for link lifecycle events and workspace-level controls for sharing defaults.

## Acceptance Criteria
- Users can create, revoke, and monitor share links with configurable access levels and expirations.
- External viewers can access shared insights without full account creation and see provenance for evidence.
- Embed snippets render correctly in common surfaces (Notion/Markdown/email) and route viewers back to the app.
- Share performance metrics are visible to sharers and include reach, engagement, and conversion signals.
