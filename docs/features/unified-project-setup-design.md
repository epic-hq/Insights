# Unified Project Setup Experience

A design specification for a real-time synchronized chat and form experience during project setup.

## Design Philosophy

The setup experience should feel like a guided conversation with an expert, whether the user chooses to type naturally or fill out structured fields. The two modes are not separate paths but rather two windows into the same underlying data.

## User Journey

### Prerequisite: Company Context (Account-level, once)

Before starting any project, the account must have company context set up. This is a **gate**, not a step:

- Company description
- Products and services (offerings)
- Target customers (orgs + roles)
- Competitors

If missing, the setup flow prompts for this first. Once set, it's reusable across all projects.

### Project Flow (5 Steps)

```
1. DEFINE          2. DESIGN           3. COLLECT          4. SYNTHESIZE       5. PRIORITIZE
   What to learn      How to learn it     Gather responses    Make sense of it    Decide what matters
```

### Step 1: Define — What do you want to learn?
- Research goal
- Key decisions to make
- Unknowns to explore
- Riskiest assumptions to validate

### Step 2: Design — How will you learn it?
- Interview questions/prompts
- Collection methods (survey, AI chat, interviews)
- Target audience

### Step 3: Collect — Gather responses
- Surveys (public links)
- AI chat conversations
- Interview recordings/uploads
- Manual transcripts

### Step 4: Synthesize — Make sense of it
- Apply analytical lenses
- Extract evidence
- Cluster themes
- Generate insights (mostly automated)

### Step 5: Prioritize — Decide what matters
- Rank insights by impact/confidence
- Identify opportunities
- Create action items
- Track decisions made

---

## Future: Sales Flow (Post-research)

Once research is complete, insights feed into:
- Positioning refinement
- Sales pitch development
- Customer conversation tracking
- Product-market fit measurement
- Feedback loops to product

---

## Visual Design Concept

### Layout Structure

```
+--------------------------------------------------+
|  Project Name                      [Chat] [Form] |
+--------------------------------------------------+
|                                                   |
|  +-------------+  +----------------------------+  |
|  |   STEPS     |  |                            |  |
|  |             |  |   MAIN CONTENT AREA        |  |
|  | 1. Company  |  |   (Chat or Form)           |  |
|  |    [check]  |  |                            |  |
|  | 2. Goals    |  |                            |  |
|  |    [active] |  |                            |  |
|  | 3. Collect  |  |                            |  |
|  | 4. Analyze  |  |                            |  |
|  | 5. Act      |  |                            |  |
|  +-------------+  +----------------------------+  |
|                                                   |
+--------------------------------------------------+
|            [Sync indicator]  Last saved 2s ago   |
+--------------------------------------------------+
```

### Step Progress Indicator (Vertical Rail)

The step rail lives on the left side and shows:
- Step number and label
- Completion status (check icon for complete, current highlight, muted for future)
- Click to navigate between steps

```tsx
// Visual states for steps
type StepStatus = 'complete' | 'current' | 'upcoming'

// Step indicator styling
// Complete: Muted background with check icon
// Current: Primary background with number, subtle glow
// Upcoming: Muted text, no background
```

### Mode Toggle

The chat/form toggle should feel like two views of the same data, not two different features:

```
+----------------------------------+
|  [icon] Chat    [icon] Form      |
+----------------------------------+
```

- Active state: Solid background, primary text
- Inactive state: Ghost/transparent, muted text
- Include subtle icons: MessageSquare for chat, List for form
- Add transition animation when switching

### Real-time Sync Indicator

A subtle indicator showing sync status:

```
+------------------------------------------+
|  [pulse] Synced                          |  <- Green when synced
|  [spinner] Saving...                     |  <- During save
|  [cloud-off] Offline (changes queued)    |  <- When disconnected
+------------------------------------------+
```

---

## Component Architecture

### State Management

Use a React Context + Zustand store pattern for shared state:

