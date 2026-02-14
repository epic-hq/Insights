# Polar Production Cutover Runbook

One‑page checklist for switching Polar billing from sandbox to production safely.

## Preconditions
- Production keys are ready in Polar.
- A production domain is live (HTTPS) and serving the app.
- You have an owner account to test checkout and portal.

## 1) Configure Environment Variables (Production)
Set these in your production environment:
- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `POLAR_PRODUCT_STARTER_MONTHLY`
- `POLAR_PRODUCT_STARTER_ANNUAL`
- `POLAR_PRODUCT_PRO_MONTHLY`
- `POLAR_PRODUCT_PRO_ANNUAL`
- `POLAR_PRODUCT_TEAM_MONTHLY`
- `POLAR_PRODUCT_TEAM_ANNUAL`

Notes:
- Values must be **production** Polar IDs (not sandbox).
- `APP_ENV=production` ensures production server selection.

## 2) Register Webhook in Polar (Production)
- URL: `https://<your-domain>/api/webhooks/polar`
- Secret: same as `POLAR_WEBHOOK_SECRET`
- Events: subscription.created, subscription.active, subscription.updated, subscription.canceled, subscription.revoked, customer.created, customer.updated

## 3) Verify Product Map
Confirm `POLAR_PRODUCT_MAP` includes **all** production product IDs:
- File: `app/lib/billing/polar.server.ts`
- No “Unknown product ID” logs during checkout or webhook processing.

## 4) Owner‑Only Billing Access
Expected behavior:
- Only **owners** can access billing checkout or portal.
- Non‑owners should see `owner_required` errors.

Endpoints:
- `/api/billing/checkout?plan=starter|pro|team&interval=month|year`
- `/api/billing/portal`

## 5) Smoke Test (Production)
Run a controlled checkout with a real card:
1. Start checkout as an owner.
2. Complete purchase.
3. Verify redirect to success page.
4. Verify data in Supabase:
   - `accounts.billing_customers`
   - `accounts.billing_subscriptions`
   - `billing.feature_entitlements`
   - Credits granted via `billing.grant_credits`

## 6) Webhook Validation
In logs, confirm receipt of:
- `subscription.active` (provisions entitlements + grants credits)
- `subscription.updated` (plan change and renewal handling)

## 7) Cancellation Semantics
Expected:
- `cancel_at_period_end=true`: entitlements remain active until period end.
- Immediate cancel/revoke: entitlements disabled immediately.

## 8) Team Plan Seats
- Accepting an invite should update seat count in Polar and local `billing_subscriptions.quantity`.
- Minimum seats enforced for team plan.

## 9) Post‑Cutover Monitoring (First 24–48h)
- Monitor errors around:
  - webhook processing
  - unknown product IDs
  - failed credit grants
- Spot‑check billing records for new purchases.

## Rollback Plan
If billing fails:
1. Disable or rotate `POLAR_ACCESS_TOKEN`.
2. Temporarily hide billing upgrade UI if needed.
3. Investigate webhook errors and missing product IDs.

## Lessons Learned

### Customer Portal Authentication
The customer portal requires using the Polar SDK's `customerSessions.create()` API to generate authenticated session URLs. Direct URL construction (`polar.sh/portal?customer_id=...`) does not work.

**Implementation** (`app/routes/api.billing.portal.tsx`):
```typescript
const polar = new Polar({
  accessToken,
  server: server === "sandbox" ? "sandbox" : "production",
});
const session = await polar.customerSessions.create({
  customerId: customer.id,
});
return redirect(session.customerPortalUrl);
```

**Required token scope**: `POLAR_ACCESS_TOKEN` must include `customer_sessions:write` scope. Regenerate the token in Polar dashboard if getting 403 `insufficient_scope` errors.

### Trial System Architecture
The app uses a `provider`-based billing system to differentiate free trials from paid subscriptions:
- `provider='trial'`: Auto-provisioned 14-day free trial for new users
- `provider='polar'`: Real paid subscriptions via Polar

**Trial cleanup on payment**: Trials are automatically removed when a user purchases a subscription. The `removeTrial()` function in `app/lib/billing/polar.server.ts` is called from webhook handlers (`handleSubscriptionCreated` and `handleSubscriptionActive`) to delete trial records when a real subscription activates.

**Avoid double-trialing**: Disable free trial periods on Polar products themselves in the Polar dashboard. The app-level trial system handles the free trial period - having both app-level and Polar product-level trials creates confusion.

### Database Cleanup Best Practices
When cleaning up billing data:
- **Always scope to specific account_id** when deleting subscriptions or customers
- Delete in FK constraint order: `billing_subscriptions` before `billing_customers`
- Use Supabase SQL editor for manual cleanup rather than CLI commands if Supabase CLI version is outdated

Example scoped cleanup:
```sql
DELETE FROM accounts.billing_subscriptions
WHERE provider = 'trial' AND account_id = '<specific-account-id>';

DELETE FROM accounts.billing_customers
WHERE provider = 'trial' AND account_id = '<specific-account-id>';
```

### Migration Best Practices
When renaming provider values in the database, create a migration to update existing records:
```sql
UPDATE accounts.billing_subscriptions SET provider = 'trial' WHERE provider = 'legacy';
UPDATE accounts.billing_customers SET provider = 'trial' WHERE provider = 'legacy';
```

Apply with: `npx supabase db push`
