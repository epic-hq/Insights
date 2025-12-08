# Custom Lenses v1 - Implementation Plan

**Status**: Ready for implementation
**Scope**: AI-generated custom lenses via natural language description
**Effort**: ~4-5 days

---

## Design Decisions

| Aspect | Decision |
|--------|----------|
| **Table** | Single `conversation_lens_templates` for system + custom |
| **Primary Key** | Keep `template_key text primary key` |
| **Scoping** | Unique constraint on `(coalesce(account_id, nil_uuid), template_key)` |
| **Slug** | Auto-generated from name, unique within account |
| **Category** | Default `"custom"` for user-created lenses |
| **Visibility** | `is_public` boolean, default `true` (account-wide) |
| **Sharing** | Toggle: public (all account members) or private (creator only) |
| **Library UI** | Same grid, "Custom" badge on user lenses |
| **Regenerate** | Edit description → AI regenerates template_definition |
| **Delete** | Soft-delete via `is_active = false` |
| **Auto-apply** | Works like system lenses - add to `project_settings.enabled_lenses` |

---

## Phase 1: Schema Migration (0.5 day)

### 1.1 Add columns to `conversation_lens_templates`

**File**: `supabase/schemas/46_conversation_lenses.sql`

```sql
-- Add columns for custom lens support
alter table public.conversation_lens_templates
  add column if not exists account_id uuid references accounts.accounts(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists is_system boolean not null default false,
  add column if not exists is_public boolean not null default true,
  add column if not exists nlp_source text;

-- Unique constraint: template_key unique per account scope
-- System lenses (account_id null): globally unique
-- Custom lenses: unique within account
create unique index if not exists conversation_lens_templates_scoped_key_unique
  on public.conversation_lens_templates(
    coalesce(account_id, '00000000-0000-0000-0000-000000000000'::uuid),
    template_key
  );

-- Index for account-scoped queries
create index if not exists conversation_lens_templates_account_idx
  on public.conversation_lens_templates(account_id)
  where account_id is not null;

-- Mark existing templates as system
update public.conversation_lens_templates
set is_system = true
where account_id is null and is_system = false;
```

### 1.2 Update RLS policies

```sql
-- Drop existing read policy
drop policy if exists "Anyone can read active lens templates" on public.conversation_lens_templates;

-- Read: system templates + own account templates (public or created by me)
create policy "Users can read accessible templates"
  on public.conversation_lens_templates for select to authenticated
  using (
    is_active = true AND (
      is_system = true OR
      (account_id in (select accounts.get_accounts_with_role()) AND
       (is_public = true OR created_by = auth.uid()))
    )
  );

-- Insert: own account only, must not be system
create policy "Users can create templates in their account"
  on public.conversation_lens_templates for insert to authenticated
  with check (
    account_id in (select accounts.get_accounts_with_role()) AND
    is_system = false
  );

-- Update: creator only for custom templates
create policy "Users can update their own templates"
  on public.conversation_lens_templates for update to authenticated
  using (created_by = auth.uid() AND is_system = false)
  with check (created_by = auth.uid() AND is_system = false);

-- Delete: creator only for custom templates (soft-delete via is_active)
create policy "Users can delete their own templates"
  on public.conversation_lens_templates for delete to authenticated
  using (created_by = auth.uid() AND is_system = false);
```

### 1.3 Generate types

```bash
pnpm db:types
```

---

## Phase 2: BAML Template Generation (1 day)

### 2.1 Create `GenerateLensTemplate` function

**File**: `baml_src/generate_lens_template.baml`

```baml
class GeneratedLensSection {
  section_key string @description("Lowercase snake_case identifier")
  section_name string @description("Human-readable section title")
  description string? @description("Brief explanation of what this section captures")
  fields GeneratedLensField[]
}

class GeneratedLensField {
  field_key string @description("Lowercase snake_case identifier")
  field_name string @description("Human-readable field label")
  field_type "text" | "text_array" | "numeric" | "date" | "boolean"
  description string? @description("What this field captures")
}

class GeneratedLensTemplate {
  template_name string @description("Short, descriptive name for the lens (2-5 words)")
  summary string @description("One sentence describing what this lens extracts")
  primary_objective string @description("The main goal of applying this lens")
  sections GeneratedLensSection[] @description("2-5 sections grouping related fields")
  entities string[] @description("Entity types to extract: stakeholders, next_steps, objections, or empty")
  recommendations_enabled boolean @description("Whether to generate actionable recommendations")
}

function GenerateLensTemplate(
  user_description string @description("User's natural language description of what they want to extract"),
  example_context string? @description("Optional context about their interviews/use case")
) -> GeneratedLensTemplate {
  client CustomGPT4o
  prompt #"
    You are an expert at designing conversation analysis frameworks.
    Create a structured lens template based on the user's description.

    ## User's Description
    {{ user_description }}

    {% if example_context %}
    ## Additional Context
    {{ example_context }}
    {% endif %}

    ## Guidelines
    1. Create 2-5 logical sections that group related information
    2. Each section should have 2-6 fields
    3. Use appropriate field types:
       - text: Single value or summary (budget, timeline, main pain point)
       - text_array: Multiple items (features requested, competitors mentioned, objections)
       - numeric: Counts or scores (satisfaction rating, team size)
       - date: Dates (deadline, next meeting)
       - boolean: Yes/no flags (has budget, decision maker present)
    4. Use snake_case for keys, Title Case for names
    5. Include entities if the lens should extract:
       - stakeholders: People and their roles/influence
       - next_steps: Action items with owners/dates
       - objections: Concerns or blockers raised
    6. Enable recommendations if actionable insights would be valuable

    ## Examples of Good Section Design
    - For sales: qualification, opportunity, competition, next_steps
    - For research: problem_space, current_solutions, ideal_outcomes, constraints
    - For support: issue_details, impact, resolution, follow_up

    Return a well-structured template that will extract meaningful insights.
    {{ ctx.output_format }}
  "#
}
```

