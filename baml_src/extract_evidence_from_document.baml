// ============================================================================
// Extract Evidence from Document - For notes, reports, and unstructured text
// ============================================================================
// Simpler extraction for documents without speaker diarization or timestamps.
// Used for: web research notes, market reports, meeting notes, etc.
// ============================================================================

class DocumentEvidence {
  gist string @description("<=12-word essence; slide-like headline")
  verbatim string @description("Key quote or excerpt (<=50 words)")
  context_summary string? @description("1-2 sentences on why this matters")
  source_section string? @description("Section/heading where this was found")

  // Empathy map facets (optional, high-signal only)
  pains string[]? @description("Obstacles or frustrations mentioned; 0-3 items")
  gains string[]? @description("Desired outcomes or benefits; 0-3 items")
  thinks string[]? @description("Beliefs or assumptions; 0-2 items")
  feels string[]? @description("Emotional signals; 0-2 items")
}

class DocumentExtraction {
  summary string @description("2-3 sentence summary of the entire document")
  evidence DocumentEvidence[] @description("Key evidence units extracted from the document")
  topics string[] @description("Main topics/themes covered (3-7 items)")
}

function ExtractEvidenceFromDocument(
  document_text: string,
  document_title: string?,
  document_type: string,
  max_evidence: int
) -> DocumentExtraction {
  client "CustomGPT5"
  prompt #"
You are an expert research analyst extracting key evidence from documents.

## Task
Extract the most important evidence units from this {{ document_type }} document.
Focus on actionable insights, data points, quotes, and findings.

## Document
{% if document_title %}Title: {{ document_title }}{% endif %}

{{ document_text }}

## Instructions
1. Write a 2-3 sentence summary of the document
2. Extract up to {{ max_evidence }} key evidence units, prioritizing:
   - Specific data points, statistics, or metrics
   - Direct quotes or statements
   - Key findings or conclusions
   - Pain points or challenges mentioned
   - Opportunities or gains identified
3. Identify 3-7 main topics/themes

## Evidence Selection Criteria
- HIGH PRIORITY: Specific numbers, quotes, named entities, actionable insights
- MEDIUM: General observations with supporting context
- SKIP: Generic statements, filler content, obvious facts

## Output
Return JSON matching {{ ctx.output_format }}
"#
}

// Test case
test ExtractEvidenceFromDocument_WebResearch {
  functions [ExtractEvidenceFromDocument]
  args {
    document_text #"
# Web Research: SaaS Pricing Trends 2024

**Search Date:** 12/10/2024
**Results Found:** 5

---

## [The State of SaaS Pricing in 2024](https://example.com/pricing)

**Published:** November 15, 2024 | **Relevance:** 92%

According to a recent survey of 500 SaaS companies, 67% have moved to usage-based pricing models in 2024, up from 45% in 2022. The average price increase was 12% year-over-year. Companies report that usage-based pricing led to 23% higher customer retention compared to flat-rate models.

---

## [Enterprise Software Buying Trends](https://example.com/enterprise)

**Published:** October 2024 | **Relevance:** 88%

Enterprise buyers now require an average of 6.8 stakeholders to approve software purchases, up from 5.4 in 2023. Security compliance (mentioned by 89% of buyers) and integration capabilities (78%) are the top evaluation criteria. Budget cycles have extended by 2-3 months on average.

---

## [SMB Tech Stack Report](https://example.com/smb)

**Published:** September 2024 | **Relevance:** 85%

Small businesses spend an average of $15,000/year on SaaS tools. The most common pain point cited was "too many disconnected tools" (62% of respondents). AI-powered features are now expected by 74% of SMB buyers.
    "#
    document_title "Web Research: SaaS Pricing Trends 2024"
    document_type "web_research"
    max_evidence 10
  }
}
