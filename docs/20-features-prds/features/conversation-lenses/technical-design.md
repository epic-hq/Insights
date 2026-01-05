# Dynamic Conversation Lenses Implementation Plan

## Executive Summary

Transform the static, code-defined lens system into a dynamic, user-configurable platform that supports:
1. **Template Library** - Browsable catalog of built-in and custom lenses
2. **NLP Lens Authoring** - Users describe lenses in natural language, AI translates to executable templates
3. **Hashtag/Feed System** - Subscribe to lens outputs with alerts via Slack, email, or in-app notifications
4. **Company-wide Feed** - Twitter-like feed for team collaboration on conversation insights

## Current State Analysis

### What Exists Today

| Component | Status | Location |
|-----------|--------|----------|
| **Template Schema** | ✅ Complete | `supabase/migrations/20251202140000_conversation_lenses.sql` |
| **Static Templates** | ✅ 4 seeded | Same migration (customer-discovery, user-testing, sales-bant, empathy-map-jtbd) |
| **BAML Contracts** | ✅ Partial | `baml_src/sales_lens_extraction.baml` (only sales working) |
| **Sales Lens Task** | ✅ Working | `src/trigger/sales/generateSalesLens.ts` |
| **Evidence Extraction** | ✅ Working | `baml_src/extract_evidence.baml` + orchestrator pipeline |
| **Lens UI Components** | ⚠️ Sales-only | `app/features/lenses/components/ConversationLenses.tsx` |
| **conversation_lens_analyses** | ❌ Unused | Schema exists but no code writes to it |
| **Custom Templates** | ❌ Missing | No CRUD, no per-account storage |
| **Auto-detection** | ❌ Missing | No BAML function to suggest appropriate lens |
| **Feed/Subscriptions** | ❌ Missing | No infrastructure |

### Key Gaps

1. **No way to author custom templates** - Templates are code-defined
2. **Only Sales Lens is wired** - Other BAML contracts exist but unused
3. **No lens selector UI** - Users can't choose which lens to apply
4. **No subscription/feed system** - No alerts or collaboration features
5. **Evidence not linked to lens outputs** - Missing traceability

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│  Lens Library    │  Lens Selector   │  Feed/Dashboard  │  Authoring │
│  (Browse/Clone)  │  (Per-Interview) │  (Subscriptions) │  (NLP→BAML)│
└────────┬─────────┴────────┬─────────┴────────┬─────────┴─────┬──────┘
         │                  │                  │               │
┌────────┴──────────────────┴──────────────────┴───────────────┴──────┐
│                         API LAYER                                    │
├─────────────────────────────────────────────────────────────────────┤
│  /api/lens-templates   │  /api/lens-analyses  │  /api/lens-feeds    │
│  (CRUD + validation)   │  (Apply + detect)    │  (Subscribe + alert)│
└────────┬───────────────┴────────┬─────────────┴─────────┬───────────┘
         │                        │                       │
┌────────┴────────────────────────┴───────────────────────┴───────────┐
│                       TRIGGER.DEV TASKS                              │
├─────────────────────────────────────────────────────────────────────┤
│  ApplyLensTask    │  AutoDetectLensTask  │  NotifyFeedSubscribers   │
│  (Generic runner) │  (Suggest best lens) │  (Slack/Email/In-app)    │
└────────┬──────────┴──────────┬───────────┴──────────┬────────────────┘
         │                     │                      │
┌────────┴─────────────────────┴──────────────────────┴───────────────┐
│                         BAML LAYER                                   │
├─────────────────────────────────────────────────────────────────────┤
│  ApplyConversationLens()  │  DetectConversationLens()  │  NLPToLens()│
│  (Template→Analysis)      │  (Evidence→Suggestions)    │  (NL→JSON) │
└────────┬──────────────────┴────────────┬───────────────┴─────┬──────┘
         │                               │                     │
┌────────┴───────────────────────────────┴─────────────────────┴──────┐
│                       DATABASE LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  conversation_lens_templates  │  conversation_lens_analyses         │
│  (+ account_id, version)      │  (+ hashtags, feed linking)         │
├─────────────────────────────────────────────────────────────────────┤
│  lens_feed_subscriptions      │  lens_feed_posts                    │
│  (User preferences)           │  (Generated feed items)             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Template Registry & Generic Lens Engine

**Goal**: Enable any template from the database to be applied to any interview.

### 1.1 Database Enhancements

