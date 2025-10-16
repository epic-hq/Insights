# Storybook Design-to-Development Workflow

## Overview

This guide explains how designers and developers collaborate using Storybook to build and implement components.

---

## 🎨 For Designers: Creating Components in Storybook

### 1. Start Storybook

```bash
pnpm storybook
```

Access at: <http://localhost:6006>

### 2. Create a New Component Story

Use the generator script to create a story file:

```bash
npx tsx scripts/generate-story.ts ./app/components/ui/MyComponent.tsx
```

This creates `MyComponent.stories.tsx` with a basic template.

### 3. Design the Component Visually

Edit the story file to create different visual states:

```tsx
// app/components/ui/MyComponent.stories.tsx
import type { Meta, StoryObj } from "@storybook/react"
import { MyComponent } from "./MyComponent"

const meta = {
  title: "Components/UI/MyComponent",
  component: MyComponent,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MyComponent>

export default meta
type Story = StoryObj<typeof meta>

// Default state
export const Default: Story = {
  args: {
    title: "Hello World",
    variant: "primary",
  },
}

// Different variants
export const Secondary: Story = {
  args: {
    title: "Secondary Style",
    variant: "secondary",
  },
}

export const Large: Story = {
  args: {
    title: "Large Size",
    size: "lg",
  },
}

export const WithIcon: Story = {
  args: {
    title: "With Icon",
    icon: "check",
  },
}
```

### 4. Create the Component Implementation

Create the actual component file:

```tsx
// app/components/ui/MyComponent.tsx
import { cn } from "~/lib/utils"

interface MyComponentProps {
  title: string
  variant?: "primary" | "secondary"
  size?: "sm" | "md" | "lg"
  icon?: string
  className?: string
}

export function MyComponent({
  title,
  variant = "primary",
  size = "md",
  icon,
  className,
}: MyComponentProps) {
  return (
    <div
      className={cn(
        "rounded-lg p-4",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "secondary" && "bg-secondary text-secondary-foreground",
        size === "sm" && "text-sm",
        size === "lg" && "text-lg",
        className
      )}
    >
      {icon && <span className="mr-2">{icon}</span>}
      <span>{title}</span>
    </div>
  )
}
```

### 5. Iterate on Design

- View your component in Storybook at <http://localhost:6006>
- Make changes to the component
- See updates in real-time
- Create more story variants for different states

### 6. Add Interactive Controls

Make your component interactive in Storybook:

```tsx
const meta = {
  title: "Components/UI/MyComponent",
  component: MyComponent,
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary"],
      description: "Visual style variant",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Component size",
    },
    title: {
      control: "text",
      description: "Component title",
    },
  },
} satisfies Meta<typeof MyComponent>
```

Now designers can play with the component using Storybook's controls panel!

### 7. Document Usage

Add documentation to your story:

```tsx
const meta = {
  title: "Components/UI/MyComponent",
  component: MyComponent,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
# MyComponent

A versatile component for displaying content with different styles.

## Usage
\`\`\`tsx
<MyComponent title="Hello" variant="primary" />
\`\`\`

## When to use
- Use primary variant for main actions
- Use secondary variant for supporting content
        `,
      },
    },
  },
} satisfies Meta<typeof MyComponent>
```

### 8. Share with Developers

Once you're happy with the design:

1. Commit the story file and component
2. Share the Storybook URL with developers
3. Developers can see exact specs and behavior

---

## 👨‍💻 For Developers: Implementing Storybook Components

### 1. Review the Component in Storybook

1. Run Storybook: `pnpm storybook`
2. Navigate to the component story
3. Review all variants and states
4. Check the "Docs" tab for usage instructions
5. Use the "Controls" panel to test interactivity

### 2. Find the Component File

Component location follows this pattern:

```text
Story Title: "Components/UI/Button"
→ File: app/components/ui/Button.tsx
→ Story: app/components/ui/Button.stories.tsx

Story Title: "Features/Interviews/InterviewCard"
→ File: app/features/interviews/components/InterviewCard.tsx
→ Story: app/features/interviews/components/InterviewCard.stories.tsx
```

### 3. Import and Use the Component

#### Simple Component (No Router)

```tsx
// app/routes/my-page.tsx
import { MyComponent } from "~/components/ui/MyComponent"

export default function MyPage() {
  return (
    <div>
      <MyComponent 
        title="Welcome" 
        variant="primary" 
        size="lg" 
      />
    </div>
  )
}
```

#### Component with Data

```tsx
// app/routes/dashboard.tsx
import { InterviewCard } from "~/features/interviews/components/InterviewCard"

export default function Dashboard() {
  const interviews = useLoaderData<typeof loader>()
  
  return (
    <div className="grid gap-4">
      {interviews.map((interview) => (
        <InterviewCard 
          key={interview.id}
          interview={interview}
        />
      ))}
    </div>
  )
}
```

#### Component with React Router

If the component uses React Router hooks (`useNavigate`, `useParams`, etc.), ensure it's used within a route:

```tsx
// app/routes/interviews.$id.tsx
import { InterviewDetail } from "~/features/interviews/pages/detail"

