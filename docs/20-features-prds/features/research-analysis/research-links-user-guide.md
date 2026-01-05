## Research Links - Quick User Guide

Research Links let you collect survey- or interview-style responses from participants with a sharable public URL. Responses are stored as `research_link_responses` and can be turned into Evidence for analysis.

### Where to find it
- In-app: People → “Research link responses” button.
- URL: `/a/:accountId/research-links`.

### Create a research link
1) Click “New research link”.  
2) Fill in:
   - Name + slug (slug becomes the public URL path `/research/:slug`).
   - Hero copy (title/subtitle/CTA/helper) to set the landing screen.
   - Optional calendar URL (for scheduling) or redirect URL after completion.
   - Enable chat if you want an AI chat response mode; otherwise, default is form.
3) Add questions:
   - Types: auto, short text, long text, single select, multi select.
   - For selects, provide options. Mark required if needed.
4) Save. You’ll land on the edit page; use the public link shown there.

### Sharing
- Public link format: `/research/:slug` (no login required).
- You can keep the link in Draft by leaving “Live” off; set Live to collect responses.

### Viewing responses
1) From the index, click “View responses”.
2) See collected responses with email, answers, and completion state.
3) Export CSV for sharing or backup.
4) Each completed response can create/update an Evidence record for downstream Insights/Themes.

### Editing a live link
- Slug must be unique. Updating hero copy, questions, or toggles will update the experience immediately.
- Changing questions after collecting responses may leave older responses with missing/extra fields; handle in exports accordingly.

### Permissions & scope
- Account-scoped: All links live at `/a/:accountId/research-links` and are not project-scoped.
- Access obeys account member policies (RLS on `research_links` and `research_link_responses`).

### Troubleshooting
- “Could not find a relationship … research_links … research_link_responses”: ensure the DB migration `70_research_links.sql` is applied so the foreign key exists, or fetch responses separately without a join. The app uses the explicit FK join alias `research_link_responses!research_link_id_fkey`.
-(Prod) If responses don’t create Evidence, confirm the list is Live and completion is set; check Supabase logs for insert/update errors.
