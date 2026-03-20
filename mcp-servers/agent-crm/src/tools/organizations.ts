/**
 * Organization CRUD tools for AgentCRM MCP server.
 * Manages company/organization records.
 */
import { getSupabase, resolveContext, validateUUID } from "../supabase.js";

export const organizationTools = [
  {
    name: "list_organizations",
    description:
      "List organizations/companies in the CRM. Supports name search and pagination.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
        search: {
          type: "string",
          description: "Case-insensitive search on name, industry, or domain",
        },
        limit: {
          type: "number",
          description: "Max results (1-200, default 50)",
        },
        offset: {
          type: "number",
          description: "Pagination offset (default 0)",
        },
      },
    },
  },
  {
    name: "get_organization",
    description:
      "Get detailed information about a specific organization. Returns all fields including contacts count, industry, size, and metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        organization_id: {
          type: "string",
          description: "UUID of the organization",
        },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
        include_contacts: {
          type: "boolean",
          description:
            "If true, includes people linked to this organization (default: false)",
        },
      },
      required: ["organization_id"],
    },
  },
  {
    name: "create_organization",
    description:
      "Create a new organization/company in the CRM. At minimum, provide a name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Organization name (required)" },
        description: { type: "string", description: "About the organization" },
        website_url: { type: "string", description: "Company website URL" },
        domain: {
          type: "string",
          description: "Email domain (e.g. acme.com)",
        },
        industry: {
          type: "string",
          description: "Industry (e.g. SaaS, Healthcare, Fintech)",
        },
        size_range: {
          type: "string",
          description:
            "Company size range (e.g. 1-10, 11-50, 51-200, 201-1000, 1000+)",
        },
        company_type: {
          type: "string",
          description:
            "Type (e.g. startup, enterprise, agency, non-profit, government)",
        },
        headquarters_location: {
          type: "string",
          description: "HQ location (city, state, country)",
        },
        phone: { type: "string", description: "Main phone number" },
        email: { type: "string", description: "General contact email" },
        linkedin_url: {
          type: "string",
          description: "LinkedIn company page URL",
        },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_organization",
    description:
      "Update an existing organization's fields. Only provided fields are modified.",
    inputSchema: {
      type: "object" as const,
      properties: {
        organization_id: {
          type: "string",
          description: "UUID of the organization to update (required)",
        },
        name: { type: "string", description: "Updated name" },
        description: { type: "string", description: "Updated description" },
        website_url: { type: "string", description: "Updated website" },
        domain: { type: "string", description: "Updated domain" },
        industry: { type: "string", description: "Updated industry" },
        size_range: { type: "string", description: "Updated size range" },
        company_type: { type: "string", description: "Updated company type" },
        headquarters_location: {
          type: "string",
          description: "Updated HQ location",
        },
        phone: { type: "string", description: "Updated phone" },
        email: { type: "string", description: "Updated email" },
        linkedin_url: { type: "string", description: "Updated LinkedIn URL" },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["organization_id"],
    },
  },
  {
    name: "delete_organization",
    description:
      "Delete an organization from the CRM. Use dry_run=true to preview impacts. Unlinks people but does not delete them.",
    inputSchema: {
      type: "object" as const,
      properties: {
        organization_id: {
          type: "string",
          description: "UUID of the organization to delete",
        },
        confirm_name: {
          type: "string",
          description:
            "Organization name for safety confirmation (must match, case-insensitive)",
        },
        dry_run: {
          type: "boolean",
          description: "Preview deletion without executing (default: false)",
        },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["organization_id", "confirm_name"],
    },
  },
];