```
app/features/projects/
  contexts/
    project-setup-context.tsx      # React context provider
  stores/
    project-setup-store.ts         # Zustand store
  hooks/
    useProjectSetupSync.ts         # Realtime subscription hook
    useProjectSections.ts          # Sections data hook
```

### Data Flow

```
                    +------------------+
                    |   Supabase DB    |
                    | project_sections |
                    +--------+---------+
                             |
         +-------------------+-------------------+
         |                                       |
    [Realtime                              [HTTP API]
    Subscription]                          /api/save-project-goals
         |                                       |
         v                                       v
    +----+----+                           +------+------+
    | Zustand |<------------------------->|  Form/Chat  |
    |  Store  |   optimistic updates      |  Components |
    +---------+                           +-------------+
```

### Key Components

```
ProjectSetupPage (page container)
  |
  +-- ProjectSetupProvider (context)
  |     |
  |     +-- useProjectSetupSync (realtime hook)
  |
  +-- SetupStepRail (left nav)
  |     |
  |     +-- StepIndicator (per step)
  |
  +-- SetupModeToggle (chat/form switch)
  |
  +-- SetupContent (main area)
        |
        +-- ProjectSetupChat (chat mode)
        |
        +-- ProjectSetupForm (form mode)
              |
              +-- CompanyInfoSection
              +-- ResearchGoalsSection
              +-- ...
```

---

## Implementation Approach

### 1. Zustand Store for Sections Data

```typescript
// app/features/projects/stores/project-setup-store.ts

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

export interface ProjectSectionData {
  customer_problem: string
  target_orgs: string[]
  target_roles: string[]
  offerings: string[]
  competitors: string[]
  research_goal: string
  decision_questions: string[]
  assumptions: string[]
  unknowns: string[]
  custom_instructions: string
}

interface ProjectSetupState {
  // Data
  sections: ProjectSectionData

  // Sync status
  syncStatus: 'synced' | 'saving' | 'offline' | 'error'
  lastSyncedAt: Date | null

  // Progress tracking
  currentStep: 'define' | 'design' | 'collect' | 'synthesize' | 'prioritize'
  completedSteps: string[]

  // Actions
  updateSection: <K extends keyof ProjectSectionData>(
    key: K,
    value: ProjectSectionData[K],
    options?: { skipSync?: boolean }
  ) => void

  // Full state replacement (for realtime updates)
  setSections: (sections: Partial<ProjectSectionData>) => void

  // Sync management
  setSyncStatus: (status: ProjectSetupState['syncStatus']) => void
  markSynced: () => void

  // Step navigation
  setCurrentStep: (step: ProjectSetupState['currentStep']) => void
  markStepComplete: (step: string) => void
}

const defaultSections: ProjectSectionData = {
  customer_problem: '',
  target_orgs: [],
  target_roles: [],
  offerings: [],
  competitors: [],
  research_goal: '',
  decision_questions: [],
  assumptions: [],
  unknowns: [],
  custom_instructions: '',
}

export const useProjectSetupStore = create<ProjectSetupState>()(
  subscribeWithSelector((set, get) => ({
    sections: defaultSections,
    syncStatus: 'synced',
    lastSyncedAt: null,
    currentStep: 'define',
    completedSteps: [],

    updateSection: (key, value, options) => {
      set((state) => ({
        sections: { ...state.sections, [key]: value },
        syncStatus: options?.skipSync ? state.syncStatus : 'saving',
      }))
    },

    setSections: (sections) => {
      set((state) => ({
        sections: { ...state.sections, ...sections },
      }))
    },

    setSyncStatus: (status) => set({ syncStatus: status }),

    markSynced: () => set({
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
    }),

    setCurrentStep: (step) => set({ currentStep: step }),

    markStepComplete: (step) => {
      set((state) => ({
        completedSteps: state.completedSteps.includes(step)
          ? state.completedSteps
          : [...state.completedSteps, step],
      }))
    },
  }))
)
```

