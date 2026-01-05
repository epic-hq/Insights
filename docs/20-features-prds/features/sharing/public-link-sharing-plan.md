# Public Link Sharing - Implementation Plan

> **Status:** Planned | **Estimated:** 3-4 days (full) / 2 days (MVP)
> **Created:** December 2024

## Overview

Enable public, unauthenticated access to shared resources via unique share tokens. Users can generate shareable links that allow external viewers to see content without logging in.

### Current State

- **Team Sharing**: Users can invite others to their account via email (grants access to entire account)
- **Resource Share Menu**: Exists on interviews, insights, evidence, opportunities
- **No Public Access**: All content requires authentication

### Goal

Add "Make Public" toggle that generates a shareable link for individual resources, accessible without authentication.

---

## Architecture

### Database Schema Changes

Add to `interviews`, `insights`, `evidence` tables:

```sql
-- Add to each shareable resource table
ALTER TABLE interviews ADD COLUMN share_token text UNIQUE;
ALTER TABLE interviews ADD COLUMN is_public boolean DEFAULT false;

-- Index for fast lookups
CREATE INDEX idx_interviews_share_token ON interviews(share_token) WHERE share_token IS NOT NULL;
```

### Share Token Format

- Generated via `nanoid(12)` or similar (e.g., `x7Kj9mQ2pL4n`)
- URL format: `https://app.getupsight.com/s/{share_token}`
- Tokens are unique across all resource types

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/share/enable` | POST | Generate share_token, set is_public=true |
| `/api/share/disable` | POST | Set is_public=false (keep token for re-enable) |
| `/s/:token` | GET | Public route - resolve token, render resource |

---

## Implementation Phases

### Phase 1: Core Infrastructure (1-2 days)

- [ ] Database schema changes (add share_token, is_public to tables)
- [ ] Migration file via declarative schema diff
- [ ] `generateShareToken()` utility function
- [ ] DB functions: `enable_public_sharing()`, `disable_public_sharing()`
- [ ] Regenerate TypeScript types

### Phase 2: Public Routes (1 day)

- [ ] Create `/s/:token` route (unauthenticated)
- [ ] Token resolver: lookup resource by share_token
- [ ] Public view components (read-only versions)
  - [ ] PublicInterviewView
  - [ ] PublicInsightView
  - [ ] PublicEvidenceView
- [ ] Branding footer: "Powered by Upsight" + CTA
- [ ] 404 handling for invalid/disabled tokens

### Phase 3: Share Modal UI (1 day)

- [ ] Update `ResourceShareMenu` with public sharing toggle
- [ ] ShareLinkModal component:
  - [ ] Toggle: "Make publicly accessible"
  - [ ] Copy link button (shows public URL when enabled)
  - [ ] Warning about public access implications
  - [ ] Optional: QR code generation
- [ ] Loading/success states for enable/disable

### Phase 4: Analytics (Optional, 0.5 day)

- [ ] PostHog events for public views (anonymous tracking)
- [ ] View count display in share modal
- [ ] Metrics: views, unique visitors, referrers

---

## MVP Scope (2 days)

Minimum viable for initial release:

1. **Interviews only** - Start with single resource type
2. **Simple toggle** - No analytics, no QR codes
3. **Basic public view** - Read-only transcript + media player
4. **Copy link** - Just the URL, no fancy modal

### MVP Checklist

- [ ] `share_token` and `is_public` on interviews table
- [ ] `/s/:token` public route
- [ ] `PublicInterviewView` component
- [ ] "Copy public link" button in ResourceShareMenu
- [ ] Enable/disable API endpoint

---

## Security Considerations

- Share tokens should be unguessable (use crypto-random generation)
- Rate limit public route to prevent enumeration
- Consider token expiration (optional future feature)
- Log public access for audit trail
- No edit capabilities on public views
- No access to comments, notes, or team-only metadata

---

## UI/UX Notes

### Share Modal Design

```
┌─────────────────────────────────────────┐
│ Share "Interview with John"             │
├─────────────────────────────────────────┤
│                                         │
│ ○ Team only (current)                   │
│ ● Anyone with the link                  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ https://app.getupsight.com/s/x7Kj9 │ │
│ └─────────────────────────────────────┘ │
│                        [Copy Link]      │
│                                         │
│ ⚠️ Anyone with this link can view      │
│    this interview without signing in.   │
│                                         │
├─────────────────────────────────────────┤
│                              [Done]     │
└─────────────────────────────────────────┘
```

### Public View Header

```
┌─────────────────────────────────────────┐
│ 🔗 Shared Interview                     │
│ "Customer Discovery with Jane Doe"      │
│                                         │
│ Shared by Acme Research Team            │
├─────────────────────────────────────────┤
│                                         │
│     [Interview content here...]         │
│                                         │
├─────────────────────────────────────────┤
│ Powered by Upsight | Sign up free →     │
└─────────────────────────────────────────┘
```

---

## Related Files

- `app/features/sharing/components/ResourceShareMenu.tsx` - Existing share menu
- `app/routes/api.share-invite.tsx` - Team invite endpoint (reference)
- `docs/features/reels/reels-PRD.md` - Similar share_token pattern for reels

---

## Future Enhancements

- [ ] Token expiration (7 days, 30 days, never)
- [ ] Password-protected links
- [ ] Download restrictions
- [ ] Embed codes (iframe)
- [ ] Per-resource analytics dashboard
- [ ] Bulk enable/disable for multiple resources
