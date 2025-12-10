# Support View Feature - Technical Design

## Summary

| Aspect | Details |
|--------|---------|
| **Purpose** | Allow Upsight team to view app as any user for troubleshooting |
| **Access** | Platform admins only (set via `accounts.is_platform_admin`) |
| **Entry Point** | User Profile dropdown → "Support View" (only visible to admins) |
| **Flow** | Support View page → Search/Select Account → Select Project → View as User |
| **Session Storage** | Encrypted cookie (per-browser, not per-tab) |
| **Session Limit** | 1 hour max |
| **Key Design** | **Zero loader changes** - middleware swaps Supabase client |
| **LOE Phase 1** | 2 days (read-only support view) |
| **LOE Phase 2** | 1.5 days additional (audit logging + actions) |

---

## Overview

Support View allows designated platform administrators to view the application as a specific user would see it, enabling effective troubleshooting and support without requiring the user to share their screen or credentials.

## Problem Statement

When users report issues, support staff currently cannot:
- See the exact data the user sees
- Reproduce issues in their specific context
- Execute operations on behalf of users (e.g., trigger reprocessing)
- Verify that fixes work for the specific user's data

## Goals

1. **View as User**: See the app exactly as a target user would, respecting their account/project context
2. **Execute Actions**: Optionally perform actions on behalf of users (with audit logging)
3. **Security**: Maintain strict access control and audit trail
4. **Minimal Disruption**: No changes to the user's actual session or data ownership

## Non-Goals