**Modify `conversation_lens_templates` to support custom templates:**

```sql
-- Add fields for custom template support
ALTER TABLE conversation_lens_templates
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts.accounts(id),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_template_key text REFERENCES conversation_lens_templates(template_key),
  ADD COLUMN IF NOT EXISTS nlp_source text; -- Original NLP description if AI-generated

-- Index for account-scoped queries
CREATE INDEX IF NOT EXISTS conversation_lens_templates_account_idx
  ON conversation_lens_templates(account_id) WHERE account_id IS NOT NULL;

-- Update RLS for custom templates
CREATE POLICY "Users can read their account templates"
  ON conversation_lens_templates FOR SELECT TO authenticated
  USING (
    is_active = true AND (
      is_system = true OR
      account_id IN (SELECT accounts.get_accounts_with_role())
    )
  );

CREATE POLICY "Users can create account templates"
  ON conversation_lens_templates FOR INSERT TO authenticated
  WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));

CREATE POLICY "Users can update their account templates"
  ON conversation_lens_templates FOR UPDATE TO authenticated
  USING (account_id IN (SELECT accounts.get_accounts_with_role()))
  WITH CHECK (account_id IN (SELECT accounts.get_accounts_with_role()));
```

### 1.2 BAML Generic Lens Function

**Create `baml_src/apply_conversation_lens.baml`:**

```baml
// Generic lens application that works with any template definition

class LensFieldValue {
  field_key string @description("Matches field_key from template")
  value string @description("Extracted value or summary")
  confidence float @description("0.0-1.0 confidence score")
  evidence_ids string[] @description("IDs of supporting evidence")
  anchors MediaAnchor[] @description("Timestamp anchors for evidence")
}

class LensSectionResult {
  section_key string @description("Matches section_key from template")
  fields LensFieldValue[] @description("Extracted field values")
}

class LensEntityResult {
  entity_type string @description("e.g., stakeholders, objections")
  items EntityItem[] @description("Extracted entities")
}

class EntityItem {
  name string
  role string?
  description string?
  confidence float
  evidence_ids string[]
}

class LensRecommendation {
  type string @description("next_step, follow_up, risk, opportunity")
  description string
  priority "high" | "medium" | "low"
  rationale string?
  evidence_ids string[]
}

class ConversationLensResult {
  template_key string
  sections LensSectionResult[]
  entities LensEntityResult[]
  recommendations LensRecommendation[]
  overall_confidence float
  processing_notes string?
}

function ApplyConversationLens(
  template_definition: string,  // JSON of the template structure
  template_name: string,
  evidence_json: string,
  interview_context: string,
  user_goals: string[],
  custom_instructions: string?
) -> ConversationLensResult {
  client CustomGPT4o
  prompt #"
    You are an expert conversation analyst. Apply the following analytical lens/framework
    to extract structured insights from interview evidence.

    ## Template: {{ template_name }}
    {{ template_definition }}

    ## Interview Context
    {{ interview_context }}

    ## User's Goals for This Analysis
    {{ user_goals }}

    {% if custom_instructions %}
    ## Custom Instructions
    {{ custom_instructions }}
    {% endif %}

    ## Evidence from Interview
    {{ evidence_json }}

    ## Instructions
    1. For each section and field defined in the template, extract the relevant information
    2. Always cite evidence_ids that support each extraction
    3. Include timestamp anchors when available for video/audio playback
    4. Assign confidence scores based on how directly the evidence supports the extraction
    5. Generate actionable recommendations based on the analysis
    6. If a field cannot be determined from the evidence, indicate low confidence

    {{ ctx.output_format }}
  "#
}
```

### 1.3 Generic Trigger.dev Task

**Create `src/trigger/lens/applyConversationLens.ts`:**

