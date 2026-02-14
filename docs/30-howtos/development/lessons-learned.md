# Development Lessons Learned

This document captures key insights and lessons from building the interview question management system.

## Technical Discoveries

### Unique ID Management is Critical
**Problem**: Questions generated from BAML had inconsistent or duplicate IDs, causing React key conflicts and state management issues.

**Solution**: 
- Always post-process API responses to ensure unique IDs
- Use `crypto.randomUUID()` for client-side ID generation
- Never rely solely on external APIs for unique identifiers

**Key Learning**: Treat external data as untrusted and validate/normalize it before using in your application state.

```typescript
// Post-process API responses
questionSet.questions = questionSet.questions.map((question: any) => ({
  ...question,
  id: question.id && typeof question.id === 'string' && question.id.length > 0 
    ? question.id 
    : randomUUID()
}))
```

### Dark Mode Should Be Built In, Not Bolted On
**Problem**: Initially implemented light-mode-only color schemes, then needed to retrofit dark mode support.

**Solution**:
- Define color variants with dark mode classes from the start
- Use consistent color objects that map to Tailwind classes
- Test both themes during development

**Key Learning**: Dark mode is easier to implement from the beginning than to add retroactively.

```typescript
const questionCategories = [
  { 
    color: "border-blue-100 text-blue-800 dark:border-blue-900 dark:text-blue-200" 
  }
]
```

### Component Props Need Clear Contracts
**Problem**: Components were tightly coupled and required specific combinations of props to function correctly.

**Solution**:
- Define explicit TypeScript interfaces for all component props
- Use JSDoc comments for complex or optional behavior
- Design props for flexibility and reusability

**Key Learning**: Well-defined prop interfaces make components easier to use, test, and maintain.

### State Initialization Order Matters
**Problem**: Race conditions between API loading, state initialization, and user interactions caused flickering and unexpected behavior.

**Solution**:
- Use explicit initialization flags (`hasInitialized`)
- Separate data loading from UI state management
- Handle loading states gracefully with skeletons

**Key Learning**: Complex state requires careful orchestration of initialization timing.

### Database Saves Need Debouncing
**Problem**: Every user interaction triggered immediate database saves, causing performance issues and API rate limiting.

**Solution**:
- Implement debounced saves (1000ms worked well)
- Use optimistic updates for immediate UI feedback
- Clear timeouts properly in cleanup functions

**Key Learning**: Balance data persistence with performance by batching similar operations.

## UX Insights

### Loading States Are User-Facing Features
**Problem**: Blank screens during loading created poor user experience and confusion.

**Solution**:
- Implement skeleton screens that match final content structure
- Show meaningful progress indicators
- Provide context about what's loading

**Key Learning**: Loading states deserve the same design attention as the main interface.

### Drag-and-Drop Needs Visual Feedback
**Problem**: Users couldn't tell when drag operations were active or where items would land.

**Solution**:
- Use opacity changes during dragging
- Provide visual drop zones and indicators
- Show immediate feedback for successful operations

**Key Learning**: Interactive operations need clear visual communication throughout the entire interaction flow.

### Error Messages Should Be Actionable
**Problem**: Generic error messages left users unsure how to proceed.

**Solution**:
- Provide specific error descriptions
- Suggest concrete next steps when possible
- Use toast notifications for non-blocking feedback

**Key Learning**: Error handling is an opportunity to guide users, not just report problems.

### Time Budget Visualization is Essential
**Problem**: Users selected more questions than could fit in their interview time without realizing it.

**Solution**:
- Show running time totals as questions are selected
- Use visual indicators (colors, borders) for time overflow
- Provide clear separation between "fits" and "doesn't fit" sections

**Key Learning**: When dealing with constraints, make them visible in the interface.

### Webhook URLs Behind Reverse Proxies Must Use x-forwarded-proto (2026-02-12)
**Problem**: AssemblyAI webhook callbacks silently failed in production. `new URL(request.url).origin` returns `http://` behind Cloudflare/Netlify proxy, so the webhook URL was `http://getupsight.com/...` — AssemblyAI never called back and interviews got stuck.