### 2. Realtime Subscription Hook

```typescript
// app/features/projects/hooks/useProjectSetupSync.ts

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '~/lib/supabase/client'
import { useProjectSetupStore } from '../stores/project-setup-store'
import type { RealtimeChannel } from '@supabase/supabase-js'
import consola from 'consola'

interface UseProjectSetupSyncOptions {
  projectId: string
  enabled?: boolean
}

/**
 * Hook that syncs project sections with Supabase realtime
 *
 * - Subscribes to INSERT/UPDATE on project_sections for this project
 * - Updates Zustand store when remote changes arrive
 * - Provides saveSection function for local changes
 */
export function useProjectSetupSync({
  projectId,
  enabled = true
}: UseProjectSetupSyncOptions) {
  const supabase = createClient()
  const channelRef = useRef<RealtimeChannel | null>(null)

  const { setSections, setSyncStatus, markSynced, sections } = useProjectSetupStore()

  // Parse section data from DB format to store format
  const parseSectionRow = useCallback((row: {
    kind: string
    meta: Record<string, unknown> | null
    content_md: string | null
  }) => {
    const meta = row.meta || {}

    // Extract the actual value from meta (where we store typed data)
    const value = meta[row.kind] ?? row.content_md ?? ''

    return { kind: row.kind, value }
  }, [])

  // Load initial data
  useEffect(() => {
    if (!enabled || !projectId) return

    async function loadInitialData() {
      const { data, error } = await supabase
        .from('project_sections')
        .select('kind, content_md, meta')
        .eq('project_id', projectId)

      if (error) {
        consola.error('Failed to load project sections:', error)
        return
      }

      if (data) {
        const sectionsUpdate: Partial<typeof sections> = {}

        for (const row of data) {
          const { kind, value } = parseSectionRow(row)
          if (kind in sections) {
            sectionsUpdate[kind as keyof typeof sections] = value as any
          }
        }

        setSections(sectionsUpdate)
        markSynced()
      }
    }

    loadInitialData()
  }, [projectId, enabled, supabase, parseSectionRow, setSections, markSynced, sections])

  // Subscribe to realtime changes
  useEffect(() => {
    if (!enabled || !projectId) return

    const channel = supabase
      .channel(`project_sections:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'project_sections',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          consola.debug('Realtime update:', payload)

          if (payload.eventType === 'DELETE') {
            // Handle deletion - reset to default
            const kind = (payload.old as any)?.kind
            if (kind) {
              setSections({ [kind]: Array.isArray(sections[kind as keyof typeof sections]) ? [] : '' })
            }
            return
          }

          const row = payload.new as {
            kind: string
            meta: Record<string, unknown> | null
            content_md: string | null
          }

          const { kind, value } = parseSectionRow(row)

          if (kind in sections) {
            setSections({ [kind]: value })
          }

          markSynced()
        }
      )
      .subscribe((status) => {
        consola.debug('Realtime subscription status:', status)
        if (status === 'SUBSCRIBED') {
          setSyncStatus('synced')
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [projectId, enabled, supabase, parseSectionRow, setSections, markSynced, setSyncStatus, sections])

  // Save function that the form/chat use
  const saveSection = useCallback(
    async (kind: string, data: unknown) => {
      setSyncStatus('saving')

      try {
        const formData = new FormData()
        formData.append('action', 'save-section')
        formData.append('projectId', projectId)
        formData.append('sectionKind', kind)
        formData.append('sectionData', JSON.stringify(data))

        const response = await fetch('/api/save-project-goals', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        })

        const result = await response.json()

        if (result.success) {
          markSynced()
        } else {
          setSyncStatus('error')
          consola.error('Failed to save section:', result)
        }

        return result
      } catch (error) {
        setSyncStatus('error')
        consola.error('Save error:', error)
        throw error
      }
    },
    [projectId, setSyncStatus, markSynced]
  )

  return { saveSection }
}
```

### 3. Context Provider

```typescript
// app/features/projects/contexts/project-setup-context.tsx

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useProjectSetupStore, type ProjectSectionData } from '../stores/project-setup-store'
import { useProjectSetupSync } from '../hooks/useProjectSetupSync'

