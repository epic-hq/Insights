# Question Management Architecture

This document outlines the architecture and data flow for the interview question management system.

## System Overview

The question management system consists of several interconnected components that handle question generation, selection, organization, and persistence.

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│  QuestionsScreen │────│ InterviewQuestions   │────│   project_sections  │
│   (Onboarding)   │    │      Manager         │    │    (Supabase)       │
└─────────────────┘    └──────────────────────┘    └─────────────────────┘
                                   │
                       ┌───────────┴────────────┐
                       │                        │
               ┌───────▼────────┐    ┌─────────▼─────────┐
               │ Question Pack   │    │  BAML Question    │
               │   Algorithm     │    │    Generator      │
               └────────────────┘    └───────────────────┘
```

## Data Models

### Question Interface
```typescript
interface Question {
  id: string                    // Unique identifier (UUID)
  text: string                 // Question content
  categoryId: string           // Category classification
  scores: {
    importance: number         // 0-1 importance score
    goalMatch: number         // 0-1 goal alignment score  
    novelty: number           // 0-1 novelty score
  }
  rationale?: string          // AI explanation for question
  status: "proposed" | "asked" | "answered" | "skipped"
  timesAnswered: number       // Count of times used in interviews
}
```

### Database Schema
```sql
-- project_sections table
{
  project_id: string,
  kind: "questions",           -- Distinguishes question data
  content_md: string,          -- Markdown summary
  meta: {
    questions: Question[],     -- Array of questions
    settings: {
      timeMinutes: number,
      purpose: Purpose,
      familiarity: Familiarity,
      goDeepMode: boolean,
      customInstructions: string
    }
  }
}
```

## Question Generation Flow

### 1. Input Collection
```typescript
// From onboarding flow or existing project
const context = {
  target_orgs: string[],
  target_roles: string[],
  research_goal: string,
  research_goal_details: string,
  assumptions: string[],
  unknowns: string[],
  custom_instructions?: string
}
```

### 2. BAML Processing
```typescript
// API route: /api/generate-questions
const questionSet = await generateQuestionSetCanonical({
  ...context,
  session_id: `session_${Date.now()}`,
  total_per_round: 10,
  interview_time_limit: timeMinutes
})

// Post-process for unique IDs
questionSet.questions = questionSet.questions.map(q => ({
  ...q,
  id: q.id || randomUUID()  // Ensure unique IDs
}))
```

### 3. Question Categorization
Questions are automatically categorized into:
- **Context & Background** - Setting and environment
- **Pain Points & Problems** - Current challenges
- **Workflow & Behavior** - Current processes
- **Goals & Motivations** - Desired outcomes
- **Constraints & Barriers** - Limitations
- **Willingness to Pay** - Value proposition

## Question Selection Algorithm

### Composite Scoring
```typescript
const calculateCompositeScore = (question: Question): number => {
  const categoryWeight = questionCategories.find(c => c.id === question.categoryId)?.weight || 1
  const s = question.scores
  return 0.5 * s.importance + 0.35 * s.goalMatch + 0.15 * s.novelty * categoryWeight
}
```

### Time-Based Selection
```typescript
// Target counts based on interview length
const targetCounts = {
  15: { base: 3, validation: +1, cold: -1 },
  30: { base: 5, validation: +1, cold: -1 },
  45: { base: 7, validation: +1, cold: -1 },
  60: { base: 9, validation: +1, cold: -1 }
}

// Estimate time per question
const baseTimes = { 
  exploratory: 6.5, 
  validation: 4.5, 
  followup: 3.5 
}
```

### Selection Strategy
1. **Go Deep Mode**: Select top 3 highest-scoring questions
2. **Category Diversity**: Ensure representation from core categories (context, pain, workflow)
3. **Time Budget**: Fit questions within estimated interview duration
4. **Composite Ranking**: Fill remaining slots with highest composite scores

## State Management

### Component State Flow
```typescript
// Primary state
const [questions, setQuestions] = useState<Question[]>([])           // All available questions
const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([])  // Selected for interview
const [hasInitialized, setHasInitialized] = useState(false)         // Initialization flag

// Derived state (computed)
const questionPack = useMemo(() => ({
  questions: orderedSelectedQuestions,
  remainingQuestions: unselectedQuestions,
  totalEstimatedTime: sum of selected question times,
  overflowIndex: first question exceeding time limit
}), [questions, selectedQuestionIds, timeMinutes, /*...*/])
```

### Persistence Strategy
- **Debounced saves** (1000ms) to avoid excessive database writes
- **Optimistic updates** for immediate UI feedback  
- **Conflict resolution** using upsert with project_id+kind composite key
- **State recovery** from database on component mount

## User Interactions

### Question Management
- **Drag & Drop Reordering**: Change question sequence
- **Add/Remove**: Include/exclude questions from interview pack
- **Reserve Pool**: Browse additional generated questions
- **Time Budget**: Visual indicators for questions exceeding time limit

### Settings Integration
- **Interview Purpose**: Affects time estimates and selection
- **Participant Familiarity**: Adjusts time calculations
- **Go Deep Mode**: Prioritizes highest-scoring questions
- **Custom Instructions**: Influences AI generation

## Navigation Integration

### Route Management
```typescript
const routes = useProjectRoutes(projectPath)

// Navigation to interview creation
<Button onClick={() => {
  if (routes) {
    window.location.href = routes.interviews.onboard()
  }
}}>
  Add Interview
</Button>
```

### Context Passing
```typescript
// From page components
const { projectId, projectPath } = useCurrentProject()

// To InterviewQuestionsManager
<InterviewQuestionsManager 
  projectId={projectId}
  projectPath={projectPath}
  // ... other props
/>
```

## Error Handling & Recovery

### API Failures
- Graceful degradation when question generation fails
- User-friendly error messages via toast notifications
- Retry mechanisms for transient failures
- Fallback to existing questions when available

### Data Validation
- UUID validation for question IDs
- Schema validation for database writes
- Type checking for question properties
- Bounds checking for numeric values

## Performance Considerations

### Optimization Techniques
- **Memoized calculations** for expensive operations
- **Debounced saves** to reduce database load
- **Lazy loading** for additional questions
- **Efficient re-renders** with proper dependency arrays

### Scaling Considerations
- Question pools can grow large over time
- Multiple concurrent users editing questions
- Real-time synchronization between team members
- Archive/cleanup strategies for old questions

## Integration Points

### Onboarding Flow
- Seamless integration with project setup
- Contextual question generation from project goals
- Automatic saving of question selections
- Navigation to next onboarding steps

### Interview System
- Question handoff to interview scheduling
- Template creation from question packs
- Usage tracking and analytics
- Post-interview feedback loop

This architecture provides a robust foundation for interview question management while maintaining flexibility for future enhancements.