**Solution**:
- Use `createDomain(request)` from `~/utils/http` which checks `x-forwarded-proto` header
- Never use `new URL(request.url).origin` for constructing callback URLs in production

**Affected files**: `app/routes/api.onboarding-start.tsx` (two locations)
**Already correct**: `api.interviews.check-transcription.tsx`, `api.interview-restart.tsx` (hardcode `https://getupsight.com`)

**Key Learning**: Behind reverse proxies, `request.url` reflects the internal HTTP connection, not the external HTTPS URL. Always use proxy-aware URL construction for webhook/callback URLs.

## Architecture Learnings

### Context vs Props for Data Flow
**Problem**: Passing projectPath through multiple component layers created prop drilling.

**Solution**:
- Use React Context for widely-needed application state
- Design custom hooks for complex logic (useProjectRoutes)
- Pass specific data as props for component isolation

**Key Learning**: Choose the right data flow pattern based on how widely the data is needed.

### Component Responsibility Boundaries
**Problem**: Initially tried to make InterviewQuestionsManager handle too many concerns.

**Solution**:
- Separate data management from UI presentation
- Extract reusable logic into custom hooks
- Keep components focused on single responsibilities

**Key Learning**: Clear separation of concerns makes components easier to test and maintain.

### Type Safety Pays Dividends
**Problem**: Runtime errors from type mismatches and undefined values.

**Solution**:
- Define explicit interfaces for all data structures
- Use TypeScript strict mode
- Validate external data at boundaries

**Key Learning**: Strict typing catches errors at compile time that would otherwise appear in production.

## Performance Lessons

### Memoization Should Be Strategic
**Problem**: Overuse of useMemo and useCallback created more complexity than performance benefit.

**Solution**:
- Only memoize expensive calculations
- Focus on operations that run on every render
- Measure actual performance impact

**Key Learning**: Premature optimization can hurt code clarity without meaningful performance gains.

### Database Query Optimization
**Problem**: Multiple individual queries for related data caused unnecessary round trips.

**Solution**:
- Batch related queries when possible
- Use appropriate Supabase query methods (.single() for expected single results)
- Handle "no results" cases gracefully

**Key Learning**: Database interaction patterns have significant impact on perceived performance.

## Testing Insights

### Component Testing Strategy
**Problem**: Complex interactive components were difficult to test comprehensively.

**Solution**:
- Test core business logic separately from UI interactions
- Use integration tests for complete user workflows
- Mock external dependencies consistently

**Key Learning**: Different types of functionality require different testing approaches.

### Error Condition Testing
**Problem**: Most development focused on happy path scenarios.

**Solution**:
- Explicitly test error conditions and edge cases
- Simulate network failures and API errors
- Verify graceful degradation behavior

**Key Learning**: Error conditions are often where users have the worst experience, so they deserve explicit testing attention.

## Code Organization Insights

### File Structure Reflects Usage Patterns
**Problem**: Related components and utilities were scattered across different directories.

**Solution**:
- Group components by feature domain
- Co-locate related utilities and types
- Use clear naming conventions

**Key Learning**: Good file organization makes the codebase easier to navigate and understand.

### Import Organization Matters
**Problem**: Inconsistent import patterns made it hard to understand component dependencies.

**Solution**:
- Group imports by type (React, third-party, internal)
- Use consistent ordering within groups
- Import only what you need

**Key Learning**: Clean import organization is a small detail that significantly improves code readability.

## Future Development Guidelines

### Plan for Scale
- Design data structures that can handle growth
- Consider performance implications of algorithms
- Build in monitoring and observability

### Design for Reusability
- Create flexible component interfaces
- Extract common patterns into utilities
- Document usage patterns and examples

### Test Edge Cases Early
- Handle empty states gracefully
- Validate all external inputs
- Plan for network failures and timeouts

### Optimize for Developer Experience
- Use TypeScript for better tooling
- Write clear error messages
- Document architectural decisions

### Build Accessibility In
- Use semantic HTML elements
- Test keyboard navigation
- Verify color contrast ratios
- Support screen readers

These lessons should inform future development decisions and help avoid repeating the same issues.