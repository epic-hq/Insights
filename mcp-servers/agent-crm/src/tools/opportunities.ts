/**
 * Opportunity CRUD tools for AgentCRM MCP server.
 * Manages sales pipeline / deal records.
 */
import { getSupabase, resolveContext, validateUUID } from "../supabase.js";

export const opportunityTools = [
  {
    name: "list_opportunities",
    description:
      "List opportunities/deals in the CRM pipeline. Supports filtering by stage, kanban status, search, and pagination.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
        search: {
          type: "string",
          description:
            "Case-insensitive search on title and description",
        },
        stage: {
          type: "string",
          description:
            "Filter by sales stage (e.g. Discovery, Proposal, Negotiation, Closed Won)",
        },
        kanban_status: {
          type: "string",
          description:
            "Filter by kanban column (e.g. Explore, Validate, Build)",
        },
        limit: {
          type: "number",
          description: "Max results (1-100, default 50)",
        },
        offset: {
          type: "number",
          description: "Pagination offset (default 0)",
        },
      },
    },
  },
  {
    name: "get_opportunity",
    description:
      "Get detailed information about a specific opportunity including linked organization and contact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        opportunity_id: {
          type: "string",
          description: "UUID of the opportunity",
        },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["opportunity_id"],
    },
  },
  {
    name: "create_opportunity",
    description:
      "Create a new opportunity/deal in the CRM pipeline. Provide at least a title. Optionally link to an organization and/or contact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Opportunity title (required)" },
        description: {
          type: "string",
          description: "Deal summary or context",
        },
        kanban_status: {
          type: "string",
          description:
            "Pipeline column (default: Explore). Common values: Explore, Validate, Build",
        },
        stage: {
          type: "string",
          description:
            "Sales stage (e.g. Discovery, Qualification, Proposal, Negotiation, Closed Won, Closed Lost)",
        },
        status: {
          type: "string",
          description: "Health/status label (e.g. On Track, At Risk, Stalled)",
        },
        amount: {
          type: "number",
          description: "Deal value in dollars",
        },
        currency: {
          type: "string",
          description: "Currency code (default: USD)",
        },
        close_date: {
          type: "string",
          description: "Expected close date (ISO 8601, e.g. 2025-06-30)",
        },
        confidence: {
          type: "number",
          description: "Win probability 0-1 (e.g. 0.75 = 75%)",
        },
        next_step: {
          type: "string",
          description: "Next action to take",
        },
        next_step_due: {
          type: "string",
          description: "Due date for next step (ISO 8601)",
        },
        source: {
          type: "string",
          description: "Lead source (e.g. Referral, Website, Conference)",
        },
        organization_id: {
          type: "string",
          description: "UUID of the linked organization",
        },
        primary_contact_id: {
          type: "string",
          description: "UUID of the primary contact person",
        },
        owner_id: {
          type: "string",
          description: "User ID of the deal owner",
        },
        metadata: {
          type: "object",
          description: "Additional structured metadata (JSON)",
        },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_opportunity",
    description:
      "Update an existing opportunity's fields. Only provided fields are modified.",
    inputSchema: {
      type: "object" as const,
      properties: {
        opportunity_id: {
          type: "string",
          description: "UUID of the opportunity to update (required)",
        },
        title: { type: "string", description: "Updated title" },
        description: { type: "string", description: "Updated description" },
        kanban_status: { type: "string", description: "Updated kanban column" },
        stage: { type: "string", description: "Updated sales stage" },
        status: { type: "string", description: "Updated status" },
        amount: { type: "number", description: "Updated deal value" },
        currency: { type: "string", description: "Updated currency" },
        close_date: { type: "string", description: "Updated close date" },
        confidence: { type: "number", description: "Updated win probability" },
        next_step: { type: "string", description: "Updated next action" },
        next_step_due: {
          type: "string",
          description: "Updated next step due date",
        },
        source: { type: "string", description: "Updated source" },
        organization_id: {
          type: "string",
          description: "Updated organization link",
        },
        primary_contact_id: {
          type: "string",
          description: "Updated primary contact",
        },
        owner_id: { type: "string", description: "Updated deal owner" },
        metadata: {
          type: "object",
          description: "Updated metadata (merges with existing)",
        },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["opportunity_id"],
    },
  },
  {
    name: "delete_opportunity",
    description:
      "Delete an opportunity from the CRM. Requires the opportunity title for confirmation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        opportunity_id: {
          type: "string",
          description: "UUID of the opportunity to delete",
        },
        confirm_title: {
          type: "string",
          description:
            "Opportunity title for safety confirmation (must match, case-insensitive)",
        },
        dry_run: {
          type: "boolean",
          description: "Preview deletion without executing (default: false)",
        },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["opportunity_id", "confirm_title"],
    },
  },
];

