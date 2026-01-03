# Positioning Assessment: Consulting Practices

*Created: 2026-01-02*
*Status: Strategic evaluation for market positioning*

## Executive Summary

This document evaluates positioning UpSight for **consulting practices** that need to:
- Interview multiple stakeholders
- Synthesize findings into unified project plans
- Identify scope of work (SOW), risks, and recommendations
- Create client-ready deliverables

---

## Market Opportunity

### The Problem

Consulting discovery phases are broken:

| Statistic | Source |
|-----------|--------|
| 39% of projects fail due to poor requirements gathering | Industry studies |
| 50% of projects fail due to poor requirement definitions | McKinsey |
| Discovery phase is "most critical piece to overall success" | Management.org |

### Current Workflow Pain Points

```
Typical Consulting Discovery Flow (Current State)
═══════════════════════════════════════════════════

1. SCHEDULE INTERVIEWS
   └─ Manual calendar coordination
   └─ Email back-and-forth
   └─ No standardization

2. CONDUCT INTERVIEWS
   └─ Take notes manually (or forget to)
   └─ Different consultants = different approaches
   └─ Stakeholders repeat themselves across interviews

3. SYNTHESIZE FINDINGS
   └─ Copy-paste notes into Word/Google Docs
   └─ Manually identify themes
   └─ "Did someone already mention this?"
   └─ Lost context, missing nuance

4. CREATE DELIVERABLES
   └─ Rewrite everything for client
   └─ Hunt for supporting quotes
   └─ SOW based on gut feeling
   └─ Risk identification = consultant experience

5. PRESENT TO CLIENT
   └─ "Let me find that quote..."
   └─ No traceability to source
   └─ Client questions = scramble
```

### Why This Matters

| Pain | Impact | Frequency |
|------|--------|-----------|
| Manual note-taking | Missed insights, poor recall | Every interview |
| No synthesis tool | 2+ weeks to analyze interviews | Every project |
| No traceability | "Who said that?" questions | Every presentation |
| Inconsistent approach | Quality varies by consultant | Ongoing |
| No knowledge reuse | Same mistakes repeated | Firm-wide |

---

## Existing Solutions (Competitive Landscape)

### Stakeholder Management Platforms