### 2.2 Generate BAML client

```bash
pnpm baml-generate
```

---

## Phase 3: API Routes (1 day)

### 3.1 Create custom lens CRUD API

**File**: `app/routes/api.custom-lens.tsx`

```typescript
/**
 * Custom Lens API
 *
 * POST: Generate and create a new custom lens from description
 * PATCH: Update lens (regenerate from edited description or toggle visibility)
 * DELETE: Soft-delete lens (set is_active = false)
 */

import { type ActionFunctionArgs } from "react-router"
import { z } from "zod"
import { b } from "~/../baml_client"
import { userContext } from "~/server/user-context"

const CreateLensSchema = z.object({
  intent: z.literal("create"),
  description: z.string().min(10).max(1000),
  context: z.string().max(500).optional(),
})

const UpdateLensSchema = z.object({
  intent: z.literal("update"),
  templateKey: z.string(),
  description: z.string().min(10).max(1000).optional(),
  isPublic: z.boolean().optional(),
})

const DeleteLensSchema = z.object({
  intent: z.literal("delete"),
  templateKey: z.string(),
})

function generateTemplateKey(name: string, existingKeys: string[]): string {
  let baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)

  if (!baseSlug) baseSlug = 'custom-lens'

  let slug = baseSlug
  let counter = 1
  while (existingKeys.includes(slug)) {
    slug = `${baseSlug}-${counter++}`
  }
  return slug
}

export async function action({ request, context, params }: ActionFunctionArgs) {
  const ctx = context.get(userContext)
  const supabase = ctx.supabase
  const userId = ctx.userId
  const accountId = params.accountId

  if (!supabase || !userId || !accountId) {
    return { error: "Unauthorized" }
  }

  const formData = await request.formData()
  const intent = formData.get("intent")

  // CREATE
  if (intent === "create") {
    const parsed = CreateLensSchema.safeParse({
      intent,
      description: formData.get("description"),
      context: formData.get("context"),
    })

    if (!parsed.success) {
      return { error: parsed.error.message }
    }

    const { description, context: userContext } = parsed.data

    // Generate template via BAML
    let generated
    try {
      generated = await b.GenerateLensTemplate(description, userContext || null)
    } catch (err) {
      return { error: "Failed to generate lens template. Please try a different description." }
    }

    // Get existing keys for this account to ensure uniqueness
    const { data: existing } = await supabase
      .from("conversation_lens_templates")
      .select("template_key")
      .eq("account_id", accountId)

    const existingKeys = (existing || []).map(t => t.template_key)
    const templateKey = generateTemplateKey(generated.template_name, existingKeys)

    // Insert new template
    const { data: newTemplate, error } = await supabase
      .from("conversation_lens_templates")
      .insert({
        template_key: templateKey,
        template_name: generated.template_name,
        summary: generated.summary,
        primary_objective: generated.primary_objective,
        category: "custom",
        display_order: 1000, // Custom lenses sort after system
        template_definition: {
          sections: generated.sections,
          entities: generated.entities,
          recommendations_enabled: generated.recommendations_enabled,
        },
        account_id: accountId,
        created_by: userId,
        is_system: false,
        is_public: true, // Default public
        is_active: true,
        nlp_source: description,
      })
      .select()
      .single()

    if (error) {
      return { error: `Failed to save lens: ${error.message}` }
    }

    return { success: true, template: newTemplate }
  }

  // UPDATE (regenerate or toggle visibility)
  if (intent === "update") {
    const parsed = UpdateLensSchema.safeParse({
      intent,
      templateKey: formData.get("templateKey"),
      description: formData.get("description"),
      isPublic: formData.get("isPublic") === "true",
    })

    if (!parsed.success) {
      return { error: parsed.error.message }
    }

    const { templateKey, description, isPublic } = parsed.data

    // Verify ownership
    const { data: existing } = await supabase
      .from("conversation_lens_templates")
      .select("*")
      .eq("template_key", templateKey)
      .eq("account_id", accountId)
      .eq("created_by", userId)
      .single()

    if (!existing) {
      return { error: "Template not found or access denied" }
    }

    const updates: Record<string, any> = {}

    // Regenerate if description provided
    if (description) {
      try {
        const generated = await b.GenerateLensTemplate(description, null)
        updates.template_name = generated.template_name
        updates.summary = generated.summary
        updates.primary_objective = generated.primary_objective
        updates.template_definition = {
          sections: generated.sections,
          entities: generated.entities,
          recommendations_enabled: generated.recommendations_enabled,
        }
        updates.nlp_source = description
      } catch (err) {
        return { error: "Failed to regenerate lens template." }
      }
    }

    // Toggle visibility
    if (isPublic !== undefined) {
      updates.is_public = isPublic
    }

    const { error } = await supabase
      .from("conversation_lens_templates")
      .update(updates)
      .eq("template_key", templateKey)
      .eq("account_id", accountId)

    if (error) {
      return { error: `Failed to update lens: ${error.message}` }
    }

    return { success: true }
  }

  // DELETE (soft-delete)
  if (intent === "delete") {
    const parsed = DeleteLensSchema.safeParse({
      intent,
      templateKey: formData.get("templateKey"),
    })

    if (!parsed.success) {
      return { error: parsed.error.message }
    }

    const { templateKey } = parsed.data

    const { error } = await supabase
      .from("conversation_lens_templates")
      .update({ is_active: false })
      .eq("template_key", templateKey)
      .eq("account_id", accountId)
      .eq("created_by", userId)

    if (error) {
      return { error: `Failed to delete lens: ${error.message}` }
    }

    return { success: true }
  }

  return { error: "Unknown intent" }
}
```

