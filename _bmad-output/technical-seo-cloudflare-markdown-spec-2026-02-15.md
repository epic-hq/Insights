# Quick Spec: Technical SEO Foundation + Cloudflare Markdown Conversion

## 1. Problem
UpSight has strong product and content potential, but technical SEO is only partially standardized. Canonicals, crawl/index controls, redirects, structured data coverage, and internal linking rules are inconsistent across public pages. This creates indexation risk, duplicate-content drift, and weak extractability for Google Search and AI Overviews.

We also have no repeatable way to validate whether page content is "AI-search friendly" (answer-first structure, skimmable headings, FAQ coverage, citation-friendly formatting).

## 2. Decision (Recommended)
Ship a **Technical SEO hardening epic** with a paired **Cloudflare Markdown Conversion audit pipeline**.

Use Cloudflare Workers AI Markdown Conversion (`/ai/v1/to-markdown` / `AI.toMarkdown()`) to convert public pages to markdown and run automated content-quality checks aligned with:
- Google indexing basics (crawlability, canonicalization, structured data correctness).
- AI Overview readiness (clear answer-first structure, extractable headings/lists/FAQ, original value).

## 3. Objectives
1. Ensure all indexable public pages have correct canonical, crawl, and redirect behavior.
2. Remove accidental index bloat (params/search/thin duplicates).
3. Improve CTR + extractability with title/meta/heading/alt/schema improvements.
4. Add measurable weekly SEO ops cadence from GSC.
5. Automate page-structure QA using Cloudflare markdown conversion.

## 4. Scope
### In Scope
- Canonical URL standardization for all public marketing pages.
- Robots + sitemap consistency.
- 301 host/protocol normalization (`http -> https`, single hostname policy).
- Duplicate/thin page controls (`noindex`, canonical, robots handling).
- Internal linking pass and click-depth constraints for key SEO pages.
- JSON-LD schema rollout for supported page types.
- Cloudflare markdown conversion integration for SEO/AI-readiness audits.
- Reporting artifacts for weekly/monthly operations.

### Out of Scope (Phase 1)
- Mass generation of AI-written landing pages.
- Parasite SEO / third-party hosted pages.
- Unsupported schema types or speculative rich result markup.
- Full multilingual SEO rollout.

## 5. Current-State Notes (Codebase-Specific)
- Static sitemap currently served from `public/sitemap.xml`.
- Static robots served from `public/robots.txt`.
- Dynamic sitemap/robots routes exist in `app/routes/*` but are not the active source of truth.
- Canonical tags are not consistently emitted across public routes.
- Some structured data exists (e.g., blog detail) but not standardized.

## 6. Functional Requirements
### FR1 Canonicalization
- Every indexable public page emits exactly one `<link rel="canonical">`.
- Canonical helper computes absolute URL on approved host (`https://getupsight.com` unless changed globally).
- Non-indexable variants (tracking params, internal search, test pages) canonicalize or noindex by rule.

### FR2 Crawl/Index Controls
- No accidental `noindex` on target public pages.
- Intentional `noindex` on utility pages (embed/test/internal search/etc.) documented in rules table.
- Robots must allow target marketing/blog/case-study pages and disallow private/auth/API areas.

### FR3 Redirect and Host Policy
- Enforce permanent redirects:
  - `http -> https`
  - `www -> non-www` (or inverse if policy changes; one source of truth)
- Redirect behavior documented and integration-tested.

### FR4 Sitemap Governance
- `sitemap.xml` and `robots.txt` reference each other correctly.
- Sitemap includes all indexable marketing roots + dynamic content URL classes.
- Exclude non-indexable routes (`/api/*`, `/a/*`, internal/test pages).

### FR5 Duplicate/Thin Content Controls
- Define rules for query parameters:
  - keep + canonicalize important params
  - noindex/disallow internal search/filter pages if thin
- Add guardrail to prevent indexing low-value route variants.

### FR6 Metadata and Content Extractability
- Unique query-shaped title tags for priority pages.
- Meta descriptions optimized for CTR.
- Heading hierarchy standardized (single H1, meaningful H2/H3).
- Meaningful image alt text for non-decorative images.

### FR7 Structured Data Rollout
- JSON-LD only.
- Start with supported schemas:
  - `Organization`
  - `Article` / `BlogPosting`
  - `FAQPage` (only where true Q/A exists)
  - `Product` (if/where commercial plan pages qualify)
- Validate via Rich Results and monitor GSC Enhancements.

### FR8 Internal Linking and Information Architecture
- Priority pages reachable in <= 3 clicks from homepage/navigation paths.
- Every priority page receives multiple descriptive internal links.
- Topic clusters defined for 3-5 core topics with hub/spoke linking.

