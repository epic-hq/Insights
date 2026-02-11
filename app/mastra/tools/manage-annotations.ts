import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase/client.server";
import type { Database } from "../../types";

/**
 * Comprehensive annotation management tool for Mastra agents
 * Allows creating notes, comments, todos, and AI suggestions on any entity
 *
 * Use Cases:
 * - Adding notes to people, organizations, opportunities
 * - Creating follow-up todos for interviews
 * - AI-generated suggestions for personas
 * - Comments and reactions on insights
 */

const entityTypeEnum = z.enum(["insight", "persona", "opportunity", "interview", "person", "project", "organization"]);
const annotationTypeEnum = z.enum(["comment", "ai_suggestion", "flag", "note", "todo", "reaction"]);

export const manageAnnotationsTool = createTool({
	id: "manage-annotations",
	description: `Manage annotations (notes, comments, todos, AI suggestions) on entities like people, organizations, opportunities, interviews, etc.

IMPORTANT - Natural Language Understanding:
When users say things like "add a note to this person" or "remind me to follow up",
translate to appropriate annotation operations:

Common User Phrases → Annotation Actions:
- "add a note to [person/org/opportunity]" → create note annotation
- "remind me to...", "follow up on..." → create todo annotation
- "mark this as important", "flag this" → create flag annotation
- "leave a comment" → create comment annotation
- "suggest...", "AI recommendation" → create ai_suggestion annotation
- "react with..." → create reaction annotation

Operations:
- create: Create a new annotation on an entity
- update: Update existing annotation content
- list: List all annotations for an entity (filtered by type if specified)
- delete: Delete/archive an annotation

Entity Types Supported:
- person: Individual contacts
- organization: Companies and organizations
- opportunity: Sales/pipeline opportunities
- interview: Customer interviews
- persona: User personas
- insight: Research insights
- project: Projects themselves`,
	inputSchema: z.object({
		projectId: z.string().nullish().describe("Project ID. Defaults to current project in context."),
		accountId: z.string().nullish().describe("Account ID. Defaults to current account in context."),
		operation: z
			.enum(["create", "update", "list", "delete"])
			.describe("Operation to perform: create, update, list, or delete"),

		// Entity reference
		entityType: entityTypeEnum
			.nullish()
			.describe("Type of entity to annotate (person, organization, opportunity, interview, persona, insight, project)"),
		entityId: z.string().nullish().describe("UUID of the entity to annotate"),

		// Annotation details
		annotationType: annotationTypeEnum
			.nullish()
			.describe("Type of annotation: note, comment, todo, ai_suggestion, flag, reaction"),
		content: z.string().nullish().describe("Text content for the annotation (markdown supported)"),
		contentJsonb: z.record(z.string(), z.any()).nullish().describe("Structured JSONB content for complex annotations"),
		metadata: z.record(z.string(), z.any()).nullish().describe("Additional metadata (tags, priorities, etc.)"),

		// Todo-specific
		dueDate: z.string().nullish().describe("Due date for todos (ISO 8601 format)"),

		// Reaction-specific
		reactionType: z.string().nullish().describe("Emoji or reaction identifier (for reaction annotations)"),

		// Update/delete
		annotationId: z.string().nullish().describe("ID of annotation to update/delete"),

		// List filters
		filterByType: annotationTypeEnum.nullish().describe("Filter annotations by type when listing"),
		includeArchived: z.boolean().optional().default(false).describe("Include archived/deleted annotations in list"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		annotation: z
			.object({
				id: z.string(),
				entityType: z.string(),
				entityId: z.string(),
				annotationType: z.string(),
				content: z.string().nullable(),
				contentJsonb: z.record(z.string(), z.any()).nullable(),
				metadata: z.record(z.string(), z.any()).nullable(),
				createdByAi: z.boolean(),
				status: z.string(),
				createdAt: z.string(),
				updatedAt: z.string(),
			})
			.nullable()
			.optional(),
		annotations: z
			.array(
				z.object({
					id: z.string(),
					entityType: z.string(),
					entityId: z.string(),
					annotationType: z.string(),
					content: z.string().nullable(),
					contentJsonb: z.record(z.string(), z.any()).nullable(),
					metadata: z.record(z.string(), z.any()).nullable(),
					createdByAi: z.boolean(),
					status: z.string(),
					createdAt: z.string(),
					updatedAt: z.string(),
					dueDate: z.string().nullable(),
					reactionType: z.string().nullable(),
					resolvedAt: z.string().nullable(),
				})
			)
			.optional(),
	}),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;
		const runtimeProjectId = context?.requestContext?.get?.("project_id");
		const runtimeAccountId = context?.requestContext?.get?.("account_id");

		// Extract tool parameters from input
		const projectId = (input.projectId ?? runtimeProjectId ?? null) as string | null;
		const accountId = (input.accountId ?? runtimeAccountId ?? null) as string | null;
		const operation = input.operation;
		const entityType = input.entityType;
		const entityId = input.entityId;
		const annotationType = input.annotationType;
		const content = input.content;
		const contentJsonb = input.contentJsonb;
		const metadata = input.metadata;
		const dueDate = input.dueDate;
		const reactionType = input.reactionType;
		const annotationId = input.annotationId;
		const filterByType = input.filterByType;
		const includeArchived = input.includeArchived ?? false;

		consola.debug("manage-annotations: execute start", {
			projectId,
			accountId,
			operation,
			entityType,
			entityId,
			annotationType,
			hasContent: !!content,
		});

		if (!projectId) {
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				annotation: null,
			};
		}

		if (!accountId) {
			return {
				success: false,
				message: "Missing accountId. Pass one explicitly or ensure the runtime context sets account_id.",
				annotation: null,
			};
		}

		try {
			// LIST operation - get all annotations for an entity
			if (operation === "list") {
				if (!entityType || !entityId) {
					return {
						success: false,
						message: "List operation requires entityType and entityId",
						annotation: null,
					};
				}

				let query = supabase
					.from("annotations")
					.select("*")
					.eq("project_id", projectId)
					.eq("entity_type", entityType)
					.eq("entity_id", entityId)
					.order("created_at", { ascending: false });

				if (filterByType) {
					query = query.eq("annotation_type", filterByType);
				}

				if (!includeArchived) {
					query = query.eq("status", "active");
				}

				const { data, error } = await query;

				if (error) throw error;

				return {
					success: true,
					message: `Found ${data?.length ?? 0} annotations`,
					annotations: (data ?? []).map((ann) => ({
						id: ann.id,
						entityType: ann.entity_type,
						entityId: ann.entity_id,
						annotationType: ann.annotation_type,
						content: ann.content,
						contentJsonb: ann.content_jsonb as Record<string, any> | null,
						metadata: ann.metadata as Record<string, any> | null,
						createdByAi: ann.created_by_ai ?? false,
						status: ann.status ?? "active",
						createdAt: ann.created_at,
						updatedAt: ann.updated_at,
						dueDate: ann.due_date,
						reactionType: ann.reaction_type,
						resolvedAt: ann.resolved_at,
					})),
				};
			}

			// DELETE operation
			if (operation === "delete") {
				if (!annotationId) {
					return {
						success: false,
						message: "Delete operation requires annotationId",
						annotation: null,
					};
				}

				const { error } = await supabase
					.from("annotations")
					.update({ status: "deleted", updated_at: new Date().toISOString() })
					.eq("id", annotationId)
					.eq("project_id", projectId);

				if (error) throw error;

				return {
					success: true,
					message: `Annotation ${annotationId} deleted`,
					annotation: null,
				};
			}

			// UPDATE operation
			if (operation === "update") {
				if (!annotationId) {
					return {
						success: false,
						message: "Update operation requires annotationId",
						annotation: null,
					};
				}

				const updateData: any = {
					updated_at: new Date().toISOString(),
				};

				if (content !== undefined) updateData.content = content;
				if (contentJsonb !== undefined) updateData.content_jsonb = contentJsonb;
				if (metadata !== undefined) updateData.metadata = metadata;
				if (dueDate !== undefined) updateData.due_date = dueDate;
				if (reactionType !== undefined) updateData.reaction_type = reactionType;

				const { data, error } = await supabase
					.from("annotations")
					.update(updateData)
					.eq("id", annotationId)
					.eq("project_id", projectId)
					.select()
					.single();

				if (error) throw error;

				return {
					success: true,
					message: `Annotation ${annotationId} updated`,
					annotation: {
						id: data.id,
						entityType: data.entity_type,
						entityId: data.entity_id,
						annotationType: data.annotation_type,
						content: data.content,
						contentJsonb: data.content_jsonb as Record<string, any> | null,
						metadata: data.metadata as Record<string, any> | null,
						createdByAi: data.created_by_ai ?? false,
						status: data.status ?? "active",
						createdAt: data.created_at,
						updatedAt: data.updated_at,
					},
				};
			}

			// CREATE operation
			if (operation === "create") {
				if (!entityType || !entityId || !annotationType) {
					return {
						success: false,
						message: "Create operation requires entityType, entityId, and annotationType",
						annotation: null,
					};
				}

				const insertData: any = {
					account_id: accountId,
					project_id: projectId,
					entity_type: entityType,
					entity_id: entityId,
					annotation_type: annotationType,
					content: content || null,
					content_jsonb: contentJsonb || null,
					metadata: metadata || {},
					created_by_ai: true, // Marked as AI-created since it's from Mastra agent
					status: "active",
					due_date: dueDate || null,
					reaction_type: reactionType || null,
				};

				const { data, error } = await supabase.from("annotations").insert(insertData).select().single();

				if (error) throw error;

				return {
					success: true,
					message: `Created ${annotationType} annotation on ${entityType}`,
					annotation: {
						id: data.id,
						entityType: data.entity_type,
						entityId: data.entity_id,
						annotationType: data.annotation_type,
						content: data.content,
						contentJsonb: data.content_jsonb as Record<string, any> | null,
						metadata: data.metadata as Record<string, any> | null,
						createdByAi: data.created_by_ai ?? false,
						status: data.status ?? "active",
						createdAt: data.created_at,
						updatedAt: data.updated_at,
					},
				};
			}

			return {
				success: false,
				message: "Invalid operation",
				annotation: null,
			};
		} catch (error) {
			consola.error("manage-annotations: unexpected error", error);
			return {
				success: false,
				message: `Failed to ${operation} annotation: ${error instanceof Error ? error.message : String(error)}`,
				annotation: null,
			};
		}
	},
});
