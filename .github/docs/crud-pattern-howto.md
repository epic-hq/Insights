# Complete CRUD Pattern Implementation Guide

This document provides a comprehensive guide for implementing full CRUD (Create, Read, Update, Delete) operations in our React Router 7 + Supabase application using the new feature-based routing and middleware context architecture.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Feature-Based Route Structure](#feature-based-route-structure)
3. [Database Schema Requirements](#database-schema-requirements)
4. [Implementation Pattern](#implementation-pattern)
5. [Frontend Components](#frontend-components)
6. [Complete Example: Personas CRUD](#complete-example-personas-crud)
7. [Best Practices](#best-practices)
8. [Testing Strategy](#testing-strategy)

## Architecture Overview

Our application uses a modern architecture with:
- **Feature-based routing**: Routes organized by entity in `app/features/{entity}/routes.ts`
- **Middleware authentication**: `_ProtectedLayout.tsx` handles auth and context setup
- **Context-based data access**: `userContext` and `loadContext` provide authenticated data access
- **Type-safe loaders**: Use `useLoaderData<typeof loader>()` for full type safety

## Feature-Based Route Structure

For any entity (e.g., `personas`, `people`, `opportunities`), create the following structure:

```
app/features/{entity}/
├── routes.ts                  # Route configuration
├── pages/
│   ├── index.tsx             # List view (READ all)
│   ├── {entity}Detail.tsx    # Detail view (READ one)
│   ├── new.tsx               # Create form (CREATE)
│   └── edit.tsx              # Edit form (UPDATE + DELETE)
└── components/               # Entity-specific components
```

### Route Configuration Pattern

**File:** `app/features/{entity}/routes.ts`

```typescript
import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes"

export default [
	...prefix("{entity}", [
		index("./features/{entity}/pages/index.tsx"),
		route("new", "./features/{entity}/pages/new.tsx"),
		route(":id", "./features/{entity}/pages/{entity}Detail.tsx"),
		route(":id/edit", "./features/{entity}/pages/edit.tsx"),
	]),
] satisfies RouteConfig
```

**Main Routes File:** `app/routes.ts`

```typescript
import { layout, type RouteConfig, route } from "@react-router/dev/routes"
import {entity}Routes from "./features/{entity}/routes"

const routes = [
	layout("./routes/_ProtectedLayout.tsx", [
		...{entity}Routes,
		// ... other feature routes
	]),
	// ... public routes
] satisfies RouteConfig

export default routes
```

## Database Schema Requirements

### Base Table Structure
```sql
CREATE TABLE {entity} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color_hex TEXT DEFAULT '#6b7280',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE {entity} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own {entity}" ON {entity}
    FOR ALL USING (account_id = auth.jwt() ->> 'sub');

-- Indexes
CREATE INDEX idx_{entity}_account_id ON {entity}(account_id);
CREATE INDEX idx_{entity}_created_at ON {entity}(created_at DESC);
```

### Junction Tables (if needed)
```sql
CREATE TABLE {entity1}_{entity2} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    {entity1}_id UUID NOT NULL REFERENCES {entity1}(id) ON DELETE CASCADE,
    {entity2}_id UUID NOT NULL REFERENCES {entity2}(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE({entity1}_id, {entity2}_id)
);
```

## Implementation Pattern

### 1. Index Route (List View)

**File:** `app/features/{entity}/pages/index.tsx`

```typescript
import type { LoaderFunctionArgs } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { userContext } from "~/server/user-context"
import type { Database } from "~/types"

type EntityRow = Database["public"]["Tables"]["{entity}"]["Row"]

export async function loader({ context }: LoaderFunctionArgs) {
    // Get authenticated user context from middleware
    const ctx = context.get(userContext)
    const accountId = ctx.account_id
    const supabase = ctx.supabase

    // Fetch entities with related data if needed
    const { data: entities, error } = await supabase
        .from("{entity}")
        .select(`
            *,
            related_table!inner(*)
        `)
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })

    if (error) {
        throw new Response(`Error fetching {entity}: ${error.message}`, { status: 500 })
    }

    return { entities: entities || [] }
}

export default function EntityIndex() {
    const { entities } = useLoaderData<typeof loader>()

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">
                    {entities.length} {entities.length === 1 ? 'Entity' : 'Entities'}
                </h1>
                <Button asChild>
                    <Link to="/{entity}/new">Add Entity</Link>
                </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {entities.map((entity) => (
                    <EntityCard key={entity.id} entity={entity} />
                ))}
            </div>
        </div>
    )
}
```

### 2. Detail Route (Read One)

**File:** `app/routes/_NavLayout.{entity}_.$id/route.tsx`

```typescript
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { getServerClient } from "~/lib/supabase/server"
import type { Database } from "~/types"

type EntityRow = Database["public"]["Tables"]["{entity}"]["Row"]

export async function loader({ request, params }: LoaderFunctionArgs) {
    const { client: supabase } = getServerClient(request)
    const { data: jwt } = await supabase.auth.getClaims()
    const accountId = jwt?.claims.sub
    if (!accountId) throw new Response("Unauthorized", { status: 401 })

    const entityId = params.id
    if (!entityId) throw new Response("Entity ID required", { status: 400 })

    const { data: entity, error } = await supabase
        .from("{entity}")
        .select("*")
        .eq("id", entityId)
        .eq("account_id", accountId)
        .single()

    if (error || !entity) {
        throw new Response("Entity not found", { status: 404 })
    }

    return { entity }
}

export default function EntityDetail() {
    const { entity } = useLoaderData<typeof loader>()

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{entity.name}</h1>
                    {entity.description && (
                        <p className="mt-2 text-gray-600">{entity.description}</p>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                        <a href={`/{entity}/${entity.id}/edit`}>Edit</a>
                    </Button>
                </div>
            </div>

            {/* Entity-specific content */}
        </div>
    )
}
```

### 3. Create Route (Create)

**File:** `app/routes/_NavLayout.{entity}_.new/route.tsx`

```typescript
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { Form, redirect, useNavigation } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { getServerClient } from "~/lib/supabase/server"
import type { Database } from "~/types"

type EntityInsert = Database["public"]["Tables"]["{entity}"]["Insert"]

export async function loader({ request }: LoaderFunctionArgs) {
    const { client: supabase } = getServerClient(request)
    const { data: jwt } = await supabase.auth.getClaims()
    const accountId = jwt?.claims.sub
    if (!accountId) throw new Response("Unauthorized", { status: 401 })

    return {}
}

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData()
    const name = (formData.get("name") as string)?.trim()
    if (!name) return { error: "Name is required" }

    const description = (formData.get("description") as string) || null
    const color_hex = (formData.get("color_hex") as string) || "#6b7280"

    const { client: supabase } = getServerClient(request)
    const { data: jwt } = await supabase.auth.getClaims()
    const accountId = jwt?.claims.sub
    if (!accountId) throw new Response("Unauthorized", { status: 401 })

    const entityData: EntityInsert = {
        name,
        description,
        color_hex,
        account_id: accountId,
    }

    const { data: entity, error } = await supabase
        .from("{entity}")
        .insert(entityData)
        .select()
        .single()

    if (error) {
        return { error: `Failed to create entity: ${error.message}` }
    }

    return redirect(`/{entity}/${entity.id}`)
}

export default function CreateEntity() {
    const navigation = useNavigation()
    const isSubmitting = navigation.state === "submitting"

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Create New Entity</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Entity Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form method="post" className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                Name *
                            </label>
                            <Input
                                id="name"
                                name="name"
                                type="text"
                                required
                                placeholder="Enter entity name"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                Description
                            </label>
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="Describe this entity..."
                                className="mt-1"
                                rows={4}
                            />
                        </div>

                        <div className="flex justify-end space-x-3">
                            <Button type="button" variant="outline" asChild>
                                <a href="/{entity}">Cancel</a>
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Creating..." : "Create Entity"}
                            </Button>
                        </div>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}
```

### 4. Edit Route (Update + Delete)

**File:** `app/routes/_NavLayout.{entity}_.$id_.edit/route.tsx`

```typescript
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { Form, redirect, useLoaderData, useNavigation } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { getServerClient } from "~/lib/supabase/server"
import type { Database } from "~/types"

type EntityInsert = Database["public"]["Tables"]["{entity}"]["Insert"]

export async function loader({ request, params }: LoaderFunctionArgs) {
    const { client: supabase } = getServerClient(request)
    const { data: jwt } = await supabase.auth.getClaims()
    const accountId = jwt?.claims.sub
    if (!accountId) throw new Response("Unauthorized", { status: 401 })

    const entityId = params.id
    if (!entityId) throw new Response("Entity ID required", { status: 400 })

    const { data: entity, error } = await supabase
        .from("{entity}")
        .select("*")
        .eq("id", entityId)
        .eq("account_id", accountId)
        .single()

    if (error || !entity) {
        throw new Response("Entity not found", { status: 404 })
    }

    return { entity }
}

export async function action({ request, params }: ActionFunctionArgs) {
    const formData = await request.formData()
    const intent = formData.get("intent") as string

    const { client: supabase } = getServerClient(request)
    const { data: jwt } = await supabase.auth.getClaims()
    const accountId = jwt?.claims.sub
    if (!accountId) throw new Response("Unauthorized", { status: 401 })

    const entityId = params.id
    if (!entityId) throw new Response("Entity ID required", { status: 400 })

    if (intent === "delete") {
        const { error } = await supabase
            .from("{entity}")
            .delete()
            .eq("id", entityId)
            .eq("account_id", accountId)

        if (error) {
            return { error: `Failed to delete entity: ${error.message}` }
        }

        return redirect("/{entity}")
    }

    // Handle update
    const name = (formData.get("name") as string)?.trim()
    if (!name) return { error: "Name is required" }

    const description = (formData.get("description") as string) || null
    const color_hex = (formData.get("color_hex") as string) || "#6b7280"

    const entityData: Partial<EntityInsert> = {
        name,
        description,
        color_hex,
    }

    const { data: entity, error } = await supabase
        .from("{entity}")
        .update(entityData)
        .eq("id", entityId)
        .eq("account_id", accountId)
        .select()
        .single()

    if (error) {
        return { error: `Failed to update entity: ${error.message}` }
    }

    return redirect(`/{entity}/${entity.id}`)
}

export default function EditEntity() {
    const { entity } = useLoaderData<typeof loader>()
    const navigation = useNavigation()
    const isSubmitting = navigation.state === "submitting"

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Edit Entity</h1>
                <Form method="post" className="inline">
                    <input type="hidden" name="intent" value="delete" />
                    <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={(e) => {
                            if (!confirm("Are you sure you want to delete this entity? This action cannot be undone.")) {
                                e.preventDefault()
                            }
                        }}
                    >
                        Delete Entity
                    </Button>
                </Form>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Entity Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form method="post" className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                Name *
                            </label>
                            <Input
                                id="name"
                                name="name"
                                type="text"
                                required
                                defaultValue={entity.name}
                                placeholder="Enter entity name"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                                Description
                            </label>
                            <Textarea
                                id="description"
                                name="description"
                                defaultValue={entity.description || ""}
                                placeholder="Describe this entity..."
                                className="mt-1"
                                rows={4}
                            />
                        </div>

                        <div className="flex justify-end space-x-3">
                            <Button type="button" variant="outline" asChild>
                                <a href={`/{entity}/${entity.id}`}>Cancel</a>
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Updating..." : "Update Entity"}
                            </Button>
                        </div>
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}
```

## Frontend Components

### Entity Card Component

```typescript
import { Link } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import type { Database } from "~/types"

type EntityRow = Database["public"]["Tables"]["{entity}"]["Row"]

interface EntityCardProps {
    entity: EntityRow & {
        // Add related data types here
    }
}

export default function EntityCard({ entity }: EntityCardProps) {
    const initials = entity.name
        ?.split(" ")
        .map(word => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?"

    return (
        <Link to={`/{entity}/${entity.id}`}>
            <Card className="group cursor-pointer transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                        <Avatar 
                            className="h-10 w-10 border-2" 
                            style={{ borderColor: entity.color_hex || "#6b7280" }}
                        >
                            <AvatarFallback 
                                className="text-white text-sm font-medium"
                                style={{ backgroundColor: entity.color_hex || "#6b7280" }}
                            >
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate font-semibold text-gray-900 group-hover:text-blue-600">
                                {entity.name}
                            </h3>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    {entity.description && (
                        <p className="mb-3 line-clamp-2 text-gray-600 text-sm">
                            {entity.description}
                        </p>
                    )}
                    
                    <div className="flex flex-wrap gap-1">
                        {/* Add related badges/info here */}
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between text-gray-500 text-xs">
                        <span>Created {new Date(entity.created_at).toLocaleDateString()}</span>
                        <span>Updated {new Date(entity.updated_at).toLocaleDateString()}</span>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
```

## Complete Example: Personas CRUD

The personas implementation in our codebase demonstrates this pattern perfectly:

- **Index:** `/app/routes/_NavLayout.personas/index.tsx`
- **Detail:** `/app/routes/_NavLayout.personas_.$personaId/route.tsx`
- **Create:** `/app/routes/_NavLayout.personas_.new/route.tsx`
- **Edit:** `/app/routes/_NavLayout.personas_.$personaId_.edit/route.tsx`
- **Component:** `/app/components/dashboard/PersonaCard.tsx`

## Best Practices

### 1. Authentication & Authorization
- Always validate `accountId` from JWT claims
- Use RLS policies for database-level security
- Return 401 for unauthorized requests
- Return 404 for not found resources

### 2. Error Handling
```typescript
if (error) {
    return { error: `Failed to ${action} entity: ${error.message}` }
}
```

### 3. Form Validation
- Validate required fields server-side
- Use `defaultValue` for edit forms, not `value`
- Handle form submission states with `useNavigation()`

### 4. Type Safety
- Use Supabase-generated types from `~/types`
- Define specific Insert/Update types
- Avoid `any` types

### 5. Performance
- Use `select()` to limit returned fields
- Add proper database indexes
- Use `order()` for consistent sorting

### 6. User Experience
- Show loading states during submissions
- Provide confirmation dialogs for destructive actions
- Use proper redirects after successful operations
- Display meaningful error messages

## Testing Strategy

### Integration Tests
```typescript
import { describe, it, expect } from "vitest"
import { seedTestData, testDb } from "~/utils/testDb"

describe("Entity CRUD", () => {
    it("should create, read, update, and delete entity", async () => {
        const { accountId } = await seedTestData()
        
        // Test CREATE
        const createData = { name: "Test Entity", account_id: accountId }
        const { data: created } = await testDb
            .from("{entity}")
            .insert(createData)
            .select()
            .single()
        
        expect(created.name).toBe("Test Entity")
        
        // Test READ
        const { data: read } = await testDb
            .from("{entity}")
            .select("*")
            .eq("id", created.id)
            .single()
        
        expect(read.id).toBe(created.id)
        
        // Test UPDATE
        const { data: updated } = await testDb
            .from("{entity}")
            .update({ name: "Updated Entity" })
            .eq("id", created.id)
            .select()
            .single()
        
        expect(updated.name).toBe("Updated Entity")
        
        // Test DELETE
        const { error } = await testDb
            .from("{entity}")
            .delete()
            .eq("id", created.id)
        
        expect(error).toBeNull()
    })
})
```

### Route Tests
```typescript
import { createRemixStub } from "@remix-run/testing"
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"

describe("Entity Routes", () => {
    it("should render entity index page", async () => {
        const RemixStub = createRemixStub([
            {
                path: "/{entity}",
                Component: EntityIndex,
                loader: () => ({ entities: [] }),
            },
        ])

        render(<RemixStub initialEntries={["/{entity}"]} />)
        
        expect(screen.getByText("0 Entities")).toBeInTheDocument()
    })
})
```

## Migration Checklist

When implementing CRUD for a new entity:

- [ ] Create database table with RLS policies
- [ ] Generate Supabase types (`npm run db:types`)
- [ ] Create route structure following naming conventions
- [ ] Implement loader functions with proper auth
- [ ] Implement action functions for CUD operations
- [ ] Create entity card component
- [ ] Add navigation links
- [ ] Write integration tests
- [ ] Test complete CRUD flow in browser
- [ ] Document entity-specific business logic

This pattern ensures consistency, security, and maintainability across all CRUD operations in the application.
