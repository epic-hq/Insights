import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * DEPRECATED: This edge function is no longer used.
 * The analysis_jobs table was removed in migration 20251202150000_consolidate_analysis_jobs.sql
 * Workflow state is now managed in interviews.conversation_analysis JSONB column
 * and orchestrated via Trigger.dev v2 orchestrator (src/trigger/interview/v2/orchestrator.ts)
 *
 * This file is kept for historical reference only.
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error:
        "This edge function is deprecated. Use Trigger.dev v2 orchestrator instead.",
      message:
        "The analysis_jobs table was consolidated into interviews.conversation_analysis. Processing is now handled by src/trigger/interview/v2/orchestrator.ts",
    }),
    {
      status: 410, // Gone
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
