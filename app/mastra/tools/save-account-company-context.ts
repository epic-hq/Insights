/**
 * Save Account Company Context Tool
 *
 * Saves company context to the accounts.accounts table.
 * Used by agents after researching a company website.
 */

import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase/client.server";
import { resolveAccountId } from "./context-utils";

export const saveAccountCompanyContextTool = createTool({
  id: "saveAccountCompanyContext",
  description: `Save company context to the account after researching a website.
Use this tool AFTER calling researchCompanyWebsite to save the extracted data.

Fields to save:
- website_url: Company website
- company_description: 1-2 sentence description
- customer_problem: The pain point they solve
- offerings: Products/services (array)
- target_orgs: Target organizations/industries (array)
- target_roles: Job titles they sell to (array)
- competitors: Known competitors (array)
- industry: e.g., "B2B SaaS"`,

  inputSchema: z.object({
    account_id: z
      .string()
      .nullish()
      .describe(
        "Account ID to save context to. Use 'current' to use runtime context.",
      ),
    project_id: z
      .string()
      .nullish()
      .describe(
        "Project ID to resolve account from (if account_id not provided).",
      ),
    website_url: z.string().nullish(),
    company_description: z.string().nullish(),
    customer_problem: z.string().nullish(),
    offerings: z.array(z.string()).nullish(),
    target_orgs: z.array(z.string()).nullish(),
    target_roles: z.array(z.string()).nullish(),
    competitors: z.array(z.string()).nullish(),
    industry: z.string().nullish(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
    savedFields: z.array(z.string()).optional(),
  }),

  execute: async (input, context?) => {
    let accountId: string | undefined;

    // 1. Try input.account_id first (agent should pass this)
    if (input.account_id && input.account_id !== "current") {
      accountId = input.account_id;
      consola.info(
        "[saveAccountCompanyContext] Using input account_id:",
        accountId,
      );
    }

    // 2. If we have project_id, resolve account from project
    if (!accountId && input.project_id) {
      try {
        const supabase = supabaseAdmin;
        const { data: project } = await supabase
          .from("projects")
          .select("account_id")
          .eq("id", input.project_id)
          .single();
        if (project?.account_id) {
          accountId = project.account_id;
          consola.info(
            "[saveAccountCompanyContext] Resolved from project:",
            accountId,
          );
        }
      } catch (err) {
        consola.warn(
          "[saveAccountCompanyContext] Failed to resolve from project:",
          err,
        );
      }
    }

    // 3. Fallback to runtime context (unlikely to work but try anyway)
    if (!accountId) {
      try {
        accountId = await resolveAccountId(
          context,
          "saveAccountCompanyContext",
        );
      } catch {
        // Ignore - we'll handle missing accountId below
      }
    }

    if (!accountId) {
      consola.error("[saveAccountCompanyContext] No account_id available");
      return {
        success: false,
        error: "Missing account_id - please provide account_id or project_id",
      };
    }

    // Build update object, only including non-null fields
    const updateData: Record<string, unknown> = {};

    if (input.website_url) updateData.website_url = input.website_url;
    if (input.company_description)
      updateData.company_description = input.company_description;
    if (input.customer_problem)
      updateData.customer_problem = input.customer_problem;
    if (input.offerings) updateData.offerings = input.offerings;
    if (input.target_orgs) updateData.target_orgs = input.target_orgs;
    if (input.target_roles) updateData.target_roles = input.target_roles;
    if (input.competitors) updateData.competitors = input.competitors;
    if (input.industry) updateData.industry = input.industry;

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "No fields to update" };
    }

    consola.info(
      "[saveAccountCompanyContext] Saving to account:",
      accountId,
      Object.keys(updateData),
    );

    try {
      const { error } = await supabaseAdmin
        .schema("accounts")
        .from("accounts")
        .update(updateData)
        .eq("id", accountId);

      if (error) {
        consola.error("[saveAccountCompanyContext] Supabase error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, savedFields: Object.keys(updateData) };
    } catch (err) {
      consola.error("[saveAccountCompanyContext] Error:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
});