| Tool | Focus | Limitation |
|------|-------|------------|
| [Darzin](https://www.darzin.com/) | Stakeholder engagement mapping | No interview analysis |
| [Consultation Manager](https://www.consultationmanager.com/) | Stakeholder tracking | No AI synthesis |
| [Kahootz](https://www.kahootz.com/) | Collaboration, consultation | No voice/interview features |
| [Jambo](https://www.jambo.cloud/) | Community engagement | No project deliverables |
| [OCMS Portal](https://www.ocmsolution.com/) | Change management | Enterprise, complex |

**Gap**: All focused on stakeholder TRACKING, not interview ANALYSIS and SYNTHESIS.

### General Purpose Tools Consultants Use

| Tool | How Used | Limitation |
|------|----------|------------|
| Miro | Workshop facilitation, mapping | No transcription, no AI |
| Notion | Documentation, wikis | Manual synthesis |
| Zoom + Otter | Recording + transcription | No analysis layer |
| Dovetail | Research repository | Not designed for consulting deliverables |
| Google Docs | SOW writing | Everything manual |

**Gap**: Patchwork of tools, no end-to-end solution.

### What Consultants Actually Want

Based on research and discovery phase best practices:

| Need | Current Solution | Ideal Solution |
|------|------------------|----------------|
| Interview multiple stakeholders | Manual scheduling | Automated or guided |
| Capture everything said | Notes + maybe recording | Auto-transcription + AI |
| Identify patterns across interviews | Manual theme hunting | AI-powered synthesis |
| Create unified view | Copy-paste into docs | Automatic aggregation |
| Produce SOW | Start from scratch | AI-drafted from evidence |
| Identify risks | Consultant intuition | AI-surfaced from interviews |
| Trace recommendations to sources | "Trust me" | Click-through to quote |

---

## Why UpSight Could Win This Market

### Natural Fit

Our capabilities map directly to consulting needs:

| Consulting Need | UpSight Capability |
|-----------------|-------------------|
| Interview stakeholders | Voice agent OR human-led |
| Transcribe conversations | LiveKit + transcription |
| Identify themes | Lenses + AI analysis |
| Surface evidence | Evidence extraction |
| Create summaries | AI-generated insights |
| Track to source | Traceability throughout |

### Unique Positioning

**Competitors**: Either stakeholder management OR research analysis (not both)
**UpSight**: Interview → Analyze → Deliver in one platform

### The Consulting-Specific Value Prop

> "From stakeholder interviews to client-ready deliverables in hours, not weeks. Every recommendation traced to what someone actually said."

---

## Target Customers

### Primary: Small-Medium Consulting Practices

| Characteristic | Profile |
|----------------|---------|
| Size | 5-50 consultants |
| Focus | Management consulting, IT consulting, strategy |
| Pain | No budget for enterprise tools, need efficiency |
| Buyer | Managing Partner, Practice Lead |
| Budget | $200-2,000/month for tools |

### Why SMB Consulting?

- **Not served by enterprise tools**: Darzin, Consultation Manager are enterprise-priced
- **High pain, low tooling**: Using Google Docs + Zoom + hoping
- **Multiplier effect**: Good tool = more projects, faster
- **Word of mouth**: Consultants talk to consultants

### Secondary: Freelance/Independent Consultants

| Characteristic | Profile |
|----------------|---------|
| Size | 1-3 people |
| Focus | Specialized consulting, interim management |
| Pain | No time for manual synthesis |
| Buyer | The consultant |
| Budget | $50-200/month |

---

## Consulting-Specific Features Needed

### Must-Have for MVP

| Feature | Why | Exists? |
|---------|-----|---------|
| Multi-stakeholder project | Group interviews by project/client | Yes (projects) |
| Voice/text interviews | Capture stakeholder input | Yes (LiveKit) |
| Auto-transcription | No manual notes | Yes |
| Theme extraction | Identify patterns | Yes (lenses) |
| Evidence linking | Trace to source | Yes |
| Export to docs | Client deliverables | Partial |

### Consulting-Specific Enhancements

| Feature | Value | Exists? |
|---------|-------|---------|
| **SOW Generator** | Draft SOW from interview themes | **No** |
| **Risk Identifier** | Surface risks mentioned by stakeholders | **No** |
| **Stakeholder Matrix** | Who said what, role-based view | **No** |
| **Requirements Extractor** | Pull requirements from conversations | **No** |
| **Executive Summary** | AI-generated project summary | Partial |
| **Client-Ready Export** | Branded PDF/Word output | **No** |
| **Interview Guide Templates** | Discovery question frameworks | **No** |

### Consulting-Specific Lenses to Build

| Lens | Purpose |
|------|---------|
| **Discovery Interview** | Extract requirements, constraints, success criteria |
| **Stakeholder Alignment** | Map positions, concerns, priorities by role |
| **Risk Assessment** | Surface risks, blockers, concerns |
| **Requirements Gathering** | Functional/non-functional requirements |
| **Project Scoping** | Scope, timeline, resource needs |
| **Change Readiness** | Organizational readiness for change |

---

## User Flows for Consulting

### Flow 1: Discovery Project Setup

```
1. Create Project
   └─ Client name
   └─ Project objective (what are we trying to discover?)
   └─ Expected stakeholders (roles, not names yet)

2. Choose Discovery Template
   └─ "IT Strategy Discovery"
   └─ "Digital Transformation Assessment"
   └─ "Process Improvement Analysis"
   └─ Custom

3. Get Interview Guide
   └─ AI-generated questions based on objective
   └─ Customizable by consultant
   └─ Role-specific variants (exec vs. user)
```

### Flow 2: Conducting Stakeholder Interviews

```
1. Start Interview
   └─ Select project
   └─ Enter stakeholder name + role
   └─ Choose: AI-guided OR human-led with AI assist

2. During Interview
   └─ Real-time transcription
   └─ AI suggests follow-up questions
   └─ Key moments auto-flagged
   └─ Consultant can add manual notes

3. After Interview
   └─ Auto-summary generated
   └─ Themes tagged
   └─ Requirements extracted
   └─ Risks flagged
   └─ Added to project synthesis
```

### Flow 3: Cross-Stakeholder Synthesis

```
1. View Project Dashboard
   └─ All interviews listed
   └─ Theme summary across all stakeholders
   └─ Conflict/alignment matrix

2. Explore Themes
   └─ Click theme → see all stakeholders who mentioned it
   └─ Priority ranking (by frequency, by role seniority)
   └─ Evidence trail for each theme

3. Identify Patterns
   └─ "3 of 5 stakeholders mentioned budget concerns"
   └─ "Execs want speed, users want training"
   └─ "Risk: No executive sponsor identified"
```

### Flow 4: Deliverable Generation

```
1. Select Deliverable Type
   └─ Executive Summary
   └─ Detailed Findings Report
   └─ SOW / Proposal
   └─ Risk Assessment
   └─ Requirements Document

2. AI Generates Draft
   └─ Based on all interview data
   └─ Themes structured appropriately
   └─ Evidence linked

3. Consultant Edits
   └─ Refine language
   └─ Add recommendations
   └─ Brand/format for client

4. Export
   └─ PDF, Word, Google Docs
   └─ With or without evidence links
   └─ Client-ready formatting
```

---

## Competitive Differentiation

### vs. Dovetail/Looppanel (Research Platforms)

| Aspect | Dovetail/Looppanel | UpSight for Consulting |
|--------|--------------------|-----------------------|
| Target | UX researchers | Consultants |
| Output | Research insights | Client deliverables (SOW, reports) |
| Structure | Open-ended analysis | Discovery templates |
| Evidence | Research quotes | Stakeholder quotes by role |
| Deliverables | Internal reports | Client-facing documents |

### vs. Stakeholder Management Tools

| Aspect | Darzin/Consultation Manager | UpSight for Consulting |
|--------|-----------------------------|-----------------------|
| Focus | Track stakeholders | Analyze interviews |
| Input | Manual data entry | Voice/text interviews |
| AI | None or minimal | AI synthesis, drafting |
| Output | Stakeholder maps | SOW, requirements, risks |

### vs. General Tools (Miro + Notion + Zoom)

| Aspect | Patchwork | UpSight for Consulting |
|--------|-----------|------------------------|
| Integration | Manual | End-to-end |
| Transcription | Separate tool | Built-in |
| Synthesis | Manual | AI-powered |
| Traceability | None | Full evidence linking |
| Time to deliverable | Days/weeks | Hours |

---

## Risks & Challenges

### Market Risks

| Risk | Mitigation |
|------|------------|
| Consultants are slow to adopt new tools | Start with high-pain freelancers, expand |
| Enterprise consulting has existing tools | Focus on SMB, avoid enterprise initially |
| "We've always done it this way" | Show ROI: time saved = more billable hours |
| Confidentiality concerns | Strong security story, SOC2 path |

### Product Risks

| Risk | Mitigation |
|------|------------|
| SOW generation quality | Human-in-loop, drafts not final |
| Different consulting types need different templates | Start narrow, expand based on feedback |
| Export formatting expectations | Invest in polished output early |

### Execution Risks

| Risk | Mitigation |
|------|------------|
| Dilutes focus from product/sales teams | This IS sales team adjacent (discovery calls) |
| Building consulting-specific features takes time | Start with MVP (templates + export) |
| Pricing for consultants | Per-project or usage-based may work better than per-seat |

---

## Go-to-Market Strategy

### Phase 1: Validate (Month 1-2)

1. **Interview 10 consultants** about their discovery workflow
2. **Build 3 consulting-specific lenses** (Discovery, Risk, Requirements)
3. **Add basic export** (PDF/Word with evidence)
4. **Test with 3-5 friendly consultants**

### Phase 2: Launch (Month 3-4)

1. **Content marketing**: "From Interview to SOW in 4 Hours"
2. **Consultant community outreach**: LinkedIn, consulting forums
3. **Partnership**: One consulting-focused podcast or newsletter
4. **Pricing**: Per-project tier (e.g., $99/project) + subscription

### Phase 3: Expand (Month 5+)

1. **Template library**: Industry-specific discovery templates
2. **SOW generation**: AI-drafted proposals
3. **Client portal**: Stakeholders can review findings
4. **Enterprise features**: Team management, SSO

---

## Pricing Considerations

### Consulting-Friendly Models

| Model | Pros | Cons |
|-------|------|------|
| **Per-project** ($99-299/project) | Matches consulting billing, predictable | Complexity in defining "project" |
| **Per-interview** ($10-20/interview) | Usage-based, fair | Could get expensive |
| **Monthly subscription** ($49-199/mo) | Simple, predictable | May feel expensive for low-volume |
| **Per-seat** ($29-79/user/mo) | Standard SaaS | Consultants hate per-seat |

**Recommendation**: Hybrid model
- Free: 3 interviews/month, basic export
- Pro: $99/month - unlimited interviews, all lenses, PDF export
- Team: $249/month - 5 users, SOW generation, branded exports

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time from interviews to draft deliverable | < 4 hours (vs. 2+ days) |
| Consultant NPS | > 50 |
| Project completion rate | > 80% |
| Repeat usage | 3+ projects per consultant |
| Referral rate | 30% of new users from referral |

---

## Honest Assessment

### Why This Could Work

1. **Clear pain point**: Consultants hate manual synthesis
2. **Measurable ROI**: Hours saved = money saved/earned
3. **Network effects**: Consultants recommend tools to each other
4. **Adjacent to sales**: Discovery calls are similar to sales calls
5. **Our capabilities fit**: Voice + transcription + synthesis + evidence

### Why This Could Fail

1. **Not our core focus**: We're building for product/sales teams
2. **Consulting-specific features needed**: SOW, risk, templates
3. **Different buyer**: Managing partners, not product managers
4. **Customization expectations**: Consultants want bespoke
5. **Small market**: SMB consulting is fragmented

### Key Question

> Do we want to build consulting-specific features, or just market our existing capabilities to consultants?

**Option A**: Market existing features
- Lower investment
- Consultants adapt to our workflows
- May not fully meet needs

**Option B**: Build consulting-specific features
- Higher investment
- Purpose-built experience
- Stronger differentiation

**Recommendation**: Start with Option A (market test), invest in Option B if traction.

---

## Next Steps

1. [ ] Interview 5-10 consultants about discovery workflow
2. [ ] Create "Discovery Interview" lens template
3. [ ] Add Word/PDF export with evidence linking
4. [ ] Test messaging: "Interview to SOW in hours, not weeks"
5. [ ] Evaluate traction before building SOW generator

---

*This is a strategic assessment. Validate with actual consultant feedback before committing resources.*