```typescript
import { task } from "@trigger.dev/sdk"
import { b } from "~/../baml_client"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

type ApplyLensPayload = {
  interviewId: string
  templateKey: string
  userGoals?: string[]
  customInstructions?: string
  computedBy?: string
}

export const applyConversationLensTask = task({
  id: "lens.apply-conversation-lens",
  retry: { maxAttempts: 3 },
  run: async (payload: ApplyLensPayload) => {
    const client = createSupabaseAdminClient()

    // 1. Load template definition
    const { data: template } = await client
      .from("conversation_lens_templates")
      .select("*")
      .eq("template_key", payload.templateKey)
      .single()

    if (!template) throw new Error(`Template not found: ${payload.templateKey}`)

    // 2. Load interview and evidence
    const { data: interview } = await client
      .from("interviews")
      .select("id, account_id, project_id, title")
      .eq("id", payload.interviewId)
      .single()

    const { data: evidence } = await client
      .from("evidence")
      .select("id, gist, verbatim, chunk, start_ms, end_ms, facet_mentions")
      .eq("interview_id", payload.interviewId)
      .order("start_ms")

    // 3. Build context and call BAML
    const evidenceJson = JSON.stringify(evidence)
    const interviewContext = `Interview: ${interview?.title || 'Untitled'}`

    const result = await b.ApplyConversationLens(
      JSON.stringify(template.template_definition),
      template.template_name,
      evidenceJson,
      interviewContext,
      payload.userGoals || [],
      payload.customInstructions
    )

    // 4. Store in conversation_lens_analyses
    const { data: analysis } = await client
      .from("conversation_lens_analyses")
      .upsert({
        interview_id: payload.interviewId,
        template_key: payload.templateKey,
        account_id: interview!.account_id,
        project_id: interview!.project_id,
        analysis_data: {
          sections: result.sections,
          entities: result.entities,
          recommendations: result.recommendations,
        },
        confidence_score: result.overall_confidence,
        user_goals: payload.userGoals,
        custom_instructions: payload.customInstructions,
        processed_by: payload.computedBy,
        processed_at: new Date().toISOString(),
        status: 'completed',
      }, {
        onConflict: 'interview_id,template_key',
      })
      .select()
      .single()

    return { analysisId: analysis?.id, templateKey: payload.templateKey }
  }
})
```

### 1.4 Lens Selector UI Component

**Create `app/features/lenses/components/LensSelector.tsx`:**

```tsx
import { useState, useEffect } from "react"
import { useLoaderData, useFetcher } from "react-router"
import { Button } from "~/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Loader2, Sparkles, Check } from "lucide-react"

type LensTemplate = {
  template_key: string
  template_name: string
  summary: string
  category: string
  is_system: boolean
}

type Props = {
  interviewId: string
  templates: LensTemplate[]
  appliedLenses: string[] // template_keys that have been applied
  onLensApplied?: (templateKey: string) => void
}

export function LensSelector({ interviewId, templates, appliedLenses, onLensApplied }: Props) {
  const [selectedLens, setSelectedLens] = useState<string>("")
  const fetcher = useFetcher()
  const isApplying = fetcher.state !== "idle"

  const handleApplyLens = () => {
    if (!selectedLens) return

    fetcher.submit(
      { interview_id: interviewId, template_key: selectedLens },
      { method: "POST", action: "/api/apply-lens" }
    )
  }

  useEffect(() => {
    if (fetcher.data?.ok && selectedLens) {
      onLensApplied?.(selectedLens)
      setSelectedLens("")
    }
  }, [fetcher.data])

  const groupedTemplates = templates.reduce((acc, t) => {
    const cat = t.category || "other"
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {} as Record<string, LensTemplate[]>)

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedLens} onValueChange={setSelectedLens}>
        <SelectTrigger className="w-[240px]">
          <SelectValue placeholder="Select a lens to apply..." />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(groupedTemplates).map(([category, lenses]) => (
            <div key={category}>
              <div className="px-2 py-1 text-xs text-muted-foreground uppercase">{category}</div>
              {lenses.map((lens) => (
                <SelectItem
                  key={lens.template_key}
                  value={lens.template_key}
                  disabled={appliedLenses.includes(lens.template_key)}
                >
                  <div className="flex items-center gap-2">
                    {lens.template_name}
                    {appliedLenses.includes(lens.template_key) && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                    {lens.is_system && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">System</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>

      <Button onClick={handleApplyLens} disabled={!selectedLens || isApplying}>
        {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Apply Lens
      </Button>
    </div>
  )
}
```

### 1.5 Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/202512XX_lens_custom_templates.sql` | Create | Add account_id, versioning to templates |
| `baml_src/apply_conversation_lens.baml` | Create | Generic lens BAML function |
| `src/trigger/lens/applyConversationLens.ts` | Create | Generic trigger task |
| `app/routes/api.apply-lens.tsx` | Create | API endpoint to trigger lens |
| `app/routes/api.lens-templates.tsx` | Create | CRUD for custom templates |
| `app/features/lenses/components/LensSelector.tsx` | Create | UI for selecting lenses |
| `app/features/lenses/components/GenericLensView.tsx` | Create | Render any lens result |
| `app/features/lenses/lib/lensTemplates.server.ts` | Create | Template loading/validation |
| `app/features/interviews/pages/detail.tsx` | Modify | Add LensSelector + tabs |