export async function handleOrganizationTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const supabase = getSupabase();
  const { accountId, projectId } = resolveContext(args);

  switch (name) {
    case "list_organizations": {
      const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);
      const offset = Math.max(Number(args.offset) || 0, 0);
      const search = args.search as string | undefined;

      let query = supabase
        .from("organizations")
        .select(
          "id, name, description, industry, size_range, company_type, headquarters_location, website_url, domain, created_at, updated_at",
          { count: "exact" }
        )
        .eq("account_id", accountId)
        .eq("project_id", projectId)
        .order("name", { ascending: true })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,industry.ilike.%${search}%,domain.ilike.%${search}%`
        );
      }

      const { data, error, count } = await query;
      if (error)
        throw new Error(`list_organizations failed: ${error.message}`);

      return {
        success: true,
        total: count,
        offset,
        limit,
        organizations: data || [],
      };
    }

    case "get_organization": {
      const orgId = validateUUID(
        args.organization_id as string,
        "organization_id"
      );

      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .eq("account_id", accountId)
        .single();

      if (error)
        throw new Error(`get_organization failed: ${error.message}`);

      let contacts = null;
      if (args.include_contacts) {
        const { data: links } = await supabase
          .from("people_organizations")
          .select(
            "person_id, job_title, relationship_status, is_primary"
          )
          .eq("organization_id", orgId);

        if (links && links.length > 0) {
          const personIds = links.map((l) => l.person_id);
          const { data: people } = await supabase
            .from("people")
            .select("id, name, title, primary_email, role")
            .in("id", personIds);

          contacts = (people || []).map((p) => {
            const link = links.find((l) => l.person_id === p.id);
            return {
              ...p,
              job_title: link?.job_title,
              relationship_status: link?.relationship_status,
              is_primary: link?.is_primary,
            };
          });
        }
      }

      return {
        success: true,
        organization: data,
        ...(contacts !== null && { contacts }),
      };
    }

    case "create_organization": {
      const name = args.name as string;
      if (!name?.trim()) throw new Error("name is required");

      const insertData: Record<string, unknown> = {
        name: name.trim(),
        account_id: accountId,
        project_id: projectId,
      };

      const optionalFields = [
        "description",
        "website_url",
        "domain",
        "industry",
        "size_range",
        "company_type",
        "headquarters_location",
        "phone",
        "email",
        "linkedin_url",
      ];

      for (const field of optionalFields) {
        if (args[field] !== undefined) {
          insertData[field] = args[field];
        }
      }

      const { data, error } = await supabase
        .from("organizations")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          const { data: existing } = await supabase
            .from("organizations")
            .select("id, name")
            .eq("account_id", accountId)
            .ilike("name", name.trim())
            .limit(1)
            .single();

          return {
            success: false,
            message: "Organization with this name already exists",
            existing_organization: existing,
          };
        }
        throw new Error(`create_organization failed: ${error.message}`);
      }

      return {
        success: true,
        message: `Created organization: ${data.name}`,
        organization: data,
      };
    }

    case "update_organization": {
      const orgId = validateUUID(
        args.organization_id as string,
        "organization_id"
      );

      const updateFields: Record<string, unknown> = {};
      const fields = [
        "name",
        "description",
        "website_url",
        "domain",
        "industry",
        "size_range",
        "company_type",
        "headquarters_location",
        "phone",
        "email",
        "linkedin_url",
      ];

      for (const field of fields) {
        if (args[field] !== undefined) {
          updateFields[field] = args[field];
        }
      }

      if (Object.keys(updateFields).length === 0) {
        return { success: false, message: "No fields to update" };
      }

      const { data, error } = await supabase
        .from("organizations")
        .update(updateFields)
        .eq("id", orgId)
        .eq("account_id", accountId)
        .select()
        .single();

      if (error)
        throw new Error(`update_organization failed: ${error.message}`);

      return {
        success: true,
        message: `Updated organization: ${data.name}`,
        updated_fields: Object.keys(updateFields),
        organization: data,
      };
    }

    case "delete_organization": {
      const orgId = validateUUID(
        args.organization_id as string,
        "organization_id"
      );
      const confirmName = args.confirm_name as string;
      const dryRun = args.dry_run === true;

      // Fetch org
      const { data: org, error } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", orgId)
        .eq("account_id", accountId)
        .single();

      if (error || !org) {
        throw new Error(`Organization not found: ${orgId}`);
      }

      // Name check
      if (org.name?.toLowerCase().trim() !== confirmName?.toLowerCase().trim()) {
        return {
          success: false,
          message: `Name confirmation failed. Expected "${org.name}", got "${confirmName}".`,
        };
      }

      // Count linked people
      const { count: linkedPeopleCount } = await supabase
        .from("people_organizations")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId);

      // Count people with this as default org
      const { count: defaultOrgCount } = await supabase
        .from("people")
        .select("*", { count: "exact", head: true })
        .eq("default_organization_id", orgId);

      // Count linked opportunities
      const { count: linkedOppsCount } = await supabase
        .from("opportunities")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId);

      if (dryRun) {
        return {
          success: true,
          dry_run: true,
          message: `Would delete "${org.name}"`,
          linked_people: linkedPeopleCount || 0,
          people_with_default_org: defaultOrgCount || 0,
          linked_opportunities: linkedOppsCount || 0,
        };
      }

      // Unlink people
      await supabase
        .from("people_organizations")
        .delete()
        .eq("organization_id", orgId);

      // Clear default_organization_id for people
      await supabase
        .from("people")
        .update({ default_organization_id: null })
        .eq("default_organization_id", orgId);

      // Unlink opportunities
      await supabase
        .from("opportunities")
        .update({ organization_id: null })
        .eq("organization_id", orgId);

      // Delete org
      const { error: delError } = await supabase
        .from("organizations")
        .delete()
        .eq("id", orgId)
        .eq("account_id", accountId);

      if (delError)
        throw new Error(`delete_organization failed: ${delError.message}`);

      return {
        success: true,
        message: `Deleted organization: ${org.name}`,
        unlinked_people: linkedPeopleCount || 0,
        unlinked_opportunities: linkedOppsCount || 0,
      };
    }

    default:
      throw new Error(`Unknown organization tool: ${name}`);
  }
}
