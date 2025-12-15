# External sharing and account-level access

## What happens today
- **Accepting an invitation grants account-wide access.** The `accept_invitation` RPC inserts the invitee into `accounts.account_user` with the role encoded on the invitation token, giving them access to every project in that account because project RLS only checks account membership for select/insert/update and reserves delete for owners.
- **Sharing menu emails don’t gate access.** The `ResourceShareMenu` copies a project-scoped URL or emails a link via `/api/share-invite`, but the backend only sends an email—it does not create a limited-access share or temporary session. Recipients must already have access or accept an account invitation elsewhere.

## Risk: inviting customers exposes the whole account
Because invitations are account-scoped, adding an external reviewer (e.g., a customer) would make them a member with read access to all projects and the ability to edit most project-scoped tables (viewers are not enforced as read-only today). This can unintentionally expose unrelated recordings, insights, and evidence across the account.

## Recommendations (secure growth without oversharing)
1. **Add resource-scoped sharing instead of account invites for customers.** Provide time-bound, read-only links or guest roles scoped to a specific interview/insight/evidence item with server-side checks, so external viewers can’t pivot into the rest of the account.
2. **Harden viewer semantics.** Enforce RLS that limits viewers to `select` on project content; reserve write operations for members/owners so customer guests cannot edit data.
3. **Offer project-level guest access.** When full context is needed, issue project-scoped guest invites with optional link expiry and download controls, rather than granting account-wide membership.
4. **Audit link delivery paths.** Make sure share emails note whether access requires login; if not, generate signed, expiring links with scope baked into the token.

## Proposal: resource-level permissions and low-friction sharing
- **Fine-grained access levels:** For each shareable item (interview, insight, evidence, lens, opportunity), support `viewer` (read-only), `editor` (update/comment), and future `owner`/`delete` operations. Maintain a `resource_shares` table keyed by resource type/id, grantee user or email, role, and optional expiry.
- **Scoped tokens for non-members:** Generate signed, expiring tokens (e.g., JWT or Supabase signed data) tied to `resource_shares` entries. RLS checks accept either account membership or a valid share token scoped to that resource/role. This prevents a customer invite from implicitly granting account-wide access while still enabling easy share links.
- **Time-bound links to reduce leakage:** Store `expires_at` on `resource_shares` and encode it into signed tokens so links naturally time out. Offer presets (24h/7d/30d) and a “disable anytime” toggle for revocation.
- **Low-cost growth path (MVP ~1.5–2.5 engineering days):**
  - Add a minimal `resource_shares` table and RLS policy that allows `select` on a single resource when a valid signed token with matching `resource_type/resource_id` is presented.
  - Extend the existing `ResourceShareMenu` to create share tokens via a lightweight API (`/api/share-resource`) that returns a signed URL and emails it through Engage (re-using the current send pipeline).
  - Gate the shared page loader to accept the token and show a narrow read-only view (no switcher, no project navigation) to avoid account-wide exposure.
  - Include a “request edit access” CTA for growth that funnels to a formal invite when appropriate.
- **Future-ready refinements:** Layer project-level guest roles (read-only project scope) and per-action controls (download/export toggles) after the MVP to mirror common industry patterns without a large upfront rewrite.

## Benchmarks from adjacent products
- **Gong / Clari (revenue intelligence):** External deal reviews use read-only share links or guest seats scoped to specific calls/deals; permissions can disable downloads and expire links to minimize data spill.
- **Fathom / Fireflies (meeting copilot):** Meeting share links are view-only by default and often time-limited; external viewers can’t browse the rest of the workspace without an explicit workspace invite.
- **Notion / Google Docs (docs analogy):** Distinguish between “share the doc” (link with role) and “invite to workspace”; the former is the safe default for external collaborators.
- **Grain / Loom (recording & clips):** Default to scoped, expiring viewer links; collaborators need explicit upgrade to edit or workspace membership, reinforcing the separation between “share this asset” and “join the team.”

## Clarifying the customer-sharing question
- **Current behavior:** Inviting an external customer via the invite flow adds them to `accounts.account_user`, which grants account-wide project read/write (except deletes) due to the existing RLS model. Sharing a link today does not create scoped access, so customers either get nothing (if not logged in) or everything (once invited).
- **Recommended path to enable growth safely:** Default to resource-scoped, expiring viewer links for “share this recording/insight” so customers can see a specific asset without entering the account. Promote full account invites only after an explicit upsell moment (e.g., “Want to collaborate? Request workspace access”), keeping the growth loop while containing exposure.

## Next steps to close the gap
- Implement scoped share tokens for interviews/insights/evidence with expiring signatures and optional passcodes.
- Introduce a “guest reviewer” project role that can only `select` in that project and cannot navigate the switcher.
- Update the share UI to default to scoped links for externals and clearly label when an action will invite someone to the entire account.
