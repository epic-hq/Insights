# Billing Policy Decisions

This document captures policy decisions for billing, subscriptions, and seat management.

---

## 1. Plan Switching for Existing Subscribers

### Problem
When a user with an existing subscription (e.g., Pro trial) tries to switch to a different plan (e.g., Team), they hit an error because the checkout endpoint creates a new subscription, but Polar blocks duplicate subscriptions per customer.

### Current Behavior
- **New customers**: "Upgrade" button → `/api/billing/checkout?plan=X` → Creates new Polar checkout
- **Existing customers**: "Switch" button → Same checkout endpoint → Polar rejects (already subscribed)
- **Workaround**: "Manage Subscription" button → Polar customer portal → Can change plans there

### Decision: Use Polar Portal for Plan Changes

**For existing subscribers, plan switching must go through the Polar customer portal.**

Implementation:
1. On the billing page, detect if user has an existing subscription
2. If yes: "Switch" button should redirect to `/api/billing/portal` (not checkout)
3. Portal allows users to:
   - Upgrade/downgrade plans
   - Change billing interval (monthly ↔ annual)
   - Update payment methods
   - Cancel subscription

**Rationale**: Polar's portal handles proration, plan changes, and payment method reuse automatically. Building custom plan-switching logic would duplicate this functionality.

### TODO
- [ ] Update billing page to detect existing subscription
- [ ] Change "Switch" button behavior for existing subscribers to use portal
- [ ] Keep "Upgrade" button for free tier users (uses checkout)

---

## 2. Team Seat Billing Policy

### Problem
When someone has a Team plan with N seats and invites additional users, what happens?

### Options Considered

#### Option A: Require Pre-Purchase (Strict)
- User must buy additional seats BEFORE inviting
- Invite UI shows current seats used/available
- Block invites when at seat limit
- **Pros**: No surprise charges, clear billing
- **Cons**: Friction for growth, bad UX for admins

#### Option B: Allow Over-Limit, Bill Later (Flexible)
- Allow invites beyond seat count
- Bill for additional seats on next billing cycle (prorated)
- Show warning: "This will add $X/mo to your subscription"
- **Pros**: Smooth onboarding flow, removes friction
- **Cons**: Unexpected charges possible

#### Option C: Hybrid (Recommended)
- Allow invites with clear warning about billing impact
- Auto-provision seats via Polar API when invite is accepted
- Show explicit cost before confirming
- Don't block, but require acknowledgment

### Decision: Hybrid Approach (Option C)

**Users can invite beyond their current seat count, but must acknowledge the billing impact.**

#### Implementation Details

1. **Invite Page Warning**
   Add clear messaging on the invite page:
   ```
   "Adding [name] will increase your subscription from N to N+1 seats.
   Your monthly cost will increase by $X/mo (prorated for this billing cycle)."
   ```

2. **Seat Provisioning Flow**
   - When invite is sent: No seat change yet
   - When invite is accepted:
     - Call Polar API to update subscription quantity
     - Polar handles proration automatically
   - If invite expires/rejected: No billing change

3. **Billing Display**
   - Billing page shows: "N of M seats used" (M = purchased quantity)
   - If N > M: "You're using N seats. Your subscription will adjust on next renewal."

4. **Polar Subscription Update**
   Use `polar.subscriptions.update()` to change seat count:
   ```typescript
   await polar.subscriptions.update(subscriptionId, {
     quantity: newSeatCount
   });
   ```

5. **Admin Controls**
   - Show seat usage in team settings
   - Allow removing members to free up seats
   - Show pending invites in seat count calculation

### Webhook Handling

When Polar sends `subscription.updated` with new quantity:
- Update `billing_subscriptions.quantity` in database
- Recalculate feature entitlements if needed (team credits = per-user credits × seats)

### Current Implementation Status

| Component | Status | Location |
|-----------|--------|----------|
| SeatBillingInfo type | ✅ Done | `app/features/teams/pages/manage-members.tsx:76-84` |
| Seat usage display | ✅ Done | `manage-members.tsx:965-1003` |
| Warning when at limit | ✅ Done | Shows "Adding new members will increase cost" |
| Polar subscription.quantity | ✅ Done | Stored in `billing_subscriptions.quantity` |
| "Manage Seats" button | ❌ TODO | Add link to Polar portal for seat management |
| Auto-provision on invite accept | ❌ TODO | `app/routes/accept-invite.tsx` |
| Block invite at hard limit | ❌ TODO | `app/components/ui/team-invite.tsx` |

---

## 3. Trial Provisioning Policy

### Account-Level Billing Model
Billing is at the **account level**, not the user level. This means:
- Each account (personal or team) can have its own subscription
- Team members share the team's plan and credits
- Users can belong to multiple accounts with different billing states

### Trial Provisioning Logic
Trials are provisioned to the user's **owned team account** (where `primary_owner_user_id = user.id`), ensuring:
- Trial goes to the correct account regardless of which team the user lands on after login
- Invited team members don't accidentally trigger trials on teams they don't own
- Users see their trial status when viewing their owned team

**Implementation** (`app/routes/_ProtectedLayout.tsx`):
1. Find user's owned team account (`is_primary_owner: true`, `personal_account: false`)
2. Check if that account already has a subscription
3. If not, provision legacy trial to owned team
4. Mark user's `legacy_trial_provisioned_at` to prevent re-provisioning

### Trial Period Configuration
- Trial period: 14 days
- Trials require credit card upfront (Polar default)
- At trial end with valid CC: Auto-convert to paid subscription
- At trial end without valid CC: Subscription canceled

### Trial Banner Component
`app/components/billing/TrialBanner.tsx` displays trial status based on days remaining:
1. **Normal** (>3 days left): Blue, informational
2. **Expiring Soon** (≤3 days): Amber, urgent
3. **Expired**: Red, blocked features

**Note**: Trial banner only shows when viewing the account that has the trial subscription.

---

## 4. Downgrade Policy

### When User Downgrades (e.g., Team → Pro)
- Downgrade takes effect at end of current billing period
- User keeps current features until period ends
- At period end:
  - Features revert to new plan limits
  - If team member count > 1, decide how to handle

### Open Question: Team → Individual Downgrade with Multiple Users
When a Team account with 3 users downgrades to Pro (single user):
- **Option A**: Block downgrade until team has 1 user
- **Option B**: Allow downgrade, remove other users' access
- **Option C**: Allow downgrade, grandfather existing users until they leave

**Current Decision**: TBD - needs product decision

---

## 5. Grace Period Policy

### Failed Payment Handling
1. First failure: Retry, send email notification
2. After 3 days: Send "payment action required" email
3. After 7 days: Downgrade to free tier
4. Retain data for 30 days after downgrade

**Note**: Polar handles retry logic and notifications automatically.

---

## Implementation Checklist

### Phase 1: Plan Switching Fix
- [ ] Update billing page button logic for existing subscribers
- [ ] Test portal flow for plan changes

### Phase 2: Seat Billing
- [ ] Add seat warning to invite flow
- [ ] Implement seat count update on invite acceptance
- [ ] Add seat usage display to billing page
- [ ] Test Polar subscription quantity update

### Phase 3: Polish
- [ ] Add seat management UI in team settings
- [ ] Implement grace period notifications
- [ ] Add downgrade warning flow
