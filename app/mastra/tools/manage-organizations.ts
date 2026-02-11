import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase/client.server";
import type { Database } from "../../types";

const organizationSchema = z.object({
	name: z.string().min(1, "Organization name is required"),
	description: z.string().optional().nullable(),
	website_url: z.string().optional().nullable(),
	domain: z.string().optional().nullable(),
	industry: z.string().optional().nullable(),
	size_range: z.string().optional().nullable(),
	company_type: z.string().optional().nullable(),
	headquarters_location: z.string().optional().nullable(),
	phone: z.string().optional().nullable(),
	email: z.string().optional().nullable(),
});

const toolInputSchema = z.object({
	action: z.enum(["create", "update", "delete", "get", "list"]),
	organizationId: z.string().nullish().describe("Required for update, delete, and get actions"),
	accountId: z.string().optional(),
	projectId: z.string().optional(),
	data: organizationSchema.partial().nullish().describe("Organization data for create/update actions"),
});

const toolOutputSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	organization: z
		.object({
			id: z.string(),
			name: z.string(),
			description: z.string().nullable(),
			website_url: z.string().nullable(),
			domain: z.string().nullable(),
			industry: z.string().nullable(),
			size_range: z.string().nullable(),
			company_type: z.string().nullable(),
			headquarters_location: z.string().nullable(),
			phone: z.string().nullable(),
			email: z.string().nullable(),
		})
		.nullable()
		.optional(),
	organizations: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				description: z.string().nullable(),
				industry: z.string().nullable(),
				size_range: z.string().nullable(),
			})
		)
		.optional(),
});

type ToolInput = z.infer<typeof toolInputSchema>;

export const manageOrganizationsTool = createTool({
	id: "manage-organizations",
	description:
		"Create, update, delete, or retrieve organizations. Use this to manage company/organization records in the CRM. Actions: 'create' (new org), 'update' (modify existing), 'delete' (remove org), 'get' (single org by ID), 'list' (all orgs in project).",
	inputSchema: toolInputSchema,
	outputSchema: toolOutputSchema,
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;

		const { action, organizationId, accountId: accountOverride, projectId: projectOverride, data } = input as ToolInput;

		const runtimeAccountId = context?.requestContext?.get?.("account_id") as string | undefined;
		const runtimeProjectId = context?.requestContext?.get?.("project_id") as string | undefined;

		const resolvedAccountId = accountOverride || runtimeAccountId;
		const resolvedProjectId = projectOverride || runtimeProjectId;

		if (!resolvedAccountId || !resolvedProjectId) {
			return {
				success: false,
				message: "Account ID and Project ID are required.",
				organization: null,
			};
		}

		try {
			// GET - Retrieve single organization
			if (action === "get") {
				if (!organizationId) {
					return {
						success: false,
						message: "organizationId is required for get action.",
						organization: null,
					};
				}

				const { data: org, error } = await supabase
					.from("organizations")
					.select("*")
					.eq("id", organizationId)
					.eq("project_id", resolvedProjectId)
					.single();

				if (error || !org) {
					return {
						success: false,
						message: "Organization not found.",
						organization: null,
					};
				}

				return {
					success: true,
					message: "Organization retrieved.",
					organization: org,
				};
			}

			// LIST - Get all organizations in project
			if (action === "list") {
				const { data: orgs, error } = await supabase
					.from("organizations")
					.select("id, name, description, industry, size_range")
					.eq("project_id", resolvedProjectId)
					.order("name", { ascending: true });

				if (error) {
					return {
						success: false,
						message: `Failed to list organizations: ${error.message}`,
						organization: null,
					};
				}

				return {
					success: true,
					message: `Found ${orgs?.length || 0} organizations.`,
					organizations: orgs || [],
				};
			}

			// CREATE - New organization
			if (action === "create") {
				if (!data?.name) {
					return {
						success: false,
						message: "Organization name is required for create action.",
						organization: null,
					};
				}

				const insertData: Database["public"]["Tables"]["organizations"]["Insert"] = {
					account_id: resolvedAccountId,
					project_id: resolvedProjectId,
					name: data.name,
					description: data.description ?? null,
					website_url: data.website_url ?? null,
					domain: data.domain ?? null,
					industry: data.industry ?? null,
					size_range: data.size_range ?? null,
					company_type: data.company_type ?? null,
					headquarters_location: data.headquarters_location ?? null,
					phone: data.phone ?? null,
					email: data.email ?? null,
				};

				const { data: created, error } = await supabase.from("organizations").insert(insertData).select().single();

				if (error) {
					return {
						success: false,
						message: `Failed to create organization: ${error.message}`,
						organization: null,
					};
				}

				return {
					success: true,
					message: `Organization "${created.name}" created successfully.`,
					organization: created,
				};
			}

			// UPDATE - Modify existing organization
			if (action === "update") {
				if (!organizationId) {
					return {
						success: false,
						message: "organizationId is required for update action.",
						organization: null,
					};
				}

				if (!data || Object.keys(data).length === 0) {
					return {
						success: false,
						message: "No data provided for update.",
						organization: null,
					};
				}

				const updateData: Database["public"]["Tables"]["organizations"]["Update"] = {};
				if (data.name !== undefined) updateData.name = data.name;
				if (data.description !== undefined) updateData.description = data.description;
				if (data.website_url !== undefined) updateData.website_url = data.website_url;
				if (data.domain !== undefined) updateData.domain = data.domain;
				if (data.industry !== undefined) updateData.industry = data.industry;
				if (data.size_range !== undefined) updateData.size_range = data.size_range;
				if (data.company_type !== undefined) updateData.company_type = data.company_type;
				if (data.headquarters_location !== undefined) updateData.headquarters_location = data.headquarters_location;
				if (data.phone !== undefined) updateData.phone = data.phone;
				if (data.email !== undefined) updateData.email = data.email;

				const { data: updated, error } = await supabase
					.from("organizations")
					.update(updateData)
					.eq("id", organizationId)
					.eq("project_id", resolvedProjectId)
					.select()
					.single();

				if (error) {
					return {
						success: false,
						message: `Failed to update organization: ${error.message}`,
						organization: null,
					};
				}

				return {
					success: true,
					message: `Organization "${updated.name}" updated successfully.`,
					organization: updated,
				};
			}

			// DELETE - Remove organization
			if (action === "delete") {
				if (!organizationId) {
					return {
						success: false,
						message: "organizationId is required for delete action.",
						organization: null,
					};
				}

				// First get the org name for the response
				const { data: org } = await supabase
					.from("organizations")
					.select("name")
					.eq("id", organizationId)
					.eq("project_id", resolvedProjectId)
					.single();

				const { error } = await supabase
					.from("organizations")
					.delete()
					.eq("id", organizationId)
					.eq("project_id", resolvedProjectId);

				if (error) {
					return {
						success: false,
						message: `Failed to delete organization: ${error.message}`,
						organization: null,
					};
				}

				return {
					success: true,
					message: `Organization "${org?.name || organizationId}" deleted successfully.`,
					organization: null,
				};
			}

			return {
				success: false,
				message: `Unknown action: ${action}`,
				organization: null,
			};
		} catch (error) {
			consola.error("manage-organizations: unexpected failure", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to manage organization.",
				organization: null,
			};
		}
	},
});