---

## Phase 2: NLP Lens Authoring

**Goal**: Users describe a lens in natural language, AI generates executable template.

### 2.1 NLP-to-Template BAML Function

**Add to `baml_src/apply_conversation_lens.baml`:**

```baml
class GeneratedField {
  field_key string @description("URL-safe slug like 'primary_pain_points'")
  field_name string @description("Human-readable name")
  field_type "text" | "text_array" | "numeric" | "date" | "boolean"
  description string @description("Instructions for AI to extract this field")
}

class GeneratedSection {
  section_key string
  section_name string
  fields GeneratedField[]
}

class GeneratedTemplate {
  template_key string @description("URL-safe slug derived from name")
  template_name string
  summary string
  primary_objective string
  category "research" | "sales" | "product" | "operations" | "custom"
  sections GeneratedSection[]
  entities string[] @description("Entity types to extract: stakeholders, objections, features, etc.")
  recommendations_enabled bool
  suggested_hashtags string[] @description("Hashtags for feed subscriptions")
}

function NLPToConversationLens(
  user_description: string,
  example_use_cases: string?,
  existing_templates: string?  // JSON of current templates for reference
) -> GeneratedTemplate {
  client CustomGPT4o
  prompt #"
    You are an expert at designing conversation analysis frameworks. A user wants to create
    a custom "lens" for analyzing interviews and conversations.

    ## User's Description
    {{ user_description }}

    {% if example_use_cases %}
    ## Example Use Cases
    {{ example_use_cases }}
    {% endif %}

    {% if existing_templates %}
    ## Existing Templates (for reference)
    {{ existing_templates }}
    {% endif %}

    ## Instructions
    1. Design a structured template that captures the user's analytical intent
    2. Create 2-4 logical sections with 2-5 fields each
    3. Field descriptions should be clear instructions for AI extraction
    4. Suggest relevant entity types (stakeholders, objections, features, risks, etc.)
    5. Generate appropriate hashtags for feed subscriptions
    6. Keep template_key and section_key as URL-safe slugs
    7. Balance comprehensiveness with practical extraction

    {{ ctx.output_format }}
  "#
}
```

### 2.2 Template Authoring UI

**Create `app/features/lenses/pages/create-lens.tsx`:**

```tsx
export default function CreateLensPage() {
  const [nlpDescription, setNlpDescription] = useState("")
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const fetcher = useFetcher()

  const handleGenerate = async () => {
    setIsGenerating(true)
    const result = await fetcher.submit(
      { description: nlpDescription },
      { method: "POST", action: "/api/generate-lens-from-nlp" }
    )
    setGeneratedTemplate(fetcher.data?.template)
    setIsGenerating(false)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Create Custom Lens</h1>

      <div className="space-y-6">
        {/* Step 1: NLP Input */}
        <Card>
          <CardHeader>
            <CardTitle>Describe Your Lens</CardTitle>
            <CardDescription>
              Tell us what you want to learn from conversations. Be specific about the
              questions you want answered.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="I want to know about how customers place orders within an ERP system. What steps are most difficult, and what might be more helpful..."
              value={nlpDescription}
              onChange={(e) => setNlpDescription(e.target.value)}
              rows={4}
            />
            <Button onClick={handleGenerate} disabled={isGenerating} className="mt-4">
              {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Generate Template
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Review & Edit */}
        {generatedTemplate && (
          <Card>
            <CardHeader>
              <CardTitle>Review Generated Template</CardTitle>
            </CardHeader>
            <CardContent>
              <TemplateEditor
                template={generatedTemplate}
                onChange={setGeneratedTemplate}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 3: Hashtags & Visibility */}
        {generatedTemplate && (
          <Card>
            <CardHeader>
              <CardTitle>Visibility & Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Suggested Hashtags</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {generatedTemplate.suggested_hashtags.map((tag) => (
                      <Badge key={tag} variant="secondary">#{tag}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Visibility</Label>
                  <RadioGroup defaultValue="private">
                    <RadioGroupItem value="private" label="Private - Only my account" />
                    <RadioGroupItem value="subscribable" label="Subscribable - Others can subscribe to my feed" />
                    <RadioGroupItem value="public" label="Public - Anyone can use this template" />
                  </RadioGroup>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save */}
        {generatedTemplate && (
          <Button onClick={handleSave} size="lg">
            Create Lens
          </Button>
        )}
      </div>
    </div>
  )
}
```

