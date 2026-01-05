# UI Component Best Practices

This document captures key learnings and best practices from developing complex UI components in our React/Remix application.

## Component Architecture

### Prop Interface Design
- **Always define explicit TypeScript interfaces** for component props
- **Include optional props** for flexibility (`projectId?`, `projectPath?`)
- **Use descriptive JSDoc comments** for complex or optional props
- **Group related props** logically in the interface

```typescript
export interface InterviewQuestionsManagerProps {
  projectId?: string
  projectPath?: string
  target_orgs?: string[]
  target_roles?: string[]
  // ... other props with clear typing
  onSelectedQuestionsChange?: (questions: { id: string; text: string }[]) => void
}
```

### State Management Patterns
- **Separate concerns**: Keep UI state, data state, and derived state clearly separated
- **Use useMemo for expensive computations** that depend on multiple state variables
- **Debounce database operations** to avoid excessive API calls (1000ms timeout works well)
- **Initialize state properly** to avoid flickering and race conditions

```typescript
const [hasInitialized, setHasInitialized] = useState(false)

// Debounced saves
useEffect(() => {
  if (!projectId || !hasInitialized) return
  const timeoutId = setTimeout(() => {
    saveQuestionsToDatabase(questions, selectedQuestionIds)
  }, 1000)
  return () => clearTimeout(timeoutId)
}, [projectId, hasInitialized, questions, selectedQuestionIds])
```

## Data Handling

### Unique ID Generation
- **Always ensure unique IDs** for dynamic content to prevent React key conflicts
- **Use crypto.randomUUID()** for client-side ID generation
- **Post-process API responses** to guarantee ID uniqueness
- **Never rely solely on external APIs** for unique identifiers

```typescript
// API post-processing
if (questionSet?.questions && Array.isArray(questionSet.questions)) {
  questionSet.questions = questionSet.questions.map((question: any) => ({
    ...question,
    id: question.id && typeof question.id === 'string' && question.id.length > 0 
      ? question.id 
      : randomUUID()
  }))
}
```

### Supabase Integration
- **Use createClient() consistently** across components
- **Handle loading states gracefully** with proper error boundaries
- **Implement optimistic updates** for better UX
- **Use upsert operations** for conflict resolution

```typescript
const { error } = await supabase.from("project_sections").upsert(
  {
    project_id: projectId,
    kind: "questions",
    meta: { questions: withOrder, settings: { /*...*/ } },
  },
  { onConflict: "project_id,kind", ignoreDuplicates: false }
)
```

## Styling and Dark Mode

### Color System Design
- **Define color variants with dark mode support** from the start
- **Use CSS custom properties** for theme-aware styling
- **Create consistent color objects** that map to Tailwind classes
- **Test both light and dark modes** during development

```typescript
const questionCategories = [
  { 
    id: "context", 
    name: "Context & Background", 
    color: "border-blue-100 text-blue-800 dark:border-blue-900 dark:text-blue-200" 
  },
  // ... other categories
]
```

### Badge and Component Styling
- **Use variant="outline"** for consistent badge appearance
- **Apply semantic color classes** (text-muted-foreground for secondary info)
- **Maintain visual hierarchy** with proper contrast ratios
- **Test accessibility** across all color combinations

## User Experience Patterns

### Loading States
- **Show skeleton screens** instead of blank content during loading
- **Use consistent loading indicators** throughout the app
- **Provide meaningful loading messages** when operations take time
- **Handle empty states gracefully** with helpful messaging

### Interactive Elements
- **Implement drag-and-drop** for reorderable lists using @hello-pangea/dnd
- **Provide visual feedback** for drag operations (opacity changes, borders)
- **Use toast notifications** for action feedback (success, error, info)
- **Disable buttons during async operations** to prevent double-submission

### Navigation and Routing
- **Use type-safe route builders** (useProjectRoutes hook)
- **Pass required context** (projectPath) through component props
- **Handle missing routes gracefully** with fallbacks
- **Maintain navigation state** across component updates

```typescript
const routes = useProjectRoutes(projectPath)

<Button
  onClick={() => {
    if (routes) {
      window.location.href = routes.interviews.onboard()
    }
  }}
  disabled={questionPack.questions.length === 0}
>
  Add Interview
</Button>
```

## Performance Optimization

### React Optimization
- **Use useCallback for event handlers** that are passed to child components
- **Memoize expensive calculations** with useMemo
- **Avoid inline object creation** in JSX (extract to variables)
- **Use proper dependency arrays** in useEffect and useMemo

### Database Optimization
- **Batch related queries** when possible
- **Use .single() for expected single results** 
- **Handle "no results" errors** (PGRST116) gracefully
- **Limit query results** appropriately (.limit(1) for latest records)

## Error Handling

### API Error Management
- **Always handle both success and error cases** in API calls
- **Provide user-friendly error messages** via toast notifications
- **Log detailed errors** for debugging (consola.error)
- **Implement graceful degradation** when services are unavailable

```typescript
try {
  const response = await fetch("/api/generate-questions", { /*...*/ })
  if (response.ok) {
    // Handle success
  } else {
    const errorData = await response.json()
    toast.error("Failed to generate questions", {
      description: errorData.error || `Server error: ${response.status}`,
    })
  }
} catch (e) {
  consola.error("Error generating questions:", e)
  toast.error("Failed to generate questions", {
    description: "An unexpected error occurred. Please try again.",
  })
}
```

### Component Error Boundaries
- **Wrap components with error boundaries** for graceful failure
- **Provide fallback UI** for broken components
- **Log component errors** for monitoring
- **Reset error states** appropriately

## Testing Considerations

### Component Testing
- **Test loading states** and error conditions
- **Verify drag-and-drop functionality** with user interactions
- **Test dark mode appearance** and color contrast
- **Validate form submissions** and data persistence

### Integration Testing
- **Test full user workflows** (generate questions → select → save)
- **Verify database persistence** across component updates
- **Test routing and navigation** between related components
- **Validate API error handling** with network failures

## Code Organization

### File Structure
```
components/
  questions/
    InterviewQuestionsManager.tsx    # Main component
    upgradedcolor.ts                 # Style definitions
features/
  questions/
    pages/index.tsx                  # Page component
  onboarding/
    components/QuestionsScreen.tsx   # Onboarding wrapper
```

### Import Organization
- **Group imports logically**: React, third-party, internal
- **Use consistent import patterns** across the codebase
- **Export types and interfaces** for reuse
- **Import only what you need** to minimize bundle size

### Context and Hooks
- **Create custom hooks** for complex logic (useProjectRoutes)
- **Use context for app-wide state** (CurrentProjectProvider)
- **Keep hook dependencies minimal** and well-defined
- **Document hook usage** with clear examples

This documentation should serve as a reference for future component development and help maintain consistency across the application.