### FR9 Cloudflare Markdown Conversion Audit Pipeline
- Implement service for Cloudflare markdown conversion:
  - Input: URL from sitemap
  - Output: markdown + optional structured JSON result
- Persist snapshots under a deterministic path (e.g. `temp/seo-markdown/<date>/...`).
- Run lint checks over markdown:
  - direct answer in first section
  - who-it’s-for + scope intro
  - clear sections (what/when/steps/examples/faq)
  - table/list/citation-magnet presence for pillar pages
- Emit machine-readable report + human markdown summary.

### FR10 Weekly/Monthly SEO Ops Automation
- Weekly checklist output:
  - GSC high-impression/low-CTR pages
  - indexing errors
  - internal-link refresh targets
- Monthly checklist output:
  - 2 page refresh candidates
  - 1 citation-magnet candidate

## 7. Technical Design
### SEO primitives
- Add central SEO utility module (e.g. `app/lib/seo/*`) for:
  - canonical URL builder
  - robots meta policy
  - shared meta helpers
  - JSON-LD helper

### Routing and surface area
- Standardize public-route SEO in:
  - `app/features/marketing/pages/*`
  - blog/case-study routes
- Keep a single source of truth for sitemap/robots output strategy (static or dynamic) and document it.

### Cloudflare integration
- Preferred: Cloudflare Worker binding (`AI.toMarkdown()`) if deployed in Workers.
- Fallback: REST call to Cloudflare endpoint (`/accounts/{account_id}/ai/v1/to-markdown`) from server-side script.
- Auth via env vars (account id + API token), never hardcoded.

### CI/automation
- Add script: `pnpm seo:audit-markdown` to run conversion + lint across sitemap URLs.
- Optional CI gate for warnings/errors on tier-1 pages.

## 8. User Stories (<= 12)
1. As a search engine, I can crawl and index only intended public pages.
2. As a visitor, I see accurate title/description snippets in SERP.
3. As an SEO owner, I have one canonical URL per indexable page.
4. As an SEO owner, I can verify redirect/host normalization reliably.
5. As an SEO owner, I can trust sitemap coverage of indexable URLs.
6. As a content owner, I can see which pages are weak for AI extraction.
7. As a content owner, I get a markdown-based lint report with fixes.
8. As a growth owner, I can prioritize pages with high impressions/low CTR.
9. As a growth owner, I can enforce schema correctness on key templates.
10. As a PM, I can track progress via Beads tasks tied to measurable acceptance criteria.

## 9. Acceptance Criteria
- 100% of indexable public pages emit exactly one canonical tag.
- Redirect tests confirm `http -> https` and single-host canonicalization.
- Sitemap contains only indexable URLs and passes XML validation.
- Robots file references sitemap and disallows intended private paths.
- Structured data validates on representative templates (home, blog detail, pricing/marketing page).
- Markdown audit runs against sitemap URLs and produces actionable report without runtime failure.
- At least top 10 priority pages pass markdown lint requirements for answer-first structure and section coverage.
- Documented weekly/monthly operating rhythm committed in repo.

## 10. Metrics
- Indexed pages vs submitted pages delta (GSC).
- CTR uplift on top impression pages after title/meta refresh.
- Coverage of valid structured data items/enhancements.
- Canonical mismatch count (target: 0 on indexable set).
- Markdown lint pass rate for priority pages.

## 11. Risks and Mitigations
- Risk: Duplicate sitemap strategies (static + dynamic) drift.
  - Mitigation: choose one source of truth and deprecate the other.
- Risk: Cloudflare API limits/auth failures break audits.
  - Mitigation: retries, partial-failure reporting, non-blocking mode for non-critical pages.
- Risk: Over-templated content quality drops.
  - Mitigation: enforce originality/case-study evidence and avoid scaled low-quality generation.

## 12. Delivery Plan
### Phase A: Technical SEO Baseline (Week 1)
- Canonicals, robots, sitemap normalization.
- Redirect/host policy enforcement.
- Duplicate/noindex rules.

### Phase B: On-Page + Schema (Week 2)
- Title/meta/heading/alt pass on priority pages.
- JSON-LD rollout + validation.
- Internal linking improvements for topic clusters.

### Phase C: Cloudflare Markdown QA + Ops (Week 3)
- Implement markdown conversion integration and lint pipeline.
- Produce first SEO+AI readiness report.
- Operationalize weekly/monthly rhythm.

## 13. References
- Cloudflare Workers AI Markdown Conversion:
  - https://developers.cloudflare.com/workers-ai/features/markdown-conversion/
- Google Search Essentials / spam policies / structured data guidance (to be linked in implementation docs).