---

## Phase 3: Feed & Subscription System

**Goal**: Users subscribe to hashtags/lenses and receive alerts when new results are generated.

### 3.1 Database Schema for Feeds

```sql
-- Lens feed posts (generated when lens is applied)
CREATE TABLE IF NOT EXISTS public.lens_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.conversation_lens_analyses(id) ON DELETE CASCADE,
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  template_key text NOT NULL REFERENCES public.conversation_lens_templates(template_key),
  account_id uuid NOT NULL REFERENCES accounts.accounts(id),

  -- Feed metadata
  title text NOT NULL,
  summary text NOT NULL,
  hashtags text[] DEFAULT '{}',

  -- Visibility
  visibility text DEFAULT 'account' CHECK (visibility IN ('private', 'account', 'subscribable', 'public')),

  created_at timestamptz NOT NULL DEFAULT now()
);

-- User subscriptions to feeds
CREATE TABLE IF NOT EXISTS public.lens_feed_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What they're subscribed to (one of these should be set)
  template_key text REFERENCES public.conversation_lens_templates(template_key),
  hashtag text,
  account_id uuid REFERENCES accounts.accounts(id),

  -- Notification preferences
  notify_slack boolean DEFAULT false,
  notify_email boolean DEFAULT false,
  notify_in_app boolean DEFAULT true,
  slack_channel_id text,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT subscription_target CHECK (
    (template_key IS NOT NULL)::int +
    (hashtag IS NOT NULL)::int +
    (account_id IS NOT NULL)::int = 1
  )
);

CREATE INDEX lens_feed_posts_hashtags_idx ON lens_feed_posts USING GIN (hashtags);
CREATE INDEX lens_feed_posts_account_idx ON lens_feed_posts(account_id, created_at DESC);
CREATE INDEX lens_feed_subscriptions_user_idx ON lens_feed_subscriptions(user_id);
```

### 3.2 Feed Generation After Lens Application

**Add to `applyConversationLens.ts`:**

```typescript
// After storing analysis, generate feed post
const feedTitle = `${template.template_name} analysis: ${interview.title}`
const feedSummary = result.recommendations
  .slice(0, 2)
  .map(r => r.description)
  .join(". ")

// Extract hashtags from template + custom
const hashtags = [
  template.template_key,
  ...(template.template_definition.suggested_hashtags || []),
  ...extractHashtagsFromAnalysis(result)
]

await client.from("lens_feed_posts").insert({
  analysis_id: analysis.id,
  interview_id: payload.interviewId,
  template_key: payload.templateKey,
  account_id: interview.account_id,
  title: feedTitle,
  summary: feedSummary,
  hashtags,
  visibility: template.is_public ? 'public' : 'account',
})

// Trigger notification task
await notifyFeedSubscribersTask.trigger({
  feedPostId: feedPost.id,
  hashtags,
  templateKey: payload.templateKey,
  accountId: interview.account_id,
})
```

### 3.3 Notification Task

**Create `src/trigger/lens/notifyFeedSubscribers.ts`:**

```typescript
export const notifyFeedSubscribersTask = task({
  id: "lens.notify-feed-subscribers",
  run: async (payload: NotifyPayload) => {
    const client = createSupabaseAdminClient()

    // Find all matching subscriptions
    const { data: subscriptions } = await client
      .from("lens_feed_subscriptions")
      .select("*")
      .or(`
        template_key.eq.${payload.templateKey},
        account_id.eq.${payload.accountId},
        hashtag.in.(${payload.hashtags.join(",")})
      `)

    // Group by notification type
    const slackNotifications = subscriptions.filter(s => s.notify_slack)
    const emailNotifications = subscriptions.filter(s => s.notify_email)
    const inAppNotifications = subscriptions.filter(s => s.notify_in_app)

    // Send notifications in parallel
    await Promise.all([
      sendSlackNotifications(slackNotifications, payload),
      sendEmailNotifications(emailNotifications, payload),
      createInAppNotifications(inAppNotifications, payload),
    ])
  }
})
```

### 3.4 Feed Dashboard UI

**Create `app/features/feed/pages/lens-feed.tsx`:**

