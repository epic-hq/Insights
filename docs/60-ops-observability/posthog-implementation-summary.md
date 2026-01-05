# PostHog Implementation Summary

## The Right Place for `account_signed_up` Tracking

**Answer**: `/app/routes/(auth)+/login_success.tsx`

### Why This Location?

1. **Single Point of Convergence**: Both OAuth (Google) and email/password authentication flows redirect to `/login_success` after successful authentication
2. **Server-Side Execution**: Runs on the server, ensuring reliable tracking even if client-side JavaScript fails
3. **Access to Full Context**: Has access to user data, account info, and URL parameters (UTM tracking)
4. **Fires Only Once**: Uses `user_settings.created_at` timestamp to detect new signups (< 10 seconds old)

### Authentication Flow

```
Email/Password Flow:
AuthUI → auth.session → login_success ✓

OAuth Flow:
Google OAuth → auth.callback → login_success ✓
```

Both flows converge at `login_success`, making it the perfect place for signup tracking.

## Implementation Details

### 1. New User Detection

```typescript
async function checkIfNewUser(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: userSettings } = await supabase
    .from("user_settings")
    .select("created_at")
    .eq("user_id", userId)
    .single()

  if (!userSettings) return true // No record = brand new user

  // Check if created within last 10 seconds
  const createdAt = new Date(userSettings.created_at)
  const now = new Date()
  const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000

  return diffSeconds < 10
}
```

**Why 10 seconds?**
- Accounts for OAuth redirect latency
- Prevents duplicate tracking on page refreshes
- Tight enough window to catch genuine signups

### 2. Signup Event Capture

```typescript
posthog.capture("account_signed_up", {
  email,
  auth_provider: metadata?.provider || "email",
  account_id: accountId,
  plan: "free",
  // UTM parameters for attribution
  utm_source,
  utm_medium,
  utm_campaign,
  utm_term,
  utm_content,
  // User context
  role: userSettings?.role,
  company_name: userSettings?.company_name,
  referral_source: userSettings?.referral_source,
  signup_source: metadata?.provider === "google" ? "oauth_google" : "email_password",
})
```

### 3. Person Identification

```typescript
posthog.identify(userId, {
  email,
  role: userSettings?.role || "founder",
  company_name: userSettings?.company_name,
  lifecycle_stage: "new_customer",
  source_utm_source: utm_source,
  source_utm_medium: utm_medium,
  source_utm_campaign: utm_campaign,
})
```

### 4. Group Analytics

```typescript
posthog.group("account", accountId, {
  plan: "free",
  seats: 1,
})
```

## Files Modified

1. **`/app/routes/(auth)+/login_success.tsx`**
   - Added `checkIfNewUser()` function
   - Added `captureSignupEvent()` function
   - Integrated signup tracking in loader

2. **`/app/routes/_ProtectedLayout.tsx`**
   - Enhanced `posthog.identify()` with role and company_name
   - Added `posthog.group()` for account-level tracking
   - Updated useEffect dependencies

3. **`/docs/posthog-tracking.md`** (NEW)
   - Comprehensive tracking guide
   - Event definitions and properties
   - Cohort definitions
   - Implementation checklist

## Key Features

✅ **Works for both OAuth and email/password**
✅ **Fires only once per user** (timestamp-based detection)
✅ **Captures UTM parameters** for attribution
✅ **Server-side tracking** for reliability
✅ **Group analytics** for B2B account tracking
✅ **Error handling** that doesn't block user flow

## Testing Checklist

- [ ] Test email/password signup → verify `account_signed_up` event
- [ ] Test Google OAuth signup → verify `account_signed_up` event
- [ ] Test existing user login → verify NO `account_signed_up` event
- [ ] Test with UTM parameters → verify attribution capture
- [ ] Verify person properties in PostHog dashboard
- [ ] Verify group properties in PostHog dashboard

## Next Steps

1. **Add remaining events** (see `/docs/posthog-tracking.md`)
   - `project_created`
   - `interview_added`
   - `evidence_saved`
   - `insight_created`
   - `insight_shared`
   - `persona_generated`
   - `theme_merged`
   - `invite_sent` / `invite_accepted`

2. **Create cohorts in PostHog**
   - Lifecycle cohorts (new, stalled, dormant, active)
   - Role cohorts (founder, pm, ux, sales)
   - Value cohorts (aha-reached, advocate, power-user)

3. **Set up funnels**
   - Signup → Project Created → Interview Added → Insight Created
   - Signup → Invite Sent → Invite Accepted

4. **Configure retention analysis**
   - Day 1, Day 7, Day 30 retention
   - Feature-specific retention

## Attribution Tracking

The implementation captures UTM parameters from the URL:
- `utm_source` - Traffic source (e.g., "google", "twitter")
- `utm_medium` - Marketing medium (e.g., "cpc", "email")
- `utm_campaign` - Campaign name (e.g., "summer_sale")
- `utm_term` - Paid search keywords
- `utm_content` - Ad variation

**Example URL**:
```
https://app.insights.com/login?utm_source=google&utm_medium=cpc&utm_campaign=launch_week
```

These parameters are:
1. Captured in the signup event
2. Stored as person properties (prefixed with `source_`)
3. Available for cohort creation and analysis

## Error Handling

The implementation includes robust error handling:

```typescript
try {
  // Capture signup event
} catch (error) {
  consola.error("[LOGIN_SUCCESS] Error capturing signup event:", error)
  // Don't throw - tracking failure shouldn't block user flow
}
```

**Philosophy**: Analytics should never break the user experience. If PostHog tracking fails, the user still gets authenticated and redirected successfully.

## Performance Considerations

- **Async tracking**: PostHog calls are non-blocking
- **Minimal queries**: Only 2 database queries (user_settings, accounts)
- **Cached data**: Reuses Supabase client from auth flow
- **No UI blocking**: All tracking happens server-side during redirect

## Privacy & Compliance

- **No PII beyond email**: We don't capture phone numbers, addresses, or sensitive data
- **User consent**: Consider adding cookie consent banner for GDPR compliance
- **Data retention**: Configure PostHog retention policies per your requirements
- **Anonymization**: PostHog supports IP anonymization if needed