- Full identity takeover (we won't create real sessions as the user)
- Access to user's authentication credentials
- Bypassing billing or subscription limits

---

## Technical Design

### 1. Platform Admin Designation

**Approach**: Add `is_platform_admin` boolean to `accounts.accounts` table

```sql
-- New column on accounts.accounts
ALTER TABLE accounts.accounts
ADD COLUMN is_platform_admin BOOLEAN DEFAULT FALSE;

-- Only settable via direct database access (not exposed in UI)
-- This designates accounts whose owners can use Support View
```

**Why accounts table vs auth.users.app_metadata?**
- Accounts table is already in our control and schema
- No need to modify Supabase auth configuration
- Can easily query and enforce in RLS policies
- Clear audit trail via existing `updated_at`/`updated_by`

**Who gets it?**
- Initially: Upsight team accounts only (set manually via SQL)
- Checked via: User must be `owner` of an account where `is_platform_admin = true`

**Platform Admin Check Hook:**
```typescript
// app/features/admin/hooks/usePlatformAdmin.ts
import { useRouteLoaderData } from "react-router-dom"

interface ProtectedLayoutData {
  accounts?: Array<{
    account_id: string
    role: string
    is_platform_admin?: boolean
  }> | null
}

export function usePlatformAdmin() {
  const data = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedLayoutData | null

  // Check if user is owner of any platform admin account
  const isPlatformAdmin = data?.accounts?.some(
    (account) => account.role === "owner" && account.is_platform_admin === true
  ) ?? false

  return { isPlatformAdmin }
}
```

**Loader Changes:**
The `_ProtectedLayout` loader needs to include `is_platform_admin` in the accounts query:
```typescript
// In _ProtectedLayout loader
const { data: accounts } = await supabase
  .from('account_user')
  .select(`
    account_id,
    role,
    account:accounts!inner(
      id,
      name,
      is_platform_admin  // Add this field
    )
  `)
  .eq('user_id', user.id)
```

### 2. Support View Context

**New context type:**
```typescript
// app/server/support-view-context.ts
export type SupportViewContext = {
  isActive: boolean
  targetAccountId: string | null
  targetUserId: string | null
  targetProjectId: string | null
  realUser: {
    id: string
    email: string
    accountId: string
  }
  startedAt: Date
  expiresAt: Date  // Max 1 hour
}
```

**Storage**: Session cookie (encrypted, httpOnly)
- Stored separately from auth session
- Short-lived (1 hour max)
- Contains: target account ID, target user ID, real admin user ID, timestamp

### 3. Data Access Pattern - CRITICAL DESIGN DECISION

**Goal:** Zero changes to existing loaders. Handle everything in middleware.

#### Why This Works

Current loader pattern:
```typescript
// Loaders already do this:
const ctx = context.get(userContext)
const supabase = ctx.supabase        // Gets whatever client middleware provided
const accountId = params.accountId    // From URL: /a/{accountId}/{projectId}
const projectId = params.projectId

// Query uses URL params for scoping
const { data } = await supabase
  .from('interviews')
  .select('*')
  .eq('project_id', projectId)
```

When in support view:
1. **URL is target user's URL**: `/a/{targetAccountId}/{targetProjectId}/...`
2. **Middleware swaps `ctx.supabase`** to admin client (bypasses RLS)
3. **Loaders query normally** using URL params → data comes from target account

**Result:** Loaders don't know or care if they're in support view. The middleware handles it.

#### Implementation: Middleware-Only Approach

```typescript
// In _ProtectedLayout middleware (simplified)
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context, params }) => {
    const user = await getAuthenticatedUser(request)
    if (!user) throw redirect('/login')

    // Check for support view cookie
    const supportSession = getSupportViewCookie(request)

    let supabase: SupabaseClient
    let isSupportView = false
    let supportViewContext = null

    if (supportSession && !isExpired(supportSession)) {
      // Validate: is user a platform admin?
      const adminClient = createSupabaseAdminClient()
      const { data: adminAccount } = await adminClient
        .from('account_user')
        .select('accounts!inner(is_platform_admin)')
        .eq('user_id', user.sub)
        .eq('role', 'owner')
        .eq('accounts.is_platform_admin', true)
        .single()

      if (!adminAccount) {
        // Not a platform admin - clear cookie and continue normally
        clearSupportViewCookie()
      } else {
        // Valid support view - USE ADMIN CLIENT
        supabase = adminClient
        isSupportView = true
        supportViewContext = {
          targetAccountId: supportSession.targetAccountId,
          targetProjectId: supportSession.targetProjectId,
          targetUserEmail: supportSession.targetUserEmail,
          expiresAt: supportSession.expiresAt,
          realUser: { id: user.sub, email: user.email }
        }
      }
    }

    if (!isSupportView) {
      // Normal flow - use RLS client
      const jwt = user.jwt || user.access_token
      supabase = jwt ? getRlsClient(jwt) : getServerClient(request).client
    }

    // Set context - loaders use this supabase client
    context.set(userContext, {
      claims: user,
      supabase,                    // <-- Admin client if support view
      isSupportView,               // <-- For UI banner
      supportViewContext,          // <-- Details for banner display
      // ... rest of normal context
    })
  }
]
```

#### Cookie Structure

```typescript
// Stored in encrypted httpOnly cookie: `support_view_session`
interface SupportViewCookie {
  targetAccountId: string
  targetProjectId: string
  targetUserEmail: string      // For display in banner
  targetAccountName: string    // For display in banner
  expiresAt: number            // Unix timestamp, max 1 hour from start
  realUserId: string           // Admin's actual user ID
}
```

#### Session Lifecycle

1. **Start**: Admin clicks "View" on project → POST `/api/admin/start-support-view`
   - Validates admin is platform admin
   - Sets cookie with target account/project
   - Redirects to `/a/{targetAccountId}/{targetProjectId}`

2. **Active**: Every request through `_ProtectedLayout`
   - Middleware reads cookie
   - Swaps supabase client to admin client
   - Loaders work normally using URL params

3. **End**: Admin clicks "Exit Support View" → POST `/api/admin/end-support-view`
   - Clears cookie
   - Redirects to `/admin/support`

4. **Expire**: Cookie has `expiresAt`, middleware checks on each request
   - If expired: clear cookie, redirect to `/admin/support`

#### Trade-offs Accepted

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| Cookie-based (not URL param) | Can't have support view + personal view in different tabs | Simpler implementation, acceptable for internal tool |
| Per-browser session | Opening new tab continues support view | Consistent UX, avoids URL pollution |
| 1 hour max duration | Must re-enter if troubleshooting takes longer | Security boundary, prevents forgotten sessions |

**Action mode (Phase 2):**
- Specific allowlisted actions only
- Full audit logging
- Confirmation dialogs

### 4. User Flow & UI Components

#### 4.1 Accessing Admin Features

**Entry Point: User Profile Menu**

Platform admins will see an additional "Admin" link in their user profile dropdown menu (UserProfile.tsx):

```
┌────────────────────────────────────┐
│ 👤 Richard Moy                     │
│    richard@upsight.ai              │
├────────────────────────────────────┤
│ 👤 Profile                         │
│ 👥 Manage Team                     │
│ ⚙️  Account Settings               │
│ ─────────────────────────────────  │
│ 🛠️  Admin Console    ← NEW         │
│ ─────────────────────────────────  │
│ 🌙 Theme        [Toggle]           │
│ ─────────────────────────────────  │
│ 🚪 Sign out                        │
└────────────────────────────────────┘
```

**Conditional Display**: The "Admin Console" menu item only appears if:
- User is authenticated
- User is owner of at least one account where `is_platform_admin = true`

#### 4.2 Admin Console Page

**Route**: `/admin`

The Admin Console serves as a hub for platform admin features. Initially it will have Support View, but can be extended with other admin features (metrics, usage stats, etc.).

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🛠️  Admin Console                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 👁️  Support View                                                    │ │
│  │ View the app as any user to troubleshoot issues                    │ │
│  │                                                         [Enter →]  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📊 Platform Metrics (Future)                                        │ │
│  │ View usage statistics across all accounts                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📜 Recent Support Sessions                                          │ │
│  │ ─────────────────────────────────────────────────────────────────  │ │
│  │ Dec 9, 2025 • Acme Corp → Project Alpha • 45 min                   │ │
│  │ Dec 8, 2025 • Globex Inc → Sales Q4 • 22 min                       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.3 Support View Selection Flow

**Route**: `/admin/support`

**Step 1: Select Account**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 👁️  Support View                                          [← Back]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Step 1 of 2: Select Account                                            │
│  ────────────────────────────────────────────────────────────────────   │
│                                                                          │
│  🔍 [Search accounts by name or owner email...              ]           │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🏢 Acme Corporation                                                 │ │
│  │    Owner: john@acme.com • 3 projects • Created: Jan 2024           │ │
│  │                                                         [Select →] │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 🏢 Globex Industries                                                │ │
│  │    Owner: sarah@globex.io • 5 projects • Created: Mar 2024         │ │
│  │                                                         [Select →] │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 🏢 Initech Labs                                                     │ │
│  │    Owner: mike@initech.com • 1 project • Created: Nov 2024         │ │
│  │                                                         [Select →] │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Showing 3 of 47 accounts                              [Load more...]   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Step 2: Select Project**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 👁️  Support View                                          [← Back]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Step 2 of 2: Select Project                                            │
│  Account: Acme Corporation (john@acme.com)                              │
│  ────────────────────────────────────────────────────────────────────   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 📁 Customer Research Q4                                             │ │
│  │    12 interviews • 45 themes • Last activity: 2 hours ago          │ │
│  │                                                         [View →]   │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 📁 Product Discovery                                                │ │
│  │    8 interviews • 23 themes • Last activity: 5 days ago            │ │
│  │                                                         [View →]   │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │ 📁 Sales Conversations                                   [Sales]   │ │
│  │    34 interviews • 67 themes • Last activity: 1 day ago            │ │
│  │                                                         [View →]   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ⚠️ Support view sessions expire after 1 hour.                          │
│  All actions are logged for audit purposes.                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.4 Active Support View Banner

When Support View is active, a prominent banner appears at the top of every page:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔧 SUPPORT VIEW ACTIVE                                                   │
│ Viewing as: john@acme.com • Account: Acme Corporation                   │
│ Project: Customer Research Q4 • Expires in 45 min                       │
│                                                    [Exit Support View]  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Banner Behavior:**
- Fixed at top of viewport (above main navigation)
- Cannot be dismissed except by clicking "Exit Support View"
- Uses distinct styling (e.g., amber/warning background) to be unmistakable
- Shows countdown timer for session expiration
- Clicking "Exit Support View" logs the session end and redirects to `/admin/support`

#### 4.5 Support View Entry Point (Alternative)

In addition to the User Profile menu, the Admin Console link can optionally appear in the sidebar footer for platform admins (near the Settings link):

```
┌─────────────────────┐
│ ...                 │
│ ⚙️ Settings         │
│ 🛠️ Admin           │  ← Only visible to platform admins
│ ───────────────────│
│ 👤 User Profile    │
└─────────────────────┘
```

#### 4.6 UserProfile.tsx Integration

Example code changes for UserProfile.tsx to show Admin Console link:

```tsx
// In UserProfile.tsx
import { usePlatformAdmin } from "~/features/admin/hooks/usePlatformAdmin"
import { Shield } from "lucide-react"

export function UserProfile({ collapsed = false, className }: UserProfileProps) {
  const { isPlatformAdmin } = usePlatformAdmin()
  // ... existing code ...

  return (
    // ... existing JSX ...
    <DropdownMenuGroup>
      <DropdownMenuItem asChild>
        <Link to={PATHS.PROFILE} className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span>Profile</span>
        </Link>
      </DropdownMenuItem>
      {/* ... other menu items ... */}

      {/* Platform Admin - Admin Console link */}
      {isPlatformAdmin && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/admin" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Admin Console</span>
            </Link>
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuGroup>
    // ... rest of JSX ...
  )
}
```

### 5. Authorization Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Authorization Check                          │
├─────────────────────────────────────────────────────────────────┤
│ 1. Is user authenticated?                                       │
│    └─ No → Redirect to login                                    │
│                                                                  │
│ 2. Is user owner of any account with is_platform_admin = true? │
│    └─ No → 403 Forbidden                                        │
│                                                                  │
│ 3. Has support view session expired?                            │
│    └─ Yes → Clear session, redirect to /admin/support           │
│                                                                  │
│ 4. Proceed with support view context                            │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Audit Logging

**New table: `support_view_sessions`**
```sql
CREATE TABLE public.support_view_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  admin_account_id UUID NOT NULL REFERENCES accounts.accounts(id),
  target_account_id UUID NOT NULL REFERENCES accounts.accounts(id),
  target_user_id UUID REFERENCES auth.users(id),
  target_project_id UUID REFERENCES projects(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  actions_taken JSONB DEFAULT '[]',
  ip_address INET,
  user_agent TEXT
);
```

**Actions logged:**
- Session start/end
- Pages visited
- Any mutations performed (Phase 2)

---

## Implementation Phases

### Phase 1: Read-Only Support View (MVP)
**LOE: 2 days**

| Task | Effort |
|------|--------|
| **Database** | |
| Add `is_platform_admin` column to accounts | 0.5h |
| **Cookie & Context** | |
| Create cookie helpers (`getSupportViewCookie`, `setSupportViewCookie`) | 1h |
| Add `isSupportView`, `supportViewContext` to UserContext type | 0.5h |
| **Middleware (THE KEY CHANGE)** | |
| Modify `_ProtectedLayout` middleware to detect cookie & swap client | 2h |
| **UI: Entry Point** | |
| Create single `/admin/support` page (search + inline project list) | 3h |
| Add "Support View" link to UserProfile dropdown (conditional) | 0.5h |
| **UI: Active State** | |
| Create support view banner component | 1h |
| Render banner in `_ProtectedLayout` when `isSupportView` is true | 0.5h |
| **API** | |
| Create `POST /api/admin/start-support-view` (set cookie, redirect) | 1h |
| Create `POST /api/admin/end-support-view` (clear cookie, redirect) | 0.5h |
| **Testing** | |
| Test middleware swap, cookie lifecycle, banner display | 3h |

**Total: ~14 hours (2 days)**

**Key simplifications from previous design:**
- No Admin Console hub page (direct link to support view)
- No separate project selection page (inline in account list)
- No audit logging table (Phase 2)
- No recent sessions display (Phase 2)
- Zero loader changes (middleware handles everything)

### Phase 2: Audit Logging & Actions
**LOE: 1.5 days additional**

| Task | Effort |
|------|--------|
| **Audit Logging** | |
| Create `support_view_sessions` table | 0.5h |
| Log session start/end to table | 1h |
| Add recent sessions display to `/admin/support` | 1.5h |
| **Action Execution** | |
| Define allowlisted actions (reprocess interview, etc.) | 0.5h |
| Create action confirmation modal | 1.5h |
| Implement action execution with logging | 2h |
| **Testing** | |
| Testing | 2h |

**Total: ~9 hours (1.5 days)**

### Phase 3: Enhanced Features (Future)
- Platform admin console hub with metrics
- Per-tab support view (URL param approach)
- Time-limited access tokens shared via email
- Screen recording of support sessions

---

## Database Changes

### Phase 1 Migration: Add is_platform_admin

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_platform_admin.sql

-- Add platform admin flag to accounts
ALTER TABLE accounts.accounts
ADD COLUMN is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN accounts.accounts.is_platform_admin IS
  'Designates accounts whose owners can access Support View for troubleshooting';
```

**That's it for Phase 1.** No audit table needed - cookie provides session management.

### Phase 2 Migration: Add audit logging (optional)

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_support_sessions.sql

CREATE TABLE public.support_view_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  target_account_id UUID NOT NULL REFERENCES accounts.accounts(id),
  target_project_id UUID REFERENCES public.projects(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  actions_taken JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Only platform admins can read their own sessions
ALTER TABLE public.support_view_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read own sessions"
  ON public.support_view_sessions
  FOR SELECT
  USING (admin_user_id = auth.uid());

CREATE INDEX idx_support_sessions_admin
  ON public.support_view_sessions(admin_user_id, started_at DESC);
```

---

## File Structure (Simplified)

```
app/
├── features/
│   └── admin/
│       ├── routes.ts                    # Single route: /admin/support
│       ├── pages/
│       │   └── support.tsx              # Account search + inline project selection
│       └── components/
│           └── SupportViewBanner.tsx    # Persistent banner when in support view
├── lib/
│   └── supabase/
│       └── client.server.ts             # Add: getSupportViewCookie, setSupportViewCookie
├── server/
│   └── user-context.ts                  # Add: isSupportView, supportViewContext fields
├── components/
│   └── auth/
│       └── UserProfile.tsx              # Add: conditional "Support View" link
├── routes/
│   ├── _ProtectedLayout.tsx             # MAIN CHANGE: middleware detects cookie, swaps client
│   ├── api.admin.start-support-view.tsx # POST: set cookie, redirect to target
│   └── api.admin.end-support-view.tsx   # POST: clear cookie, redirect to /admin/support
```

### Route Structure

```typescript
// app/features/admin/routes.ts
import { route } from "@react-router/dev/routes"

export default [
  route("admin/support", "./features/admin/pages/support.tsx"),
]

// API routes added directly to app/routes.ts:
// route("api/admin/start-support-view", "./routes/api.admin.start-support-view.tsx"),
// route("api/admin/end-support-view", "./routes/api.admin.end-support-view.tsx"),
```

### Files Modified (Existing)

| File | Change |
|------|--------|
| `app/lib/supabase/client.server.ts` | Add cookie helpers |
| `app/server/user-context.ts` | Add support view fields to type |
| `app/routes/_ProtectedLayout.tsx` | Middleware: detect cookie, swap client, pass to context |
| `app/components/auth/UserProfile.tsx` | Add conditional "Support View" link |

### Files Created (New)

| File | Purpose |
|------|---------|
| `app/features/admin/routes.ts` | Route config |
| `app/features/admin/pages/support.tsx` | Account/project selection UI |
| `app/features/admin/components/SupportViewBanner.tsx` | Active session banner |
| `app/routes/api.admin.start-support-view.tsx` | Start session API |
| `app/routes/api.admin.end-support-view.tsx` | End session API |

---

## Security Considerations

1. **Access Control**
   - Only owners of `is_platform_admin` accounts can access
   - Cannot be self-granted via UI
   - Requires direct database modification

2. **Session Limits**
   - 1 hour maximum duration
   - Explicit end session action
   - Auto-expire on browser close

3. **Audit Trail**
   - All sessions logged with timestamps
   - IP address and user agent recorded
   - Actions taken are logged (Phase 2)

4. **Data Access**
   - Uses admin client (bypasses RLS) but scoped to target account
   - No access to auth credentials or tokens
   - Read-only by default (Phase 1)

5. **Visual Indicators**
   - Prominent banner showing support view is active
   - Cannot be hidden or dismissed (except by ending session)
   - Different background color/styling as extra indicator

---

## Success Metrics

- Time to resolve support tickets reduced by 50%
- Ability to reproduce reported issues within 5 minutes
- Zero security incidents from support view access
- 100% of support view sessions logged

---

## Open Questions

1. Should we notify users when their account is being viewed?
2. Should there be a way to request time-limited access from users?
3. Do we need different permission levels (view-only vs action-capable)?
4. Should support view sessions be visible to account owners?

---

## Appendix: Platform Admin Designation

Initially, the following accounts will have `is_platform_admin = true`:

```sql
-- Set during initial deployment (manual)
UPDATE accounts.accounts
SET is_platform_admin = true
WHERE id IN (
  -- Upsight team accounts
  'your-upsight-account-id-here'
);
```

To add new platform admins:
1. Identify the account ID
2. Run UPDATE statement directly in database
3. Log the change in internal documentation