---

## Phase 4: UI Components (1.5 days)

### 4.1 Update `loadLensTemplates` to include custom lenses

**File**: `app/features/lenses/lib/loadLensAnalyses.server.ts`

Add `account_id`, `created_by`, `is_system`, `is_public`, `nlp_source` to the returned type and query.

### 4.2 Create lens dialog component

**File**: `app/features/lenses/components/CreateLensDialog.tsx`

- Textarea for description (placeholder: "Describe what you want to extract from conversations...")
- Optional context field
- "Generate" button → shows loading → shows preview
- Preview: sections/fields in read-only view
- "Save" or "Edit & Regenerate" buttons
- Save closes dialog, lens appears in grid

### 4.3 Update Library page

**File**: `app/features/lenses/pages/library.tsx`

- Replace "Coming Soon" section with working "Create Custom Lens" button
- Add "Custom" badge to custom lens cards
- Add owner indicator (if is_public and not created by current user: "Shared by [name]")
- Add dropdown menu to custom lens cards:
  - Edit (opens dialog with nlp_source pre-filled)
  - Toggle visibility (public/private)
  - Delete (with confirmation)

### 4.4 Update LensCard component

Add props for:
- `isCustom: boolean`
- `isOwner: boolean`
- `onEdit: () => void`
- `onDelete: () => void`
- `onToggleVisibility: () => void`

---

## Phase 5: Integration (0.5 day)

### 5.1 Update `applyAllLensesTask` to include custom lenses

The task already resolves lenses from `project_settings.enabled_lenses`. Custom lens template_keys can be added there via the library toggle, so no changes needed to the task itself.

### 5.2 Update library action to save custom lenses to project settings

When toggling a custom lens on, add its `template_key` to `project_settings.enabled_lenses` exactly like system lenses.

### 5.3 Test end-to-end flow

1. Create custom lens from description
2. Toggle it on in library
3. Upload new interview
4. Verify custom lens analysis appears in interview detail

---

## Files to Create/Modify

| Action | File | Description |
|--------|------|-------------|
| Modify | `supabase/schemas/46_conversation_lenses.sql` | Add columns, update RLS |
| Create | `baml_src/generate_lens_template.baml` | AI template generation |
| Create | `app/routes/api.custom-lens.tsx` | CRUD API |
| Modify | `app/features/lenses/lib/loadLensAnalyses.server.ts` | Include custom lens fields |
| Create | `app/features/lenses/components/CreateLensDialog.tsx` | Creation modal |
| Modify | `app/features/lenses/pages/library.tsx` | Add create button, badges, actions |
| Modify | `app/features/lenses/components/LensCard.tsx` | Custom lens actions |

---

## Not in v1 Scope

- Template field editor UI (only AI generation)
- Version history
- Clone system lens as starting point
- Cross-account sharing / marketplace
- Bulk apply custom lens to existing interviews

---

## Success Criteria

- [ ] User can describe a lens in natural language
- [ ] AI generates valid template_definition
- [ ] User can preview before saving
- [ ] User can edit description and regenerate
- [ ] Custom lens appears in library with "Custom" badge
- [ ] Toggle adds to project enabled_lenses
- [ ] New interviews auto-apply enabled custom lenses
- [ ] Custom lens analysis displays in interview detail
- [ ] Creator can toggle public/private visibility
- [ ] Creator can soft-delete their lens
