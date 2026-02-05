# Feature Specification: HITL Web Research Workflow

## Overview

Design a human-in-the-loop web research workflow that clarifies intent, constrains scope, and returns concise, source-linked outputs. This is a workflow-first capability (not a generic agent) to reduce cost and avoid vague answers.

## Objectives

- Force intent clarification before any web calls.
- Produce concise, structured outputs (2-3 bullets unless user asks for more).
- Preserve traceability: every claim links to a source.
- Support common research intents (companies, people, market, competitors, long-form topic summaries).
- Make the user the approver before expensive or broad searches.

## Non-Goals

- Freeform long-form market reports by default.
- Autonomous multi-step research without explicit approval.
- Guessing output format when the user hasn’t specified it.

## Primary User Intents

1) Research a company or list of companies.
2) Find companies matching criteria X and Y.
3) Competitive research for a product/market.
4) Enrich people or organizations with external info.
5) High-level topic brief ("tell me about this space").
6) Source-specific deep dive (URL, PDF, report).

## Workflow vs Agent Decision

- Workflow: intent clarification, scope constraints, query plan, execution, review, and final output. This is deterministic and should be controlled.
- Agent: only for synthesis once the user approves scope and sources.

## HITL Workflow (Mastra)

Workflow: `web-research-hitl`

### Step 1: Intake
- Parse the user request into an initial intent type.
- If intent is ambiguous, ask 1-2 clarifying questions.

### Step 2: Clarify + Constrain (HITL Gate)
- Ask for: scope, output format, and constraints (time, region, industry).
- Confirm budgeted search size (e.g., "Search 5-10 sources?").
- User must confirm before moving to execution.

### Step 3: Plan
- Generate a short research plan:
  - Target sources/types (news, company site, LinkedIn, reports).
  - Proposed queries.
  - Expected output format.
- Present plan to user for approval.

### Step 4: Execute
- Run searches via Exa or other sources.
- Limit results by agreed scope.
- Store links and metadata for citations.

### Step 5: Draft Output
- Produce concise summary with citations.
- If enrichment: suggest exact fields to update and ask approval.

### Step 6: Review (HITL Gate)
- Show draft and ask: "Use this as final?" or "Refine?"

### Step 7: Finalize
- Provide final response.
- Optional: save a research note and/or update records if approved.

## Tooling

### Existing
- `webResearch` (Exa-based)
- `findSimilarPages`
- `fetchWebContent`
- `generateDocumentLink`
- `manageAnnotations`

### Needed / Nice-to-have
- PDF ingestion: `ingestPdfFromUrl` or extend `fetchWebContent` to detect and parse PDFs.
- Domain filters: allow `site:` or source category filters in `webResearch`.
- Entity enrichment tool for people/orgs with explicit field mapping and approval.
- Research note writer with structured metadata.

## Data Contract (Example)

```
intent: "company_research" | "company_discovery" | "people_enrichment" | "competitive" | "topic_brief"
scope: { regions?: string[], industries?: string[], timeRange?: string, maxResults: number }
outputFormat: "bullets" | "table" | "brief" | "comparison"
approval: boolean
```

## UX Expectations

- Ask 1-2 concise questions max per clarification step.
- Use confirmation prompts before external search and before record updates.
- Default output is 2-3 bullets with links.

## Pros / Cons

Pros
- Lower cost and fewer irrelevant searches.
- Predictable structure with clear user control.
- Higher trust via citations and approval gates.

Cons
- Slightly slower due to approvals.
- More UI prompts if the user is vague.
- Requires additional tooling for PDF and enrichment.

## Confidence

- Medium-High (0.78): workflow is clear, but PDF ingestion and enrichment tools need definition.

## Next Steps

- Implement workflow skeleton in `app/mastra/workflows/web-research-hitl.ts`.
- Add a minimal prompt template for each intent type.
- Add a PDF ingestion tool or extend `fetchWebContent` to handle PDFs reliably.
