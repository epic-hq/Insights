# Storybook Guide for Insights

## Overview

This project uses **Storybook 9.1.12** with **React Router v7** support for component development and documentation.

> 📖 **New to Storybook?** Check out the [Design-to-Development Workflow Guide](./storybook-workflow.md) for step-by-step instructions on how designers create components and developers implement them.

### Tech Stack

- **Storybook**: 9.1.12
- **React**: 19.2.0
- **React Router**: v7
- **Tailwind CSS**: v4 (via CDN in Storybook)
- **Addon**: `storybook-addon-remix-react-router` for React Router v7 support

---

## Quick Start

### Run Storybook

```bash
pnpm storybook
```

Access at: <http://localhost:6006>

### Build Storybook
```bash
pnpm build-storybook
```

---

## Creating Stories Manually

### 1. Basic Component Story (No Router)

For simple components that don't use React Router hooks:

```tsx
// app/components/MyButton.stories.tsx
import type { Meta, StoryObj } from "@storybook/react"
import { MyButton } from "./MyButton"

const meta = {
  title: "Components/MyButton",
  component: MyButton,
  parameters: {
    layout: "centered", // or "padded" or "fullscreen"
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "destructive"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof MyButton>

export default meta
type Story = StoryObj<typeof meta>

// Default story
export const Default: Story = {
  args: {
    children: "Click me",
    variant: "primary",
  },
}

// Additional variants
export const Secondary: Story = {
  args: {
    children: "Secondary Button",
    variant: "secondary",
  },
}

export const Large: Story = {
  args: {
    children: "Large Button",
    size: "lg",
  },
}
```

---

### 2. Component with React Router (Page/Feature)

For components that use React Router hooks (`useLoaderData`, `useParams`, `useNavigate`, etc.):

```tsx
// app/features/interviews/pages/detail.stories.tsx
import type { Meta, StoryObj } from "@storybook/react"
import { reactRouterParameters, withRouter } from "storybook-addon-remix-react-router"
import InterviewDetail from "./detail"

const meta = {
  title: "Features/Interviews/InterviewDetail",
  component: InterviewDetail,
  decorators: [withRouter], // REQUIRED for React Router
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof InterviewDetail>

export default meta
type Story = StoryObj<typeof meta>

// Mock data
const mockInterview = {
  id: "interview-1",
  title: "User Research Interview",
  date: "2024-01-15",
  // ... other fields
}

// Story with loader data and route params
export const Default: Story = {
  parameters: {
    reactRouter: reactRouterParameters({
      location: {
        pathParams: {
          accountId: "account-1",
          projectId: "project-1",
          interviewId: "interview-1",
        },
        searchParams: { tab: "insights" }, // Optional query params
        state: { fromPage: "dashboard" }, // Optional location state
      },
      routing: {
        path: "/a/:accountId/:projectId/interviews/:interviewId",
        loader: () => ({
          // Mock loader data
          accountId: "account-1",
          projectId: "project-1",
          interview: mockInterview,
          insights: [],
          evidence: [],
        }),
      },
    }),
  },
}

// Variant with different data
export const WithInsights: Story = {
  parameters: {
    reactRouter: reactRouterParameters({
      location: {
        pathParams: {
          accountId: "account-1",
          projectId: "project-1",
          interviewId: "interview-2",
        },
      },
      routing: {
        path: "/a/:accountId/:projectId/interviews/:interviewId",
        loader: () => ({
          accountId: "account-1",
          projectId: "project-1",
          interview: mockInterview,
          insights: [
            { id: "1", name: "Key Finding", category: "Pain Point" },
            { id: "2", name: "Feature Request", category: "Opportunity" },
          ],
          evidence: [],
        }),
      },
    }),
  },
}
```

---

### 3. Component with Actions/Forms

For components with form submissions or actions:

```tsx
import { action } from "@storybook/addon-actions"

export const WithFormSubmit: Story = {
  parameters: {
    reactRouter: reactRouterParameters({
      routing: {
        path: "/form",
        action: async ({ request }) => {
          const formData = await request.formData()
          action("form-submitted")(Object.fromEntries(formData))
          return { success: true }
        },
      },
    }),
  },
}
```

---

## Story Organization

### File Structure
```
app/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   └── Button.stories.tsx       # Component stories
│   └── features/
│       ├── FeatureCard.tsx
│       └── FeatureCard.stories.tsx
├── features/
│   ├── interviews/
│   │   ├── components/
│   │   │   └── InterviewCard.stories.tsx
│   │   └── pages/
│   │       └── detail.stories.tsx   # Page stories
│   └── people/
│       └── pages/
│           └── list.stories.tsx
└── test.stories.tsx                 # Test/demo stories
```

### Naming Convention
- **File**: `ComponentName.stories.tsx`
- **Title**: Use `/` for hierarchy: `"Features/Interviews/InterviewDetail"`
- **Story exports**: Use descriptive names: `Default`, `WithData`, `Loading`, `Error`

---

## Programmatic Story Generation

### Using CSF (Component Story Format) 3.0

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { MyComponent } from "./MyComponent"

const meta = {
  title: "Components/MyComponent",
  component: MyComponent,
} satisfies Meta<typeof MyComponent>

export default meta
type Story = StoryObj<typeof meta>

// Generate stories programmatically
const variants = ["primary", "secondary", "destructive"]
const sizes = ["sm", "md", "lg"]