interface ProjectSetupContextValue {
  sections: ProjectSectionData
  syncStatus: 'synced' | 'saving' | 'offline' | 'error'
  currentStep: string
  completedSteps: string[]
  updateSection: <K extends keyof ProjectSectionData>(
    key: K,
    value: ProjectSectionData[K]
  ) => void
  saveSection: (kind: string, data: unknown) => Promise<void>
  setCurrentStep: (step: string) => void
}

const ProjectSetupContext = createContext<ProjectSetupContextValue | null>(null)

interface ProjectSetupProviderProps {
  children: ReactNode
  projectId: string
  initialData?: Partial<ProjectSectionData>
}

export function ProjectSetupProvider({
  children,
  projectId,
  initialData,
}: ProjectSetupProviderProps) {
  const store = useProjectSetupStore()
  const { saveSection } = useProjectSetupSync({ projectId })

  // Initialize with any server-provided data
  useEffect(() => {
    if (initialData) {
      store.setSections(initialData)
    }
  }, [initialData, store])

  // Sync local changes to server with debounce
  const updateSection = useCallback(<K extends keyof ProjectSectionData>(
    key: K,
    value: ProjectSectionData[K]
  ) => {
    // Update local state immediately (optimistic)
    store.updateSection(key, value)

    // Debounced save to server
    // The useAutoSave hook already handles debouncing
    saveSection(key, value)
  }, [store, saveSection])

  const value: ProjectSetupContextValue = {
    sections: store.sections,
    syncStatus: store.syncStatus,
    currentStep: store.currentStep,
    completedSteps: store.completedSteps,
    updateSection,
    saveSection,
    setCurrentStep: store.setCurrentStep,
  }

  return (
    <ProjectSetupContext.Provider value={value}>
      {children}
    </ProjectSetupContext.Provider>
  )
}

export function useProjectSetup() {
  const context = useContext(ProjectSetupContext)
  if (!context) {
    throw new Error('useProjectSetup must be used within ProjectSetupProvider')
  }
  return context
}
```

### 4. Step Rail Component

```typescript
// app/features/projects/components/SetupStepRail.tsx

import { Check } from 'lucide-react'
import { cn } from '~/lib/utils'
import { useProjectSetup } from '../contexts/project-setup-context'

interface Step {
  id: string
  label: string
  description: string
}

const STEPS: Step[] = [
  { id: 'define', label: 'Define', description: 'What to learn' },
  { id: 'design', label: 'Design', description: 'How to learn it' },
  { id: 'collect', label: 'Collect', description: 'Gather responses' },
  { id: 'synthesize', label: 'Synthesize', description: 'Make sense of it' },
  { id: 'prioritize', label: 'Prioritize', description: 'Decide what matters' },
]

export function SetupStepRail() {
  const { currentStep, completedSteps, setCurrentStep } = useProjectSetup()

  const getStepStatus = (stepId: string) => {
    if (completedSteps.includes(stepId)) return 'complete'
    if (stepId === currentStep) return 'current'
    return 'upcoming'
  }

  return (
    <nav className="w-56 flex-shrink-0 border-r border-border bg-muted/30 p-4">
      <div className="space-y-1">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.id)

          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={cn(
                'group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                status === 'current' && 'bg-primary/10',
                status === 'upcoming' && 'opacity-60',
                'hover:bg-muted'
              )}
            >
              {/* Step indicator */}
              <div
                className={cn(
                  'mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  status === 'complete' && 'bg-primary/20 text-primary',
                  status === 'current' && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                  status === 'upcoming' && 'bg-muted text-muted-foreground'
                )}
              >
                {status === 'complete' ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  index + 1
                )}
              </div>

              {/* Step content */}
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'font-medium text-sm',
                    status === 'current' && 'text-foreground',
                    status !== 'current' && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {step.description}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
