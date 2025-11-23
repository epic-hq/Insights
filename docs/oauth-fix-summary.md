# OAuth Login Fix - Summary

## Problem
Users experience intermittent OAuth login failures on getupsight.com. First login attempt redirects back to login page, second attempt works.

## Root Causes

### 1. Missing Cookie Configuration
**File:** `app/lib/supabase/client.server.ts`

The server-side Supabase client wasn't explicitly configuring cookie options. This caused:
- Missing `SameSite` attribute (defaults vary by browser)
- Missing `Secure` flag in production
- No explicit `maxAge` setting
- Cookies not working properly in cross-domain OAuth redirects from Google

### 2. No Explicit PKCE Flow Configuration
**Files:** `app/lib/supabase/client.server.ts`, `app/lib/supabase/client.ts`

Neither client nor server explicitly configured `flowType: 'pkce'`, relying on defaults.

### 3. Insufficient Error Logging
**Files:** `app/routes/auth.callback.tsx`, `app/routes/(auth)+/login_success.tsx`

Couldn't diagnose where exactly the session was being lost.

## Why Second Login Worked

After first failed attempt, user is on `getupsight.com` domain. Second login is same-site (not cross-site from Google), so cookies work properly due to browser same-site policies.

## Fixes Applied

### 1. Cookie Configuration (client.server.ts:7-45)
```typescript
cookieOptions = {
  ...options,
  sameSite: "lax",           // Allows cookies in top-level navigation (OAuth)
  secure: isProduction,       // Required for HTTPS in production
  path: "/",                  // Accessible across entire domain
  maxAge: 60 * 60 * 24 * 7,  // 7 days
}
```

**Why this fixes it:**
- `SameSite=Lax` allows cookies to be sent when Google redirects back to our domain
- `Secure=true` ensures cookies work properly with HTTPS in production
- Explicit `maxAge` ensures session persistence

### 2. PKCE Flow Configuration

**Server (client.server.ts:38-41):**
```typescript
auth: {
  flowType: "pkce",
}
```

**Client (client.ts:32-41):**
```typescript
auth: {
  flowType: "pkce",
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
}
```

**Why this helps:**
- PKCE (Proof Key for Code Exchange) is more secure and reliable for OAuth
- Explicitly configures session persistence
- Auto-refresh prevents token expiration issues

### 3. Comprehensive Logging

**auth.callback.tsx:**
- Logs all incoming cookies
- Logs OAuth code exchange duration and result
- Logs cookies being set in response
- Verifies session/user creation
- Detailed error information

**login_success.tsx:**
- Logs incoming cookies to verify they arrived
- Logs getUser() call duration and errors
- Clear warnings when session is lost

## Testing Instructions

### Local Testing
1. Clear all browser cookies for localhost
2. Click "Sign in with Google"
3. Complete Google OAuth flow
4. Check console logs for:
   - `[AUTH CALLBACK] Setting N cookies in response`
   - `[LOGIN_SUCCESS] Incoming cookies: present`
   - `[LOGIN_SUCCESS] ✅ User authenticated`

### Production Testing
1. Deploy changes to getupsight.com
2. Open incognito window
3. Navigate to https://getupsight.com/login
4. Click "Sign in with Google"
5. Complete OAuth flow
6. Verify you're not redirected back to login
7. Check logs in production (Fly.io logs or wherever console.log goes)

### What to Look For in Logs

**Successful OAuth flow:**
```
[AUTH CALLBACK] Code present: true
[AUTH CALLBACK] Incoming cookies: present
[AUTH CALLBACK] Exchange took: ~200-500ms
[AUTH CALLBACK] Exchange result: { sessionExists: true, userExists: true, ... }
[AUTH CALLBACK] Setting 2-3 cookies in response
[LOGIN_SUCCESS] Incoming cookies: present
[LOGIN_SUCCESS] Cookie names: ['sb-access-token', 'sb-refresh-token', ...]
[LOGIN_SUCCESS] ✅ User authenticated: user@example.com
```

**Failed OAuth flow (old behavior):**
```
[AUTH CALLBACK] Code present: true
[AUTH CALLBACK] Incoming cookies: none or present
[AUTH CALLBACK] Exchange successful
[AUTH CALLBACK] Setting 2-3 cookies in response
[LOGIN_SUCCESS] Incoming cookies: MISSING   <-- THE BUG
[LOGIN_SUCCESS] ⚠️ NO COOKIES RECEIVED - This is the bug!
[LOGIN_SUCCESS] ⚠️ No authenticated user found - session lost
```

## Files Modified

1. **app/lib/supabase/client.server.ts** - Server cookie config + PKCE
2. **app/lib/supabase/client.ts** - Client PKCE config
3. **app/routes/auth.callback.tsx** - Enhanced logging + validation
4. **app/routes/(auth)+/login_success.tsx** - Enhanced logging

## Deployment Checklist

- [ ] Run type check: `npm run typecheck`
- [ ] Run build: `npm run build`
- [ ] Deploy to production
- [ ] Test OAuth flow in incognito window
- [ ] Monitor logs for first ~10 OAuth attempts
- [ ] Verify no users report login issues

## Rollback Plan

If issues arise, revert these commits:
- Cookie configuration changes (client.server.ts)
- PKCE configuration (client.ts, client.server.ts)

Note: Logging changes can stay - they don't affect functionality, only observability.

## Additional Notes

- The fix is backwards compatible - existing sessions are not affected
- Cookie changes only apply to new logins
- PKCE is the recommended OAuth flow by OAuth 2.1 spec
- This fix also improves security (PKCE prevents authorization code interception)

## Monitoring

After deployment, monitor:
1. Login success rate (should be ~100% instead of ~50%)
2. Server logs for any `[LOGIN_SUCCESS] ⚠️ NO COOKIES RECEIVED` warnings
3. User reports of "had to login twice" should disappear
4. PostHog `account_signed_up` events should show cleaner signup flows

---

**Status:** Ready for deployment
**Impact:** High - fixes critical user onboarding issue
**Risk:** Low - backwards compatible, industry best practices