```tsx
export default function LensFeedPage() {
  const { feedPosts, subscriptions } = useLoaderData<typeof loader>()

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Lens Feed</h1>
        <Button asChild>
          <Link to="/feed/subscriptions">Manage Subscriptions</Link>
        </Button>
      </div>

      {/* Subscription chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {subscriptions.map(sub => (
          <Badge key={sub.id} variant="outline">
            #{sub.hashtag || sub.template_key}
            {sub.notify_slack && <Slack className="h-3 w-3 ml-1" />}
          </Badge>
        ))}
      </div>

      {/* Feed posts */}
      <div className="space-y-4">
        {feedPosts.map(post => (
          <FeedPostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}

function FeedPostCard({ post }: { post: FeedPost }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between">
          <CardTitle className="text-lg">{post.title}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {formatRelativeTime(post.created_at)}
          </span>
        </div>
        <div className="flex gap-1">
          {post.hashtags.map(tag => (
            <Badge key={tag} variant="secondary">#{tag}</Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{post.summary}</p>
        <Button variant="link" asChild className="p-0 mt-2">
          <Link to={`/interviews/${post.interview_id}?lens=${post.template_key}`}>
            View Analysis →
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## Phase 4: Auto-Detection & Pipeline Integration

**Goal**: Automatically suggest and apply appropriate lenses after interview processing.

### 4.1 Detection BAML Function

**Add to `baml_src/apply_conversation_lens.baml`:**

```baml
class LensSuggestion {
  template_key string
  confidence float @description("0.0-1.0 how well this lens fits")
  rationale string @description("Why this lens is appropriate")
}

function DetectConversationLens(
  evidence_summary: string,
  interview_context: string,
  available_templates: string  // JSON array of {template_key, template_name, summary}
) -> LensSuggestion[] {
  client CustomGPT4o
  prompt #"
    You are an expert at matching conversations to analytical frameworks.

    ## Interview Context
    {{ interview_context }}

    ## Evidence Summary
    {{ evidence_summary }}

    ## Available Templates
    {{ available_templates }}

    ## Instructions
    Analyze the evidence and suggest which lenses would be most valuable to apply.
    Return templates sorted by confidence (highest first).
    Only suggest lenses where confidence > 0.5.
    Consider:
    - Type of conversation (sales, research, support, etc.)
    - Topics discussed
    - Stakeholders involved
    - User's likely goals

    {{ ctx.output_format }}
  "#
}
```

### 4.2 Integration with Interview Pipeline

**Modify `src/trigger/interview/v2/finalizeInterview.ts`:**

```typescript
// After finalize completes, suggest lenses
const { data: templates } = await client
  .from("conversation_lens_templates")
  .select("template_key, template_name, summary")
  .eq("is_active", true)

const suggestions = await b.DetectConversationLens(
  evidenceSummary,
  `Interview: ${interview.title}`,
  JSON.stringify(templates)
)

// Store suggestions for UI
await client.from("interviews").update({
  suggested_lenses: suggestions.filter(s => s.confidence > 0.6)
}).eq("id", interviewId)

// Optionally auto-apply high-confidence lenses
for (const suggestion of suggestions.filter(s => s.confidence > 0.8)) {
  await applyConversationLensTask.trigger({
    interviewId,
    templateKey: suggestion.template_key,
    autoDetected: true,
  })
}
```

---

## Implementation Phases Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| **Phase 1** | 2-3 weeks | Generic lens engine, template CRUD, LensSelector UI |
| **Phase 2** | 1-2 weeks | NLP authoring, template editor, validation |
| **Phase 3** | 2-3 weeks | Feed tables, subscriptions, Slack/email notifications |
| **Phase 4** | 1 week | Auto-detection, pipeline integration |

## Migration Strategy

1. **Dual-write period**: New lenses write to `conversation_lens_analyses`, old sales lens continues writing to `sales_lens_*`
2. **Read migration**: Update UI to read from new table when available, fallback to old
3. **Backfill**: Migrate existing `sales_lens_summaries` data to new structure
4. **Deprecate**: Remove old sales lens code paths

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| BAML quality varies by template | Medium | Validate templates, show confidence scores |
| Feed spam from auto-detection | Medium | Confidence thresholds, user controls |
| Complex NLP generates invalid templates | Medium | Validation layer, manual review option |
| Notification overload | Low | Digest options, granular controls |

## Success Metrics

- Templates created per account per month
- Lens applications per interview
- Feed subscription rate
- Notification engagement rate
- Time to first insight (from upload to lens result)
