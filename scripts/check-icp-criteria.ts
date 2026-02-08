import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const accountId = "d7b69d5e-a952-41a6-931f-e2fed1d82e85";
const projectId = "6dbcbb68-0662-4ebc-9f84-dd13b8ff758d";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkICPCriteria() {
  // Get account-level ICP criteria
  const { data: account, error: accountError } = await supabase
    .schema("accounts")
    .from("accounts")
    .select("target_orgs, target_roles, target_company_sizes")
    .eq("id", accountId)
    .single();

  console.log("\n📋 Account-Level ICP Criteria:\n");
  console.log("Target Organizations:", account?.target_orgs || "(not set)");
  console.log("Target Roles:", account?.target_roles || "(not set)");
  console.log(
    "Target Company Sizes:",
    account?.target_company_sizes || "(not set)",
  );

  // Get project-level overrides
  const { data: sections } = await supabase
    .from("project_sections")
    .select("kind, meta")
    .eq("project_id", projectId)
    .in("kind", ["target_orgs", "target_roles", "target_company_sizes"]);

  console.log("\n📋 Project-Level ICP Overrides:\n");
  sections?.forEach((s) => {
    console.log(`${s.kind}:`, s.meta);
  });

  if (!sections || sections.length === 0) {
    console.log("(no project-level overrides)");
  }

  console.log("\n");
}

checkICPCriteria();