export default function InterviewPage() {
  // Component has access to React Router context
  return <InterviewDetail />
}
```

### 4. Handle Component Props

Check the story file to see what props are available:

```tsx
// Look at the story args to see available props
export const Default: Story = {
  args: {
    title: "Example",        // ← Available prop
    variant: "primary",      // ← Available prop
    onClose: action("close") // ← Available prop (callback)
  },
}
```

Then use them in your app:

```tsx
<MyComponent
  title="My Title"
  variant="secondary"
  onClose={() => console.log("Closed!")}
/>
```

### 5. Adapt for Real Data

Components in Storybook use mock data. Replace with real data in your app:

**Storybook (mock data):**

```tsx
export const Default: Story = {
  parameters: {
    reactRouter: reactRouterParameters({
      routing: {
        loader: () => ({
          interview: { id: "1", title: "Mock Interview" }
        }),
      },
    }),
  },
}
```

**App (real data):**

```tsx
// app/routes/interviews.$id.tsx
export async function loader({ params }: LoaderFunctionArgs) {
  const interview = await getInterviewById(params.id)
  return { interview }
}

export default function InterviewPage() {
  const { interview } = useLoaderData<typeof loader>()
  return <InterviewDetail interview={interview} />
}
```

### 6. Handle Component State

If the component has internal state, you may need to lift it up:

**Component with internal state:**

```tsx
// Works in Storybook and simple cases
export function MyComponent() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

**Lifting state for app integration:**

```tsx
// Parent controls the state
export function MyPage() {
  const [count, setCount] = useState(0)
  
  return (
    <MyComponent 
      count={count} 
      onIncrement={() => setCount(c => c + 1)} 
    />
  )
}
```

### 7. Add Error Handling

Storybook components may not have error handling. Add it in your app:

```tsx
export default function MyPage() {
  const { data, error } = useLoaderData<typeof loader>()
  
  if (error) {
    return <ErrorMessage error={error} />
  }
  
  if (!data) {
    return <LoadingSpinner />
  }
  
  return <MyComponent data={data} />
}
```

### 8. Test Integration

After implementing:

1. Test the component in your app
2. Verify all props work correctly
3. Test with real data
4. Test error states
5. Test loading states
6. Test responsive behavior

---

## 🔄 Workflow Summary

### Designer Workflow

1. **Create** → Generate story with `npx tsx scripts/generate-story.ts`
2. **Design** → Build component visually in Storybook
3. **Iterate** → Adjust styles, variants, and states
4. **Document** → Add usage docs and controls
5. **Share** → Commit and share with developers

### Developer Workflow

1. **Review** → Check component in Storybook
2. **Locate** → Find component file from story title
3. **Import** → Import component into app
4. **Integrate** → Connect to real data and routes
5. **Adapt** → Add error handling and state management
6. **Test** → Verify in app with real scenarios

---

## 📋 Quick Reference

### Generate Story

```bash
# Basic component
npx tsx scripts/generate-story.ts ./app/components/ui/Button.tsx

# Component with React Router
npx tsx scripts/generate-story.ts ./app/features/interviews/pages/detail.tsx --router

# Custom title and layout
npx tsx scripts/generate-story.ts ./app/components/Card.tsx --title "Components/Card" --layout padded
```

### Import Component

```tsx
// From story title to import path
"Components/UI/Button"     → import { Button } from "~/components/ui/Button"
"Features/Interviews/Card" → import { Card } from "~/features/interviews/components/Card"
```

### Common Patterns

```tsx
// Simple component
<Button variant="primary">Click me</Button>

// Component with data
<InterviewCard interview={interview} />

// Component with callbacks
<Modal onClose={() => setOpen(false)} />

// Component with children
<Card>
  <CardHeader>Title</CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

---

## 🛠️ Tips & Best Practices

### For Designers

- ✅ Create multiple story variants (Default, Loading, Error, Empty)
- ✅ Use realistic mock data
- ✅ Add interactive controls for key props
- ✅ Document when and how to use the component
- ✅ Consider mobile/responsive states
- ✅ Test with different content lengths

### For Developers

- ✅ Check story file for prop types and examples
- ✅ Replace mock data with real data sources
- ✅ Add proper error handling
- ✅ Consider loading states
- ✅ Test edge cases not covered in Storybook
- ✅ Keep component API consistent with story

### Collaboration

- 🤝 Designers and developers review stories together
- 🤝 Use story comments to discuss implementation details
- 🤝 Update stories when component API changes
- 🤝 Keep stories in sync with production components

---

## 📚 Additional Resources

- [Full Storybook Guide](./storybook-guide.md) - Technical reference
- [Storybook Docs](https://storybook.js.org/docs) - Official documentation
- [React Router Addon](https://storybook.js.org/addons/storybook-addon-remix-react-router) - Router integration