export async function handleOpportunityTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const supabase = getSupabase();
  const { accountId, projectId } = resolveContext(args);

  switch (name) {
    case "list_opportunities": {
      const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 100);
      const offset = Math.max(Number(args.offset) || 0, 0);

      let query = supabase
        .from("opportunities")
        .select(
          "id, title, description, kanban_status, stage, status, amount, currency, close_date, confidence, next_step, source, organization_id, primary_contact_id, owner_id, created_at, updated_at",
          { count: "exact" }
        )
        .eq("account_id", accountId)
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const search = args.search as string | undefined;
      if (search) {
        query = query.or(
          `title.ilike.%${search}%,description.ilike.%${search}%`
        );
      }

      const stage = args.stage as string | undefined;
      if (stage) {
        query = query.eq("stage", stage);
      }

      const kanbanStatus = args.kanban_status as string | undefined;
      if (kanbanStatus) {
        query = query.eq("kanban_status", kanbanStatus);
      }

      const { data, error, count } = await query;
      if (error)
        throw new Error(`list_opportunities failed: ${error.message}`);

      // Resolve org names
      const orgIds = [
        ...new Set(
          (data || []).map((o) => o.organization_id).filter(Boolean)
        ),
      ];
      let orgMap: Record<string, string> = {};
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, name")
          .in("id", orgIds);
        if (orgs) {
          orgMap = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
        }
      }

      return {
        success: true,
        total: count,
        offset,
        limit,
        opportunities: (data || []).map((o) => ({
          ...o,
          organization_name: o.organization_id
            ? orgMap[o.organization_id] || null
            : null,
        })),
      };
    }

    case "get_opportunity": {
      const oppId = validateUUID(
        args.opportunity_id as string,
        "opportunity_id"
      );

      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", oppId)
        .eq("account_id", accountId)
        .single();

      if (error)
        throw new Error(`get_opportunity failed: ${error.message}`);

      // Resolve org
      let organization = null;
      if (data.organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("id, name, industry, website_url")
          .eq("id", data.organization_id)
          .single();
        organization = org;
      }

      // Resolve contact
      let primaryContact = null;
      if (data.primary_contact_id) {
        const { data: contact } = await supabase
          .from("people")
          .select("id, name, title, primary_email")
          .eq("id", data.primary_contact_id)
          .single();
        primaryContact = contact;
      }

      return {
        success: true,
        opportunity: data,
        organization,
        primary_contact: primaryContact,
      };
    }

    case "create_opportunity": {
      const title = args.title as string;
      if (!title?.trim()) throw new Error("title is required");

      const insertData: Record<string, unknown> = {
        title: title.trim(),
        account_id: accountId,
        project_id: projectId,
        kanban_status: (args.kanban_status as string) || "Explore",
      };

      const optionalFields = [
        "description",
        "stage",
        "status",
        "amount",
        "currency",
        "close_date",
        "confidence",
        "next_step",
        "next_step_due",
        "source",
        "organization_id",
        "primary_contact_id",
        "owner_id",
      ];

      for (const field of optionalFields) {
        if (args[field] !== undefined) {
          insertData[field] = args[field];
        }
      }

      if (args.metadata) {
        insertData.metadata = args.metadata;
      }

      const { data, error } = await supabase
        .from("opportunities")
        .insert(insertData)
        .select()
        .single();

      if (error)
        throw new Error(`create_opportunity failed: ${error.message}`);

      return {
        success: true,
        message: `Created opportunity: ${data.title}`,
        opportunity: data,
      };
    }

    case "update_opportunity": {
      const oppId = validateUUID(
        args.opportunity_id as string,
        "opportunity_id"
      );

      const updateFields: Record<string, unknown> = {};
      const fields = [
        "title",
        "description",
        "kanban_status",
        "stage",
        "status",
        "amount",
        "currency",
        "close_date",
        "confidence",
        "next_step",
        "next_step_due",
        "source",
        "organization_id",
        "primary_contact_id",
        "owner_id",
      ];

      for (const field of fields) {
        if (args[field] !== undefined) {
          updateFields[field] = args[field];
        }
      }

      // Merge metadata if provided
      if (args.metadata) {
        const { data: existing } = await supabase
          .from("opportunities")
          .select("metadata")
          .eq("id", oppId)
          .single();

        updateFields.metadata = {
          ...((existing?.metadata as Record<string, unknown>) || {}),
          ...(args.metadata as Record<string, unknown>),
        };
      }

      if (Object.keys(updateFields).length === 0) {
        return { success: false, message: "No fields to update" };
      }

      const { data, error } = await supabase
        .from("opportunities")
        .update(updateFields)
        .eq("id", oppId)
        .eq("account_id", accountId)
        .select()
        .single();

      if (error)
        throw new Error(`update_opportunity failed: ${error.message}`);

      return {
        success: true,
        message: `Updated opportunity: ${data.title}`,
        updated_fields: Object.keys(updateFields),
        opportunity: data,
      };
    }

    case "delete_opportunity": {
      const oppId = validateUUID(
        args.opportunity_id as string,
        "opportunity_id"
      );
      const confirmTitle = args.confirm_title as string;
      const dryRun = args.dry_run === true;

      const { data: opp, error } = await supabase
        .from("opportunities")
        .select("id, title")
        .eq("id", oppId)
        .eq("account_id", accountId)
        .single();

      if (error || !opp) {
        throw new Error(`Opportunity not found: ${oppId}`);
      }

      if (
        opp.title?.toLowerCase().trim() !==
        confirmTitle?.toLowerCase().trim()
      ) {
        return {
          success: false,
          message: `Title confirmation failed. Expected "${opp.title}", got "${confirmTitle}".`,
        };
      }

      if (dryRun) {
        return {
          success: true,
          dry_run: true,
          message: `Would delete opportunity: "${opp.title}"`,
        };
      }

      const { error: delError } = await supabase
        .from("opportunities")
        .delete()
        .eq("id", oppId)
        .eq("account_id", accountId)
        .eq("project_id", projectId);

      if (delError)
        throw new Error(`delete_opportunity failed: ${delError.message}`);

      return {
        success: true,
        message: `Deleted opportunity: ${opp.title}`,
      };
    }

    default:
      throw new Error(`Unknown opportunity tool: ${name}`);
  }
}