```

### 5. Mode Toggle Component

```typescript
// app/features/projects/components/SetupModeToggle.tsx

import { FileText, MessageSquare } from 'lucide-react'
import { cn } from '~/lib/utils'

interface SetupModeToggleProps {
  mode: 'chat' | 'form'
  onModeChange: (mode: 'chat' | 'form') => void
  className?: string
}

export function SetupModeToggle({ mode, onModeChange, className }: SetupModeToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border bg-muted/50 p-1',
        className
      )}
    >
      <button
        onClick={() => onModeChange('chat')}
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          mode === 'chat'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <MessageSquare className="h-4 w-4" />
        Chat
      </button>
      <button
        onClick={() => onModeChange('form')}
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          mode === 'form'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <FileText className="h-4 w-4" />
        Form
      </button>
    </div>
  )
}
```

### 6. Sync Status Indicator

```typescript
// app/features/projects/components/SyncStatusIndicator.tsx

import { Check, Cloud, CloudOff, Loader2 } from 'lucide-react'
import { useProjectSetup } from '../contexts/project-setup-context'
import { cn } from '~/lib/utils'

export function SyncStatusIndicator() {
  const { syncStatus } = useProjectSetup()

  const config = {
    synced: {
      icon: Check,
      label: 'Saved',
      className: 'text-muted-foreground',
    },
    saving: {
      icon: Loader2,
      label: 'Saving...',
      className: 'text-muted-foreground',
      iconClassName: 'animate-spin',
    },
    offline: {
      icon: CloudOff,
      label: 'Offline',
      className: 'text-amber-600',
    },
    error: {
      icon: Cloud,
      label: 'Save failed',
      className: 'text-destructive',
    },
  }[syncStatus]

  const Icon = config.icon

  return (
    <div className={cn('inline-flex items-center gap-1.5 text-xs', config.className)}>
      <Icon className={cn('h-3.5 w-3.5', config.iconClassName)} />
      <span>{config.label}</span>
    </div>
  )
}
```

---

## Step Completion Logic

### Determining Step Completion

Each step is considered complete when its required fields have meaningful values:

```typescript
// app/features/projects/utils/step-completion.ts

import type { ProjectSectionData } from '../stores/project-setup-store'

export function getStepCompletion(sections: ProjectSectionData) {
  return {
    define: Boolean(
      sections.research_goal?.trim() &&
      (sections.decision_questions?.length > 0 || sections.unknowns?.length > 0)
    ),
    design: Boolean(
      sections.interview_prompts?.length > 0 // Has questions ready
    ),
    collect: false, // Determined by response count
    synthesize: false, // Determined by lens completion
    prioritize: false, // Determined by prioritization/actions
  }
}

export function getCompletedSteps(sections: ProjectSectionData): string[] {
  const completion = getStepCompletion(sections)
  return Object.entries(completion)
    .filter(([, isComplete]) => isComplete)
    .map(([step]) => step)
}
```

---

## Form Mode: Field Components

The form should use shared components that connect to the store:

```typescript
// app/features/projects/components/form-fields/SectionTextField.tsx

