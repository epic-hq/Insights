// Edge function to generate embeddings for evidence facets (pains, gains, etc.)
// Triggered by database when facet label is inserted/updated

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface EmbedFacetRequest {
  facet_id: string;
  label: string;
  quote?: string; // For survey_response, this is the answer; for others, this is additional context
  kind_slug: string; // pain, gain, job, survey_response, etc.
}

Deno.serve(async (req) => {
  try {
    // Parse request body
    const { facet_id, label, quote, kind_slug }: EmbedFacetRequest =
      await req.json();

    if (!facet_id || !label) {
      return new Response(
        JSON.stringify({ error: "Missing facet_id or label" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Build embedding input: for survey_response and other facets with quotes,
    // embed both the question (label) and answer (quote) for semantic search
    const embeddingInput = quote ? `${label}\n${quote}` : label;

    console.log(
      `[embed-facet] Generating embedding for ${kind_slug}: "${label}"${quote ? ` (with quote)` : ""}`,
    );

    // Generate embedding using OpenAI text-embedding-3-small
    const openaiRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: embeddingInput,
        dimensions: 1536, // Explicitly request 1536 dimensions
      }),
    });

    if (!openaiRes.ok) {
      const error = await openaiRes.text();
      console.error(`[embed-facet] OpenAI API error: ${error}`);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const { data } = await openaiRes.json();
    const embedding: number[] = data[0].embedding;

    console.log(
      `[embed-facet] Generated embedding with ${embedding.length} dimensions`,
    );

    // Update evidence_facet with the embedding
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { error: updateError } = await supabase
      .from("evidence_facet")
      .update({
        embedding: embedding,
        embedding_model: "text-embedding-3-small",
        embedding_generated_at: new Date().toISOString(),
      })
      .eq("id", facet_id);

    if (updateError) {
      console.error(`[embed-facet] Database update error:`, updateError);
      throw updateError;
    }

    console.log(`[embed-facet] Successfully updated facet ${facet_id}`);

    return new Response(
      JSON.stringify({ success: true, facet_id, dimensions: embedding.length }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(`[embed-facet] Error:`, err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        stack: err.stack,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});

/* To invoke locally:

  1. Run `supabase start`
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/embed-facet' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"facet_id":"some-uuid","label":"difficulty finding time","kind_slug":"pain"}'

*/
