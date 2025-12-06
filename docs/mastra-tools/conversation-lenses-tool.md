# Conversation Lenses Tool

## Overview

The `fetchConversationLenses` tool provides Mastra agents with access to conversation lens templates and analyses. Conversation lenses are analytical frameworks for extracting structured insights from interviews.

## Available Lens Templates

### 1. Project Research (`project-research`)
**Category:** Research
**Purpose:** Answer project goals, decision questions, and resolve unknowns

**Sections:**
- Research Goal Answers
- Decision Insights
- Unknowns Resolved
- Target Fit Assessment

### 2. Customer Discovery (`customer-discovery`)
**Category:** Research
**Purpose:** Validate problem-solution fit and gather product development insights

**Sections:**
- Problem Validation
- Solution Validation
- Market Insights

### 3. User Testing (`user-testing`)
**Category:** Product
**Purpose:** Evaluate usability, identify friction points, gather feature feedback

**Sections:**
- Usability
- Feature Feedback
- Satisfaction

### 4. Product Insights (`product-insights`)
**Category:** Product
**Purpose:** Extract JTBD, feature requests, product gaps, competitive intelligence

**Sections:**
- Jobs to be Done
- Feature Requests
- Product Gaps
- Competitive Insights

### 5. Sales BANT (`sales-bant`)
**Category:** Sales
**Purpose:** Qualify opportunities using Budget, Authority, Need, Timeline

**Sections:**
- BANT Qualification
- Opportunity Assessment
- Next Steps

### 6. Empathy Map / JTBD (`empathy-map-jtbd`)
**Category:** Research
**Purpose:** Understand user motivations, jobs-to-be-done, emotional drivers

**Sections:**
- Empathy Map (Says, Thinks, Does, Feels, Pains, Gains)
- Jobs to be Done (Functional, Social, Emotional)

## Tool Usage

### Parameters

```typescript
{
  mode?: "templates" | "analyses" | "both",  // Default: "both"
  projectId?: string,                         // Required for analyses
  interviewId?: string,                       // Filter by specific interview
  templateKey?: string,                       // Filter by specific lens
  category?: string,                          // Filter by category (research/product/sales)
  status?: "pending" | "processing" | "completed" | "failed",  // Filter analyses by status
  limit?: number                              // Max analyses to return (default: 50)
}
```

### Example Use Cases

#### 1. List All Available Lenses
```typescript
fetchConversationLenses({
  mode: "templates"
})
```

#### 2. Get Customer Discovery Template Details
```typescript
fetchConversationLenses({
  mode: "templates",
  templateKey: "customer-discovery"
})
```

#### 3. Get All Lens Analyses for a Project
```typescript
fetchConversationLenses({
  mode: "analyses",
  projectId: "abc-123"
})
```

#### 4. Get BANT Analysis for Specific Interview
```typescript
fetchConversationLenses({
  mode: "analyses",
  interviewId: "xyz-789",
  templateKey: "sales-bant"
})
```

#### 5. Get All Completed Research Lenses
```typescript
fetchConversationLenses({
  mode: "analyses",
  projectId: "abc-123",
  category: "research",
  status: "completed"
})
```

## Output Schema

### Templates Output
```typescript
{
  success: boolean,
  message: string,
  templates: [{
    templateKey: string,
    templateName: string,
    summary: string | null,
    category: string | null,
    displayOrder: number,
    primaryObjective: string | null,
    sections: [{
      sectionKey: string,
      sectionName: string,
      description?: string,
      fields: [{
        fieldKey: string,
        fieldName: string,
        fieldType: "text" | "text_array" | "numeric" | "date" | "boolean",
        description?: string
      }]
    }],
    requiresProjectContext?: boolean,
    recommendationsEnabled?: boolean
  }],
  totalTemplates: number
}
```

### Analyses Output
```typescript
{
  success: boolean,
  message: string,
  analyses: [{
    id: string,
    interviewId: string,
    templateKey: string,
    templateName: string,
    analysisData: any,  // Structured data matching template definition
    confidenceScore: number | null,
    status: "pending" | "processing" | "completed" | "failed",
    errorMessage: string | null,
    processedAt: string | null,
    createdAt: string,
    interviewUrl: string | null
  }],
  totalAnalyses: number
}
```

## Agent Instructions