import { useProjectSetup } from '../../contexts/project-setup-context'
import { Textarea } from '~/components/ui/textarea'
import { useCallback, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

interface SectionTextFieldProps {
  kind: keyof ProjectSectionData
  label: string
  placeholder?: string
  rows?: number
}

export function SectionTextField({
  kind,
  label,
  placeholder,
  rows = 3,
}: SectionTextFieldProps) {
  const { sections, updateSection } = useProjectSetup()
  const value = sections[kind] as string

  // Local state for immediate feedback
  const [localValue, setLocalValue] = useState(value)

  // Sync with store when store changes externally
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const debouncedUpdate = useDebouncedCallback((newValue: string) => {
    updateSection(kind, newValue)
  }, 500)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    debouncedUpdate(newValue)
  }, [debouncedUpdate])

  return (
    <div className="space-y-2">
      <label className="block font-medium text-sm text-foreground">
        {label}
      </label>
      <Textarea
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className="resize-none"
      />
    </div>
  )
}
```

---

## Chat Mode: Integration with Store

The chat component needs to update the store when the AI saves sections:

```typescript
// In ProjectSetupChat.tsx, update the tool call handler:

onToolCall: async ({ toolCall }) => {
  // ... existing handlers ...

  // Handle save-project-sections-data tool
  if (toolCall.toolName === 'save-project-sections-data') {
    const input = toolCall.input as Partial<ProjectSectionData>

    // The store will be updated via realtime subscription
    // But we can also update optimistically for immediate feedback
    for (const [key, value] of Object.entries(input)) {
      if (key !== 'project_id' && value !== undefined) {
        store.updateSection(key as keyof ProjectSectionData, value, { skipSync: true })
      }
    }
  }
}
```

---

## Migration Plan

### Phase 1: Shared State (Week 1)
1. Create Zustand store with section data
2. Create realtime subscription hook
3. Create context provider
4. Test with existing form component

### Phase 2: UI Components (Week 2)
1. Build SetupStepRail component
2. Build SetupModeToggle component
3. Build SyncStatusIndicator component
4. Integrate into setup page layout

### Phase 3: Form Integration (Week 3)
1. Create field components that use store
2. Refactor ProjectGoalsScreenRedesigned to use store
3. Remove duplicate state management
4. Test bidirectional sync

### Phase 4: Chat Integration (Week 4)
1. Update ProjectSetupChat to work with store
2. Add optimistic updates for tool calls
3. Test chat-to-form sync
4. Test form-to-chat reflection

### Phase 5: Polish (Week 5)
1. Add step completion logic
2. Add offline support
3. Add error recovery
4. Performance optimization

---

## File Structure

```
app/features/projects/
  contexts/
    project-setup-context.tsx
  stores/
    project-setup-store.ts
  hooks/
    useProjectSetupSync.ts
  components/
    SetupStepRail.tsx
    SetupModeToggle.tsx
    SyncStatusIndicator.tsx
    form-fields/
      SectionTextField.tsx
      SectionListField.tsx
      SectionTagField.tsx
  pages/
    setup.tsx (updated)
  utils/
    step-completion.ts
```

---

## Key Design Decisions

### Why Zustand over Context alone?
- Subscribable selectors prevent unnecessary re-renders
- Easier to persist/rehydrate state
- Works well with realtime updates
- Clear separation between state and UI

### Why not use React Query/TanStack Query?
- Project sections are highly interactive, not just fetched data
- Need fine-grained control over optimistic updates
- Realtime subscription doesn't fit query invalidation pattern
- Zustand is simpler for this use case

### Why realtime subscription instead of polling?
- Instant sync when chat saves data
- Lower server load than polling
- Better UX with immediate feedback
- Already using Supabase realtime elsewhere

### Why debounced saves instead of on-blur?
- More forgiving for typos
- Prevents save on every keystroke
- Still provides auto-save experience
- Works well with realtime sync

---

## Accessibility Considerations

1. **Step Rail Navigation**
   - Each step is a focusable button
   - Current step is announced to screen readers
   - Keyboard navigation with arrow keys

2. **Mode Toggle**
   - Uses button elements, not divs
   - Active state communicated via aria-pressed
   - Clear focus indicators

3. **Sync Status**
   - Uses aria-live region for status changes
   - Color is not the only indicator (icons + text)

4. **Form Fields**
   - All inputs have visible labels
   - Error states are announced
   - Required fields are marked
