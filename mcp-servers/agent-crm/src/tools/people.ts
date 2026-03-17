/**
 * People CRUD tools for AgentCRM MCP server.
 * Manages contact records: create, read, update, delete, search.
 */
import { getSupabase, resolveContext, validateUUID } from "../supabase.js";

// ---------------------------------------------------------------------------
// Tool Definitions (JSON Schema for MCP)
// ---------------------------------------------------------------------------

export const peopleTools = [
  {
    name: "list_people",
    description:
      "List people/contacts in the CRM. Supports name search and pagination. Returns id, name, title, company, email, segment, and timestamps.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account_id: {
          type: "string",
          description: "Account ID (uses default if not provided)",
        },
        project_id: {
          type: "string",
          description: "Project ID (uses default if not provided)",
        },
        search: {
          type: "string",
          description:
            "Case-insensitive search across name, title, and company fields",
        },
        limit: {
          type: "number",
          description: "Max results to return (1-200, default 50)",
        },
        offset: {
          type: "number",
          description: "Number of records to skip for pagination (default 0)",
        },
      },
    },
  },
  {
    name: "get_person",
    description:
      "Get detailed information about a specific person by ID. Returns full profile including contact info, demographics, organization, and metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        person_id: {
          type: "string",
          description: "UUID of the person to retrieve",
        },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["person_id"],
    },
  },
  {
    name: "create_person",
    description:
      "Create a new person/contact in the CRM. Provide at least a name. Optionally link to an organization by name (auto-created if it doesn't exist). Returns the created person record.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Full name of the person (required)",
        },
        title: { type: "string", description: "Job title" },
        role: { type: "string", description: "Role or position" },
        company: {
          type: "string",
          description:
            "Company/organization name. Auto-creates the org if it doesn't exist and links the person to it.",
        },
        primary_email: { type: "string", description: "Email address" },
        primary_phone: { type: "string", description: "Phone number" },
        linkedin_url: { type: "string", description: "LinkedIn profile URL" },
        website_url: { type: "string", description: "Personal website URL" },
        location: {
          type: "string",
          description: "City, state, or full address",
        },
        timezone: {
          type: "string",
          description: "IANA timezone (e.g. America/New_York)",
        },
        segment: {
          type: "string",
          description: "Customer segment (e.g. enterprise, mid-market, SMB)",
        },
        industry: { type: "string", description: "Industry" },
        lifecycle_stage: {
          type: "string",
          description:
            "Lifecycle stage (e.g. lead, prospect, customer, churned)",
        },
        description: {
          type: "string",
          description: "Notes or description about this person",
        },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_person",
    description:
      "Update an existing person's fields. Only provided fields are modified; omitted fields remain unchanged.",
    inputSchema: {
      type: "object" as const,
      properties: {
        person_id: {
          type: "string",
          description: "UUID of the person to update (required)",
        },
        name: { type: "string", description: "Updated full name" },
        title: { type: "string", description: "Updated job title" },
        role: { type: "string", description: "Updated role" },
        company: {
          type: "string",
          description:
            "Updated company name. Auto-creates and links the org.",
        },
        primary_email: { type: "string", description: "Updated email" },
        primary_phone: { type: "string", description: "Updated phone" },
        linkedin_url: { type: "string", description: "Updated LinkedIn URL" },
        website_url: { type: "string", description: "Updated website URL" },
        location: { type: "string", description: "Updated location" },
        timezone: { type: "string", description: "Updated timezone" },
        segment: { type: "string", description: "Updated segment" },
        industry: { type: "string", description: "Updated industry" },
        lifecycle_stage: {
          type: "string",
          description: "Updated lifecycle stage",
        },
        description: { type: "string", description: "Updated notes" },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["person_id"],
    },
  },
  {
    name: "delete_person",
    description:
      "Delete a person from the CRM. Requires the person's name for confirmation. Use dry_run=true to preview what will be deleted without actually deleting. Removes junction records (project links, org links, persona assignments) but does NOT delete interviews.",
    inputSchema: {
      type: "object" as const,
      properties: {
        person_id: {
          type: "string",
          description: "UUID of the person to delete",
        },
        confirm_name: {
          type: "string",
          description:
            "Person's name for safety confirmation (must match, case-insensitive)",
        },
        dry_run: {
          type: "boolean",
          description:
            "If true, shows what would be deleted without actually deleting (default: false)",
        },
        force: {
          type: "boolean",
          description:
            "If true, proceed even if linked interviews exist (default: false)",
        },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["person_id", "confirm_name"],
    },
  },
  {
    name: "search_people",
    description:
      "Search people by name, email, title, or company. Uses case-insensitive substring matching across multiple fields. More flexible than list_people's simple name search.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query — matches against name, title, email, and company",
        },
        limit: {
          type: "number",
          description: "Max results (1-100, default 25)",
        },
        account_id: { type: "string", description: "Account ID" },
        project_id: { type: "string", description: "Project ID" },
      },
      required: ["query"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool Handlers
// ---------------------------------------------------------------------------

export async function handlePeopleTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const supabase = getSupabase();
  const { accountId, projectId } = resolveContext(args);

  switch (name) {
    case "list_people": {
      const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);
      const offset = Math.max(Number(args.offset) || 0, 0);
      const search = args.search as string | undefined;

      let query = supabase
        .from("people")
        .select(
          "id, name, title, role, primary_email, primary_phone, segment, lifecycle_stage, location, created_at, updated_at, default_organization_id",
          { count: "exact" }
        )
        .eq("account_id", accountId)
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,title.ilike.%${search}%,primary_email.ilike.%${search}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw new Error(`list_people failed: ${error.message}`);

      // Fetch org names for default orgs
      const orgIds = [
        ...new Set(
          (data || [])
            .map((p) => p.default_organization_id)
            .filter(Boolean)
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
        people: (data || []).map((p) => ({
          ...p,
          company: p.default_organization_id
            ? orgMap[p.default_organization_id] || null
            : null,
        })),
      };
    }

    case "get_person": {
      const personId = validateUUID(args.person_id as string, "person_id");

      const { data, error } = await supabase
        .from("people")
        .select("*")
        .eq("id", personId)
        .eq("account_id", accountId)
        .single();

      if (error) throw new Error(`get_person failed: ${error.message}`);

      // Get org info
      let organization = null;
      if (data.default_organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("id, name, industry, website_url, size_range")
          .eq("id", data.default_organization_id)
          .single();
        organization = org;
      }

      return { success: true, person: { ...data, organization } };
    }

    case "create_person": {
      const name = args.name as string;
      if (!name?.trim()) throw new Error("name is required");

      // Parse name into first/last
      const parts = name.trim().split(/\s+/);
      const firstname = parts[0] || null;
      const lastname = parts.length > 1 ? parts.slice(1).join(" ") : null;

      // Handle company → organization linking
      let defaultOrgId: string | null = null;
      const company = args.company as string | undefined;
      if (company?.trim()) {
        defaultOrgId = await ensureOrganization(
          supabase,
          company.trim(),
          accountId,
          projectId
        );
      }

      const { data, error } = await supabase
        .from("people")
        .insert({
          name: name.trim(),
          firstname,
          lastname,
          title: (args.title as string) || null,
          role: (args.role as string) || null,
          primary_email: (args.primary_email as string) || null,
          primary_phone: (args.primary_phone as string) || null,
          linkedin_url: (args.linkedin_url as string) || null,
          website_url: (args.website_url as string) || null,
          location: (args.location as string) || null,
          timezone: (args.timezone as string) || null,
          segment: (args.segment as string) || null,
          industry: (args.industry as string) || null,
          lifecycle_stage: (args.lifecycle_stage as string) || null,
          description: (args.description as string) || null,
          default_organization_id: defaultOrgId,
          account_id: accountId,
          project_id: projectId,
        })
        .select()
        .single();

      if (error) {
        // Handle duplicate — try to find existing
        if (error.code === "23505") {
          const { data: existing } = await supabase
            .from("people")
            .select("id, name, primary_email")
            .eq("account_id", accountId)
            .eq("project_id", projectId)
            .ilike("name", name.trim())
            .limit(1)
            .single();

          return {
            success: false,
            message: "Person with this name already exists",
            existing_person: existing,
          };
        }
        throw new Error(`create_person failed: ${error.message}`);
      }

      // Link to project
      await supabase
        .from("project_people")
        .upsert(
          {
            project_id: projectId,
            person_id: data.id,
            account_id: accountId,
          },
          { onConflict: "project_id,person_id" }
        );

      // Link to org if applicable
      if (defaultOrgId) {
        await supabase
          .from("people_organizations")
          .upsert(
            {
              person_id: data.id,
              organization_id: defaultOrgId,
              account_id: accountId,
              project_id: projectId,
              is_primary: true,
            },
            { onConflict: "person_id,organization_id" }
          );
      }

      return {
        success: true,
        message: `Created person: ${data.name}`,
        person: data,
      };
    }

    case "update_person": {
      const personId = validateUUID(args.person_id as string, "person_id");

      const updateFields: Record<string, unknown> = {};
      const fieldMap: Record<string, string> = {
        name: "name",
        title: "title",
        role: "role",
        primary_email: "primary_email",
        primary_phone: "primary_phone",
        linkedin_url: "linkedin_url",
        website_url: "website_url",
        location: "location",
        timezone: "timezone",
        segment: "segment",
        industry: "industry",
        lifecycle_stage: "lifecycle_stage",
        description: "description",
      };

      for (const [argKey, dbKey] of Object.entries(fieldMap)) {
        if (args[argKey] !== undefined) {
          updateFields[dbKey] = args[argKey];
        }
      }

      // Update first/last name if name changed
      if (updateFields.name) {
        const parts = (updateFields.name as string).trim().split(/\s+/);
        updateFields.firstname = parts[0] || null;
        updateFields.lastname =
          parts.length > 1 ? parts.slice(1).join(" ") : null;
      }

      // Handle company change
      const company = args.company as string | undefined;
      if (company?.trim()) {
        const orgId = await ensureOrganization(
          supabase,
          company.trim(),
          accountId,
          projectId
        );
        updateFields.default_organization_id = orgId;

        await supabase
          .from("people_organizations")
          .upsert(
            {
              person_id: personId,
              organization_id: orgId,
              account_id: accountId,
              project_id: projectId,
              is_primary: true,
            },
            { onConflict: "person_id,organization_id" }
          );
      }

      if (Object.keys(updateFields).length === 0) {
        return { success: false, message: "No fields to update" };
      }

      const { data, error } = await supabase
        .from("people")
        .update(updateFields)
        .eq("id", personId)
        .eq("account_id", accountId)
        .select()
        .single();

      if (error) throw new Error(`update_person failed: ${error.message}`);

      return {
        success: true,
        message: `Updated person: ${data.name}`,
        updated_fields: Object.keys(updateFields),
        person: data,
      };
    }

    case "delete_person": {
      const personId = validateUUID(args.person_id as string, "person_id");
      const confirmName = args.confirm_name as string;
      const dryRun = args.dry_run === true;
      const force = args.force === true;

      // Fetch person
      const { data: person, error } = await supabase
        .from("people")
        .select("id, name")
        .eq("id", personId)
        .eq("account_id", accountId)
        .single();

      if (error || !person) {
        throw new Error(`Person not found: ${personId}`);
      }

      // Name confirmation check
      if (
        person.name?.toLowerCase().trim() !==
        confirmName?.toLowerCase().trim()
      ) {
        return {
          success: false,
          message: `Name confirmation failed. Expected "${person.name}", got "${confirmName}".`,
        };
      }

      // Check linked interviews
      const { data: linkedInterviews } = await supabase
        .from("interview_people")
        .select("interview_id")
        .eq("person_id", personId);

      const linkedCount = linkedInterviews?.length || 0;

      // Count junction records
      const counts: Record<string, number> = {};
      for (const table of [
        "project_people",
        "people_organizations",
        "people_personas",
      ]) {
        const { count } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("person_id", personId);
        counts[table] = count || 0;
      }

      if (dryRun) {
        return {
          success: true,
          dry_run: true,
          message: `Would delete "${person.name}" and ${Object.values(counts).reduce((a, b) => a + b, 0)} junction records`,
          linked_interviews: linkedCount,
          junction_counts: counts,
        };
      }

      if (linkedCount > 0 && !force) {
        return {
          success: false,
          message: `Person "${person.name}" has ${linkedCount} linked interview(s). Set force=true to proceed.`,
          linked_interviews: linkedCount,
        };
      }

      // Delete junction records first
      for (const table of [
        "interview_people",
        "project_people",
        "people_organizations",
        "people_personas",
      ]) {
        await supabase.from(table).delete().eq("person_id", personId);
      }

      // Delete person
      const { error: delError } = await supabase
        .from("people")
        .delete()
        .eq("id", personId)
        .eq("account_id", accountId);

      if (delError) throw new Error(`delete_person failed: ${delError.message}`);

      return {
        success: true,
        message: `Deleted person: ${person.name}`,
        deleted_junctions: counts,
      };
    }

    case "search_people": {
      const query = args.query as string;
      if (!query?.trim()) throw new Error("query is required");
      const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100);

      const searchTerm = `%${query.trim()}%`;

      const { data, error } = await supabase
        .from("people")
        .select(
          "id, name, title, role, primary_email, segment, location, default_organization_id"
        )
        .eq("account_id", accountId)
        .eq("project_id", projectId)
        .or(
          `name.ilike.${searchTerm},title.ilike.${searchTerm},primary_email.ilike.${searchTerm},role.ilike.${searchTerm}`
        )
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(`search_people failed: ${error.message}`);

      // Get org names
      const orgIds = [
        ...new Set(
          (data || []).map((p) => p.default_organization_id).filter(Boolean)
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
        query: query.trim(),
        total: data?.length || 0,
        people: (data || []).map((p) => ({
          ...p,
          company: p.default_organization_id
            ? orgMap[p.default_organization_id] || null
            : null,
        })),
      };
    }

    default:
      throw new Error(`Unknown people tool: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureOrganization(
  supabase: ReturnType<typeof getSupabase>,
  name: string,
  accountId: string,
  projectId: string
): Promise<string> {
  // Try to find existing
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("account_id", accountId)
    .ilike("name", name)
    .limit(1)
    .single();

  if (existing) return existing.id;

  // Create new
  const { data: created, error } = await supabase
    .from("organizations")
    .insert({
      name,
      account_id: accountId,
      project_id: projectId,
    })
    .select("id")
    .single();

  if (error) {
    // Race condition — try find again
    if (error.code === "23505") {
      const { data: found } = await supabase
        .from("organizations")
        .select("id")
        .eq("account_id", accountId)
        .ilike("name", name)
        .limit(1)
        .single();
      if (found) return found.id;
    }
    throw new Error(`Failed to create organization "${name}": ${error.message}`);
  }

  return created.id;
}
