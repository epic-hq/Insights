# Distribution & Growth Research

## Purpose
Establish how to build sustainable distribution loops for the app by understanding user motivations, sharing behaviors, and the channels that reliably move new teams from awareness to activation.

## Research Inputs
- Stakeholder conversations about desired growth loops (sharing insights to attract adjacent teams).
- Review of current product analytics (activation drop-offs around project creation and invite flow).
- Competitive teardown of research/insight platforms with viral sharing patterns (public read-only links, highlights embeds, social proof banners).
- Competitor activation & growth loop research across BuildBetter, Gong, Clari, VoicePanel, and Dovetail to identify which tactics measurably convert viewers into participants.
- Heuristic analysis of current onboarding, sharing, and collaboration touchpoints.

## Competitive Activation & Growth Loops
- **BuildBetter**: emphasizes frictionless scheduling and automated note sharing; rapid calendar-driven invite flows and AI-summarized recaps keep interview momentum high and reduce time-to-first-share.
- **Gong**: strong looping between call insights and pipeline visibility; exec dashboards and alert feeds showcase outcomes, prompting shares to leadership and adjacent teams; clear attribution from listener to deal impact reinforces advocacy.
- **Clari**: adoption is driven by forecast accountability—team rollups and risk alerts push users back into the product weekly; “one-click share” of deal health to Slack/email sustains engagement.
- **VoicePanel**: lightweight participant recruitment plus SMS/email reminders accelerate interview completion; public-style preview links for panels make it easy to validate scripts and capture early feedback.
- **Dovetail**: polished public links and highlight embeds are core; viewers can request access and leave reactions; templates and project checklists shorten activation and encourage repeat sharing.

**Actionable takeaways**
- Prioritize calendar/email/SMS-powered interview scheduling and reminders to lift time-to-first-interview (BuildBetter, VoicePanel).
- Ship polished read-only links with reactions and request-access to turn passive viewers into collaborators (Dovetail).
- Use Feed surfaces and alerting to spotlight new insights and risks, mirroring Gong/Clari’s loop of “insight ➜ exec visibility ➜ follow-up.”
- Tie shares and mentions to attributable outcomes (e.g., sign-ups, task completions) so sharers get credit, encouraging ongoing distribution.

## Key Findings
1. **Primary audiences**
   - Research leads want polished, controlled sharing to stakeholders.
   - Cross-functional collaborators (product, design, marketing) prefer fast, lightweight access without logins.
   - Consultants need to interview multiple people, reconcile perspectives, and assemble consensus narratives they can present to clients or steering groups; they value efficient capture of interviews, attribution of who said what, and lightweight sharing to validate alignment.
   - Executives care about digestible summaries and proof of traction.
2. **Motivations to share**
   - Show evidence-backed recommendations to unblock decisions.
   - Request feedback on drafts before finalizing insights.
   - Publicly showcase credibility (case studies, snippets) to attract partners and customers.
3. **Friction points in current flow**
   - Sharing requires adding members to the workspace; no lightweight link-sharing with access controls.
   - Insights are dense; recipients need quick, skimmable highlight or summary views.
   - No built-in prompt to share at natural moments (after publishing an insight or completing interviews).
   - Lack of trackable links and attribution prevents measuring distribution loop performance.
   - Identity is inconsistent (no nicknames/usernames) which limits @mentions in comments/tasks and cross-surface recognition for external recipients.
4. **Effective distribution channels**
   - **Direct share**: shareable links to read-only insight pages with inline highlights.
   - **Embedding**: drop a highlight or summary embed into Notion, wikis, or email updates.
   - **Social proof**: optional banners/badges showing project momentum (views, reactions) encourage resharing.
   - **Invites**: contextual invite prompts that offer single-insight access for fast collaboration.
5. **Opportunities for loops**
   - **Publish ➜ share**: Prompt users to share when they publish or update an insight; recipients can react and request access.
   - **Highlights ➜ embeds**: Convert key quotes or findings into embeddable cards; embeds link back to the app.
   - **Referrals**: Recipients who engage (view/react) can start a lightweight project or trial with attribution to the sharer.
   - **Analytics feedback**: Share dashboards show reach, engagement, and conversion to sign-ups, reinforcing sharing behavior.
   - **Conversation momentum**: Light gamification (e.g., “Conversations this week / last 7 days”) nudges consultants and researchers to schedule and log more interviews using existing calendar/email/SMS integrations.
   - **Task-driven follow-through**: Use the existing Task system (including AI bot assignees) to turn feedback or comments into actionable next steps, improving speed-to-insight and giving sharable proof of progress.
   - **Feed amplification**: Planned Feed surface can highlight new insights, completed tasks, and embeddable cards, encouraging resharing without building net-new channels.

## Success Metrics
- Share rate: % of published insights that generate at least one external share.
- External engagement: unique viewers, reactions, and time-on-page for shared insights.
- Conversion: % of viewers who start a trial/project or request access.
- Retention: repeat sharing rate per active researcher per month.

## Constraints & Principles
- Respect privacy and confidentiality; default to restricted access with explicit controls.
- Keep sharing lightweight (no forced account creation for read-only consumption).
- Preserve evidence integrity; shared views must show provenance and timestamps.
- Provide measurable links for attribution and loop tuning.
