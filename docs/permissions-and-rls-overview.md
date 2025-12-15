# Team access and permissions

## User-facing guide (plain language)
- **Owners**: Full control of the team account. They can manage billing, invite or remove teammates, and delete projects when needed. Best for founders or administrators.
- **Members**: Collaborators who can work inside projects. Under the current policies, members can create and edit project content just like owners but cannot promote/demote other teammates or change billing.
- **Viewers**: Intended as read-only collaborators, but today they inherit the same in-product editing rights as members because row-level security (RLS) only checks whether you belong to the account.
- **Switching between teams/projects**: Use the project switcher in the upper-left navigation to jump between accounts and their projects; it lists all teams returned by the protected layout loader and updates your last used project when you pick one.

## How access is enforced today
- Account membership and roles are stored in `accounts.account_user` with the `account_role` enum (`owner`, `member`, `viewer`). Utility helpers (`accounts.has_role_on_account`, `accounts.get_accounts_with_role`) drive most RLS checks. 【F:supabase/schemas/02_accounts.sql†L22-L387】
- RLS on projects gates rows by account membership: any authenticated user belonging to the account can select, insert, or update project records; only owners can delete them. 【F:supabase/schemas/10_projects.sql†L81-L118】
- The switcher UI reads the preloaded account list and navigates to the chosen account/project, updating the last-used path as you switch. 【F:app/components/navigation/AccountProjectSwitcher.tsx†L33-L169】
- Role-aware RPCs exist for administrative actions—e.g., updating teammate roles requires being an owner via `accounts.has_role_on_account`, and fetching the current user’s account role uses `current_user_account_role`. 【F:supabase/schemas/02_accounts.sql†L410-L501】

## Gaps and risks
- **Viewer rights are not enforced**: Project policies allow any account member (including viewers) to insert and update records, so “viewer” currently behaves like “editor.” This makes it easy to promise read-only access but deliver edit capabilities instead. 【F:supabase/schemas/10_projects.sql†L81-L107】
- **Role granularity stops at the account level**: RLS checks membership on the parent account, not per-project roles or finer scopes. If we later need project-specific permissions (e.g., private projects within a team), the current model will overexpose data.
- **Deletion is the only owner-only control in projects**: Owners are required for deletes, but other privileged operations (creating content, editing metadata) are open to any member; the distinction between owners and members is limited to billing/invitations and delete checks. 【F:supabase/schemas/02_accounts.sql†L347-L387】【F:supabase/schemas/10_projects.sql†L81-L118】
- **Account listing trusts loader data**: The project switcher displays whatever accounts the protected loader returns. If that loader ever misidentifies `currentAccount` or returns a stale list, users could see switches they cannot actually open; adding a permission-aware loading state or error surfacing would improve clarity. 【F:app/components/navigation/AccountProjectSwitcher.tsx†L33-L169】

## Recommendations to close gaps
- Enforce viewer read-only semantics by adding role-aware `using/with check` clauses (e.g., permit `select` for viewers, restrict `insert/update/delete` to members/owners) across project-scoped tables.
- Consider project-level roles or ACL fields if some projects need restricted membership inside a shared account.
- Harden the project switcher UX to surface permission errors (e.g., expired membership) and confirm the selected account/project is still accessible after navigation.