// Create stories for each variant
variants.forEach((variant) => {
  const storyName = variant.charAt(0).toUpperCase() + variant.slice(1)
  
  // Note: This is TypeScript - you'd need to use a build script
  // or manually export each story
  export const [storyName]: Story = {
    args: { variant },
  }
})
```

### Using a Generator Script

Create a script to generate stories:

```typescript
// scripts/generate-story.ts
import fs from "fs"
import path from "path"

interface StoryConfig {
  componentPath: string
  componentName: string
  title: string
  hasRouter: boolean
  mockData?: Record<string, any>
}

function generateStory(config: StoryConfig): string {
  const { componentName, title, hasRouter, mockData } = config
  
  const imports = `import type { Meta, StoryObj } from "@storybook/react"
${hasRouter ? 'import { reactRouterParameters, withRouter } from "storybook-addon-remix-react-router"' : ''}
import { ${componentName} } from "./${componentName}"`

  const meta = `
const meta = {
  title: "${title}",
  component: ${componentName},
  ${hasRouter ? 'decorators: [withRouter],' : ''}
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ${componentName}>

export default meta
type Story = StoryObj<typeof meta>`

  const defaultStory = hasRouter
    ? `
export const Default: Story = {
  parameters: {
    reactRouter: reactRouterParameters({
      routing: {
        path: "/",
        loader: () => (${JSON.stringify(mockData, null, 2)}),
      },
    }),
  },
}`
    : `
export const Default: Story = {
  args: {},
}`

  return `${imports}\n${meta}\n${defaultStory}\n`
}

// Usage
const story = generateStory({
  componentPath: "./app/components/MyComponent.tsx",
  componentName: "MyComponent",
  title: "Components/MyComponent",
  hasRouter: false,
})

fs.writeFileSync("./app/components/MyComponent.stories.tsx", story)
```

Run with:

```bash
npx tsx scripts/generate-story.ts
```

---

## Best Practices

### 1. Mock Data
- Create reusable mock data in separate files:
```tsx
// app/features/interviews/mocks.ts
export const mockInterview = {
  id: "interview-1",
  title: "User Research",
  // ...
}

export const mockInsights = [
  { id: "1", name: "Finding 1" },
  { id: "2", name: "Finding 2" },
]
```

### 2. Shared Decorators
Create reusable decorators for common patterns:

```tsx
// .storybook/decorators.tsx
export const withPadding: Decorator = (Story) => (
  <div style={{ padding: "2rem" }}>
    <Story />
  </div>
)

export const withDarkMode: Decorator = (Story) => (
  <div className="dark">
    <Story />
  </div>
)
```

### 3. Story Variants
Create multiple stories for different states:

```tsx
export const Default: Story = { /* ... */ }
export const Loading: Story = { /* ... */ }
export const Error: Story = { /* ... */ }
export const Empty: Story = { /* ... */ }
export const WithData: Story = { /* ... */ }
```

### 4. Args and Controls
Use args for interactive controls:

```tsx
const meta = {
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary"],
      description: "Button variant",
    },
    disabled: {
      control: "boolean",
    },
    onClick: { action: "clicked" },
  },
}
```

---

## Troubleshooting

### Component uses React Router hooks
✅ **Solution**: Add `withRouter` decorator and use `reactRouterParameters`

### Component needs Supabase client
✅ **Already handled**: `window.env` is mocked in `.storybook/preview-head.html`

### Component needs CurrentProjectContext
✅ **Already handled**: Global decorator provides mock context

### Styles not appearing
✅ **Already handled**: Tailwind CDN loaded in `.storybook/preview-head.html`

### Component has server-side dependencies
❌ **Not supported**: Mock the data in the loader instead

---

## Configuration Files

### `.storybook/main.ts`
- Story locations
- Addons
- Framework config
- Vite config path

### `.storybook/preview.tsx`
- Global decorators
- Global parameters
- Theme configuration

### `.storybook/preview-head.html`
- Environment variables (`window.env`)
- Tailwind CDN
- Custom theme CSS

### `.storybook/vite.config.ts`
- Vite plugins (minimal)
- Path aliases
- Environment defines

---

## Resources

- [Storybook Docs](https://storybook.js.org/docs)
- [React Router Addon](https://storybook.js.org/addons/storybook-addon-remix-react-router)
- [CSF 3.0](https://storybook.js.org/docs/api/csf)
- [Args](https://storybook.js.org/docs/writing-stories/args)

---

## Example: Complete Story Template

```tsx
import type { Meta, StoryObj } from "@storybook/react"
import { reactRouterParameters, withRouter } from "storybook-addon-remix-react-router"
import { MyComponent } from "./MyComponent"

// Mock data
const mockData = {
  id: "1",
  name: "Example",
}

const meta = {
  title: "Category/MyComponent",
  component: MyComponent,
  decorators: [withRouter], // Only if using React Router
  parameters: {
    layout: "centered", // or "padded" or "fullscreen"
    docs: {
      description: {
        component: "Description of the component",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    // Define controls here
  },
} satisfies Meta<typeof MyComponent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // Component props
  },
  parameters: {
    reactRouter: reactRouterParameters({
      location: {
        pathParams: { id: "1" },
      },
      routing: {
        path: "/:id",
        loader: () => mockData,
      },
    }),
  },
}
```