The tool is integrated into the `projectStatusAgent` with the following guidance:

### General Lens Queries

> If they ask about conversation lenses, analytical frameworks, or structured interview analysis (e.g., "what lenses are available?", "show me the BANT analysis", "what's the customer discovery lens?"), call "fetchConversationLenses". Use mode='templates' to see available frameworks, mode='analyses' to see applied lens results for interviews, or mode='both' (default). Filter by templateKey (e.g., 'customer-discovery', 'sales-bant', 'project-research', 'user-testing', 'product-insights', 'empathy-map-jtbd') or category ('research', 'product', 'sales'). When asking about a specific interview's lens analysis, provide the interviewId.

### Sales Qualification Workflow

When users ask about **sales, deals, qualification, or BANT**, the agent follows this structured approach:

1. **Fetch BANT Analyses**: Call `fetchConversationLenses` with `mode='analyses'`, `templateKey='sales-bant'`, and `projectId`
2. **Extract BANT Signals** from `analysis_data`:
   - **Budget**: Allocated funds, budget cycle, spending authority
   - **Authority**: Decision makers, influencers, champions, buying committee
   - **Need**: Pain severity, urgency, business impact, consequences of inaction
   - **Timeline**: Buying timeline, implementation schedule, decision dates
3. **Identify Strengths**: Explicit budget confirmation, direct access to economic buyers, urgent/critical needs, near-term timelines
4. **Identify Gaps**: Unclear budget, no access to decision makers, vague needs, distant/undefined timelines
5. **Cross-Reference**: Check `fetchOpportunities` for existing deals and `fetchTasks` for open sales-related tasks
6. **Provide Summary**:
   - Overall qualification health (strong/moderate/weak)
   - Key strengths by BANT dimension
   - Critical gaps that need addressing
   - Recommended next steps (e.g., "Schedule call with CFO to discuss budget")
   - Related open tasks or suggestions for new follow-up tasks
7. **Format**: Use markdown headers and bullet points for clear, scannable responses

#### Example Sales Response Format

```markdown
## Sales Qualification Summary

**Overall Health**: Moderate (3 of 5 interviews show strong signals)

### 🟢 Strong Signals
- **Budget**: 2 prospects confirmed allocated budget ($50K-100K range)
- **Authority**: Direct access to VP Engineering at Acme Corp
- **Need**: Critical pain point - current solution failing in production

### 🟡 Gaps & Weaknesses
- **Timeline**: Only 1 prospect has defined timeline (Q1 2025)
- **Authority**: No economic buyer access at 2 companies
- **Budget**: 3 prospects haven't discussed budget yet

### 📋 Recommended Next Steps
1. **Urgent**: Schedule CFO call at TechCo to discuss budget approval process
2. **This Week**: Get timeline commitment from Acme VP - they're ready to move
3. **Follow-up**: Re-engage Beta Inc to identify economic buyer

### 🎯 Related Tasks
- [Open] Demo prep for Acme Corp (Due: Dec 15)
- [Suggested] Create task: "Budget qualification call with TechCo CFO"
```

## Database Schema

### Tables
- `conversation_lens_templates` - Reusable lens definitions
- `conversation_lens_analyses` - Applied lens results on interviews

### Key Features
- Templates are globally readable by authenticated users
- Analyses are account-scoped via RLS policies
- Each interview can have multiple lens analyses (one per template)
- Analysis data is stored as JSONB matching template structure

## Common Queries

### "What lenses are available?"
```typescript
fetchConversationLenses({ mode: "templates" })
```

### "Show me all sales lenses"
```typescript
fetchConversationLenses({
  mode: "templates",
  category: "sales"
})
```

### "What's the status of lens analyses for this project?"
```typescript
fetchConversationLenses({
  mode: "analyses",
  projectId: currentProjectId
})
```

### "Get the customer discovery analysis for interview X"
```typescript
fetchConversationLenses({
  mode: "analyses",
  interviewId: "interview-id",
  templateKey: "customer-discovery"
})
```

## Implementation Notes

- The tool uses `supabaseAdmin` for database access
- RLS policies automatically handle account-based access control
- Template definitions are stored as JSONB with flexible schema
- Analysis data structure matches the template's field definitions
- URLs are generated using `createRouteDefinitions` for proper multi-tenant routing
