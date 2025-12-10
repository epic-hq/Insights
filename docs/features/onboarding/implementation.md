# Onboarding Implementation

Technical implementation details for the onboarding flow.

## Flow Architecture

### 1. Auto-Detection & Redirect

- **Location**: `app/routes/_ProtectedLayout.tsx:84-101`
- **Trigger**: When authenticated users have zero projects
- **Redirect**: `/projects/new?onboarding=true`
- **Logic**: Checks user's project count via `getProjects()` and redirects if empty

### 2. Onboarding Steps

The onboarding consists of 4 main steps:

1. **Welcome/Goals** (`welcome`) - Project goals and research context setup
2. **Questions** (`questions`) - Interview questions generation and review
3. **Upload** (`upload`) - First document/interview upload
4. **Processing** (`processing`) - Real-time processing feedback

### 3. UI Behavior During Onboarding

- **MainNav Hidden**: `AppLayout.tsx:17-20` - Navigation is hidden when `?onboarding=true`
- **Progress Indicator**: Shows "Step X of 4" in header
- **Exit Option**: "← Exit Onboarding" button available
- **Clean Interface**: Only essential elements visible

## Key Files

```text
app/routes/_ProtectedLayout.tsx                          # Auto-redirect logic
app/routes/_protected.projects.new.tsx                   # New project route handler
app/components/layout/AppLayout.tsx                      # Conditional navigation
app/features/onboarding/components/OnboardingFlow.tsx    # Main flow component
app/features/dashboard-v3/components/OnboardingDashboard.tsx  # Dashboard tasks
app/features/dashboard-v3/components/DashboardShell.tsx  # Dashboard state wrapper
app/features/dashboard-v3/hooks/useDashboardState.ts     # Dashboard state logic
```

## URL Structure

```text
Normal project creation:    /projects/new
Onboarding mode:           /projects/new?onboarding=true
```

### Search Parameters

- `onboarding=true` - Enables onboarding mode with hidden navigation

## Dashboard State Machine

The dashboard uses a state machine to determine what to show:

```typescript
type DashboardState = "empty" | "processing" | "active"

// State determination logic (useDashboardState.ts)
if (conversationCount === 0) {
  return "empty"      // Shows OnboardingDashboard
}
if (processingCount > 0 && conversationCount === processingCount) {
  return "processing" // Shows processing state
}
return "active"       // Shows full dashboard
```

## Usage Examples

### Testing Onboarding Flow

```bash
# Method 1: Direct URL (requires user with no projects)
http://localhost:4280/projects/new?onboarding=true

# Method 2: Delete user projects to trigger auto-redirect
DELETE FROM projects WHERE account_id = 'user-account-id';
# Then visit any protected route
```

### Programmatic Triggering

```typescript
// Redirect to onboarding
navigate('/projects/new?onboarding=true')

// Exit onboarding
navigate('/home') // Removes onboarding param
```

### Conditional Rendering Based on Onboarding

```typescript
const [searchParams] = useSearchParams()
const isOnboarding = searchParams.get('onboarding') === 'true'

return (
  <div>
    {!isOnboarding && <MainNav />}
    <Content />
  </div>
)
```

## Navigation Controls

### Exit Onboarding

- **Button**: "← Exit Onboarding"
- **Action**: Navigate to `/home` (removes onboarding param)
- **Location**: Top-left of onboarding header

### Step Navigation

- **Forward**: Natural progression through steps
- **Backward**: Back button available on steps 2-4
- **Progress**: Visual step counter "Step X of 4"

### Escape Routes

- Users can exit at any time via the exit button
- Browser back button works for step navigation
- No forced completion required

## Error Prevention

### Redirect Loop Protection

```typescript
// Prevents infinite redirects
if (!pathname.includes('/projects/new') && !pathname.includes('onboarding=true')) {
  throw redirect("/projects/new?onboarding=true")
}
```

### Hook Call Issues

- Use `react-router-dom` imports, not `react-router`
- Ensure components are properly wrapped in Router context

## Configuration

### Environment Variables

```bash
# Skip signup-chat and use onboarding (recommended)
SIGNUP_CHAT_REQUIRED=false
```

### Feature Flags

- Currently always enabled for users without projects
- Can be disabled by modifying redirect logic in `_ProtectedLayout.tsx`

## Customization

### Adding New Steps

1. Add step to `OnboardingStep` type
2. Update step counter logic
3. Add case to `stepContent()` switch statement
4. Create new screen component

### Changing Step Order

Modify the progression logic in:

- `handleWelcomeNext()`
- `handleQuestionsNext()`
- `handleUploadNext()`
- `handleBack()`

## Troubleshooting

### Common Issues

1. **React Hooks Error**

   ```text
   Invalid hook call. Hooks can only be called inside function components.
   ```

   **Solution**: Ensure using `react-router-dom` imports, not `react-router`

2. **Redirect Loops**

   ```text
   Too many redirects error
   ```

   **Solution**: Check redirect logic and URL patterns in middleware

3. **Missing Navigation**

   ```text
   MainNav not showing after onboarding
   ```

   **Solution**: Verify `?onboarding=true` is removed from URL after completion

### Debug Tips

```typescript
// Log onboarding state
const isOnboarding = searchParams.get('onboarding') === 'true'
console.log('Onboarding mode:', isOnboarding)

// Check project count
console.log('User projects:', userProjects.length)

// Verify redirect logic
console.log('Current pathname:', pathname)
```

## Future Enhancements

- [ ] Analytics tracking for onboarding completion rates
- [ ] A/B testing different step orders
- [ ] Skip certain steps for experienced users
- [ ] Progress persistence across sessions
- [ ] Onboarding tutorial tooltips
