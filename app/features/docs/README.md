# Documentation Feature

## Overview
In-app documentation system accessible at `/docs` that provides user guides and help content.

## Structure

```
docs/
├── routes.ts                    # Route definitions
├── pages/
│   ├── index.tsx               # Main docs landing page with overview
│   ├── getting-started.tsx     # Step-by-step setup guide
│   ├── research-workflow.tsx   # Complete workflow documentation
│   └── analyzing-insights.tsx  # Analysis guide
└── README.md                   # This file
```

## Adding New Documentation Pages

1. Create a new page component in `pages/`:
```tsx
// pages/new-topic.tsx
import { ArrowLeft } from "lucide-react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"

export default function NewTopic() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <Link to="/docs">
        <Button variant="ghost" size="sm" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Docs
        </Button>
      </Link>
      
      <h1 className="mb-4 font-bold text-4xl tracking-tight">New Topic</h1>
      <p className="mb-8 text-muted-foreground text-lg">
        Description of the topic
      </p>
      
      {/* Content here */}
    </div>
  )
}
```

2. Add route to `routes.ts`:
```tsx
route("new-topic", "./features/docs/pages/new-topic.tsx"),
```

3. Add link to index page navigation

## Design Principles

- **User-focused**: Written from the user's perspective, not technical implementation
- **Progressive disclosure**: Start with basics, link to detailed guides
- **Visual hierarchy**: Use cards, icons, and proper spacing
- **Actionable**: Include clear steps and examples
- **Searchable**: Structure content for easy scanning

## Future Enhancements

- [ ] Search functionality
- [ ] Table of contents for long pages
- [ ] Video tutorials
- [ ] Interactive examples
- [ ] Feedback mechanism
- [ ] Version history
