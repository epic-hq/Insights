// LLM-powered cluster assessment using GPT-4o-mini for cheap, fast classification
// Evaluates cluster coherence and generates high-quality theme metadata

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

interface ClusterFacet {
  id: string
  label: string
  kind_slug: string
}

interface AssessClusterRequest {
  project_id: string
  account_id: string
  cluster_facets: ClusterFacet[]
  evidence_samples?: string[]
  seed_facet_id?: string
}

interface ClusterAssessment {
  coherence_score: number // 0-1
  quality: "high" | "medium" | "low"
  recommended_action: "approve" | "review" | "reject" | "split"
  reasoning: string
  theme: {
    name: string
    category: string
    pain: string | null
    jtbd: string | null
    desired_outcome: string | null
    emotional_response: string | null
    statement: string
    confidence: number // 1-10
  }
  suggested_splits?: {
    name: string
    facet_ids: string[]
  }[]
}

Deno.serve(async (req) => {
  try {
    const {
      project_id,
      account_id,
      cluster_facets,
      evidence_samples = [],
      seed_facet_id,
    }: AssessClusterRequest = await req.json()

    if (!project_id || !account_id || !cluster_facets || cluster_facets.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    console.log(`[assess-cluster] Evaluating cluster with ${cluster_facets.length} facets`)

    // Build classification prompt
    const prompt = buildAssessmentPrompt(cluster_facets, evidence_samples)

    // Call GPT-4o-mini for cheap classification
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Cheap and fast
        messages: [
          {
            role: "system",
            content:
              "You are a UX research analyst expert at identifying coherent user needs themes from research evidence. Return valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, // Low temperature for consistent classification
      }),
    })

    if (!openaiRes.ok) {
      const error = await openaiRes.text()
      console.error(`[assess-cluster] OpenAI API error: ${error}`)
      throw new Error(`OpenAI API error: ${error}`)
    }

    const { choices } = await openaiRes.json()
    const assessment: ClusterAssessment = JSON.parse(choices[0].message.content)

    console.log(
      `[assess-cluster] Assessment: ${assessment.quality} quality, ${assessment.coherence_score} coherence, action: ${assessment.recommended_action}`
    )

    // Return assessment
    return new Response(JSON.stringify({ success: true, assessment }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error(`[assess-cluster] Error:`, err)
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        stack: err.stack,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
})

function buildAssessmentPrompt(facets: ClusterFacet[], evidence: string[]): string {
  // Group facets by kind for better context
  const facetsByKind: Record<string, string[]> = {}
  for (const facet of facets) {
    if (!facetsByKind[facet.kind_slug]) {
      facetsByKind[facet.kind_slug] = []
    }
    facetsByKind[facet.kind_slug].push(facet.label)
  }

  const facetSummary = Object.entries(facetsByKind)
    .map(([kind, labels]) => `${kind}: ${labels.map((l) => `"${l}"`).join(", ")}`)
    .join("\n")

  const evidenceSummary =
    evidence.length > 0 ? `\n\nSample evidence quotes:\n${evidence.map((e) => `- "${e}"`).join("\n")}` : ""

  return `Analyze this cluster of user research evidence facets:

${facetSummary}${evidenceSummary}

Evaluate:
1. **Coherence** (0-1): Do these facets form one unified, coherent theme? Or are they loosely related concepts that should be split?
2. **Quality** (high/medium/low): Is this a valuable, actionable theme worth creating?
3. **Action**:
   - "approve" if coherence >0.8 and quality is high
   - "review" if coherence 0.6-0.8 or quality is medium (needs human judgment)
   - "reject" if coherence <0.6 or quality is low
   - "split" if multiple distinct themes are mixed together

4. **Theme Metadata**: Generate clean, professional metadata:
   - name: Short, clear theme name (3-5 words)
   - category: High-level category (e.g., "Productivity", "Communication", "Cost Concerns")
   - pain: Consolidated pain statement from pain facets (null if no pains)
   - jtbd: Jobs-to-be-done from goal facets (null if no goals)
   - desired_outcome: What users want to achieve
   - emotional_response: Emotional tone (frustrated, anxious, excited, etc.)
   - statement: 1-2 sentence summary of the theme
   - confidence: Your confidence in this assessment (1-10)

**IMPORTANT GUIDELINES:**
- Focus on PATTERNS and COMMON EXPERIENCES across multiple users
- DO NOT mention specific people, names, or individual quotes
- Describe the collective need/pain/goal, not individual cases
- Use general language: "users struggle with..." not "John mentioned..."
- Only reference individuals as examples if absolutely necessary (e.g., "e.g., one user reported...")
- Aim for themes that are broadly applicable and actionable across the user base

5. **Suggested Splits** (only if action is "split"): Break into coherent sub-themes with facet IDs

Return JSON matching this schema:
{
  "coherence_score": 0.85,
  "quality": "high",
  "recommended_action": "approve",
  "reasoning": "Brief explanation of your assessment",
  "theme": {
    "name": "...",
    "category": "...",
    "pain": "..." or null,
    "jtbd": "..." or null,
    "desired_outcome": "...",
    "emotional_response": "...",
    "statement": "...",
    "confidence": 8
  },
  "suggested_splits": [...]  // only if action is "split"
}`
}

/* To invoke:

curl -i --location --request POST 'https://rbginqvgkonnoktrttqv.functions.supabase.co/assess-cluster' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "project_id": "uuid",
    "account_id": "uuid",
    "cluster_facets": [
      {"id": "uuid1", "label": "too many emails", "kind_slug": "pain"},
      {"id": "uuid2", "label": "inbox anxiety", "kind_slug": "pain"},
      {"id": "uuid3", "label": "achieve inbox zero", "kind_slug": "goal"}
    ],
    "evidence_samples": ["I get 200 emails per day", "Email overwhelm is real"]
  }'

*/
