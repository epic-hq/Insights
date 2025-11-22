# Document Vocabulary Reference

Quick reference for natural language → document kind mapping.

## Strategic Documents

| User Says | Document Kind | Description |
|-----------|---------------|-------------|
| "positioning", "our position" | `positioning_statement` | Product/company positioning |
| "market analysis", "market research" | `market_analysis` | Market research and sizing |
| "competitive analysis", "competitor research" | `competitive_analysis` | Competitor deep-dive |
| "product roadmap", "roadmap" | `product_roadmap` | Product planning and timeline |
| "business plan" | `business_plan` | Overall business strategy |

## Marketing Documents

| User Says | Document Kind | Description |
|-----------|---------------|-------------|
| "SEO strategy", "keywords", "SEO plan" | `seo_strategy` | SEO keywords and approach |
| "content strategy", "content plan" | `content_strategy` | Content calendar and themes |
| "brand guidelines", "brand guide" | `brand_guidelines` | Brand identity rules |
| "messaging", "key messages" | `messaging_framework` | Core messaging and value props |
| "go to market", "GTM plan", "launch plan" | `go_to_market` | Go-to-market strategy |

## Product Documents

| User Says | Document Kind | Description |
|-----------|---------------|-------------|
| "feature specs", "feature requirements" | `feature_specs` | Feature specifications |
| "user stories" | `user_stories` | User story collection |
| "technical specs", "tech specs" | `technical_specs` | Technical design docs |
| "design docs", "design documentation" | `design_docs` | Design documentation |
| "PRD", "product requirements" | `product_requirements` | Product requirements doc |

## Research & Notes

| User Says | Document Kind | Description |
|-----------|---------------|-------------|
| "meeting notes", "notes from meeting" | `meeting_notes` | Meeting summaries |
| "research notes", "observations" | `research_notes` | Research observations |
| "interview notes" | `interview_notes` | Interview summaries |
| "user feedback", "customer feedback" | `user_feedback` | Customer feedback log |
| "call notes" | `call_notes` | Phone call notes |

## Business Documents

| User Says | Document Kind | Description |
|-----------|---------------|-------------|
| "pricing strategy", "pricing model" | `pricing_strategy` | Pricing approach and tiers |
| "sales playbook" | `sales_playbook` | Sales process and scripts |
| "partner strategy" | `partner_strategy` | Partnership approach |
| "budget plan" | `budget_plan` | Financial planning |
| "quarterly goals", "Q1 goals" | `q1_2025_goals` | Period-specific goals |

## Custom Documents

For unique documents, agents should create descriptive snake_case names:

| User Says | Suggested Kind | Notes |
|-----------|----------------|-------|
| "Q1 2025 goals" | `q1_2025_goals` | Include period in name |
| "customer interview with Acme Corp" | `customer_interview_acme` | Include entity name |
| "pricing discussion from Jan 19" | `pricing_discussion_2025_01_19` | Include date if relevant |
| "feature brainstorm session" | `feature_brainstorm_2025_01` | Descriptive + date |

## Agent Instructions

When users request to save/create/document something:

1. **Listen for action verbs**: save, create, write, document, capture, record
2. **Extract the subject**: what they want to save
3. **Map to document kind**: use vocabulary table or create descriptive snake_case
4. **Use `manageDocuments` tool**: with operation "upsert" (safest)

## Examples

```
User: "Can you save our positioning statement?"
Agent: manageDocuments({
  operation: "upsert",
  kind: "positioning_statement",
  content: "..."
})

User: "Document the meeting notes from today"
Agent: manageDocuments({
  operation: "create",
  kind: "meeting_notes_2025_01_19",
  content: "..."
})

User: "Write up the SEO strategy we discussed"
Agent: manageDocuments({
  operation: "upsert",
  kind: "seo_strategy",
  content: "..."
})

User: "Save this as our Q1 goals"
Agent: manageDocuments({
  operation: "upsert",
  kind: "q1_2025_goals",
  content: "..."
})
```

## Notes

- Always use `snake_case` for document kinds
- Use `upsert` operation when unsure if document exists
- Include dates in kind names for time-specific docs
- Keep kind names descriptive but concise
- Any kind name is valid - system is completely flexible!
