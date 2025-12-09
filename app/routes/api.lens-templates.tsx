/**
 * API route for conversation lens templates CRUD operations
 *
 * GET: List all available templates
 * POST: Create/update/delete custom templates with AI generation support
 *
 * Intents:
 * - generate: Generate a template from natural language description (preview only)
 * - create: Save a generated template
 * - update: Update a custom template (regenerate from description or change visibility)
 * - delete: Soft-delete a custom template
 */

import consola from "consola"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { b } from "~/../baml_client"
import { getServerClient } from "~/lib/supabase/client.server"

/**
 * Generate a URL-safe slug from a template name
 */
function generateTemplateKey(name: string, existingKeys: string[]): string {
	let baseSlug = name
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.substring(0, 50)

	if (!baseSlug) baseSlug = "custom-lens"

	let slug = baseSlug
	let counter = 1
	while (existingKeys.includes(slug)) {
		slug = `${baseSlug}-${counter++}`
	}
	return slug
}

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		// Get authenticated user
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server")
		const claims = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		// Get user-scoped client
		const { client: userDb } = getServerClient(request)

		// Load all active templates
		const { data: templates, error } = await userDb
			.from("conversation_lens_templates")
			.select("*")
			.eq("is_active", true)
			.order("display_order", { ascending: true })

		if (error) {
			return Response.json({ ok: false, error: error.message }, { status: 500 })
		}

		return Response.json({
			ok: true,
			templates: templates || [],
		})
	} catch (error: any) {
		console.error("[lens-templates] Loader error:", error)
		return Response.json(
			{
				ok: false,
				error: error?.message || "Failed to load templates",
			},
			{ status: 500 }
		)
	}
}

export async function action({ request }: ActionFunctionArgs) {
	try {
		// Get authenticated user
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server")
		const claims = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		const userId = claims.sub

		// Get user-scoped client
		const { client: userDb } = getServerClient(request)

		const formData = await request.formData()
		const intent = formData.get("intent")?.toString()

		switch (intent) {
			// Generate template from natural language (preview only, doesn't save)
			case "generate": {
				const description = formData.get("description")?.toString()
				const context = formData.get("context")?.toString()

				if (!description || description.length < 10) {
					return Response.json({ ok: false, error: "Description must be at least 10 characters" }, { status: 400 })
				}

				if (description.length > 1000) {
					return Response.json({ ok: false, error: "Description must be under 1000 characters" }, { status: 400 })
				}

				consola.info("[lens-templates] Generating template from description:", description.substring(0, 100))

				try {
					const generated = await b.GenerateLensTemplate(description, context || null)

					return Response.json({
						ok: true,
						generated: {
							template_name: generated.template_name,
							summary: generated.summary,
							primary_objective: generated.primary_objective,
							template_definition: {
								sections: generated.sections,
								entities: generated.entities,
								recommendations_enabled: generated.recommendations_enabled,
							},
						},
					})
				} catch (err) {
					consola.error("[lens-templates] AI generation failed:", err)
					return Response.json(
						{ ok: false, error: "Failed to generate template. Please try a different description." },
						{ status: 500 }
					)
				}
			}

			// Create a new custom template (from generated or manual)
			case "create": {
				const templateName = formData.get("template_name")?.toString()
				const summary = formData.get("summary")?.toString()
				const primaryObjective = formData.get("primary_objective")?.toString()
				const templateDefinition = formData.get("template_definition")?.toString()
				const accountId = formData.get("account_id")?.toString()
				const nlpSource = formData.get("nlp_source")?.toString()
				const isPublic = formData.get("is_public")?.toString() !== "false"

				if (!templateName || !templateDefinition || !accountId) {
					return Response.json(
						{ ok: false, error: "Missing required fields (template_name, template_definition, account_id)" },
						{ status: 400 }
					)
				}

				// Parse and validate template definition
				let parsedDefinition: any
				try {
					parsedDefinition = JSON.parse(templateDefinition)
				} catch {
					return Response.json({ ok: false, error: "Invalid template_definition JSON" }, { status: 400 })
				}

				// Get existing keys for this account to generate unique slug
				const { data: existing } = await userDb
					.from("conversation_lens_templates")
					.select("template_key")
					.eq("account_id", accountId)

				const existingKeys = (existing || []).map((t) => t.template_key)
				const templateKey = generateTemplateKey(templateName, existingKeys)

				// Insert template
				const { data: template, error } = await userDb
					.from("conversation_lens_templates")
					.insert({
						template_key: templateKey,
						template_name: templateName,
						summary: summary || null,
						primary_objective: primaryObjective || null,
						category: "custom",
						template_definition: parsedDefinition,
						is_active: true,
						display_order: 1000, // Custom templates sort after system
						account_id: accountId,
						created_by: userId,
						is_system: false,
						is_public: isPublic,
						nlp_source: nlpSource || null,
					})
					.select()
					.single()

				if (error) {
					if (error.code === "23505") {
						return Response.json({ ok: false, error: "A template with this key already exists" }, { status: 409 })
					}
					consola.error("[lens-templates] Create error:", error)
					return Response.json({ ok: false, error: error.message }, { status: 500 })
				}

				consola.info("[lens-templates] Created custom template:", template.template_key)

				return Response.json({
					ok: true,
					template,
					message: "Template created successfully",
				})
			}

			// Update a custom template (regenerate, direct update, or change visibility)
			case "update": {
				const templateKey = formData.get("template_key")?.toString()
				const accountId = formData.get("account_id")?.toString()
				const description = formData.get("description")?.toString()
				const isPublicStr = formData.get("is_public")?.toString()
				// Direct updates (from EditLensDialog after regenerating preview)
				const templateName = formData.get("template_name")?.toString()
				const summary = formData.get("summary")?.toString()
				const primaryObjective = formData.get("primary_objective")?.toString()
				const templateDefinition = formData.get("template_definition")?.toString()
				const nlpSource = formData.get("nlp_source")?.toString()

				if (!templateKey || !accountId) {
					return Response.json({ ok: false, error: "Missing template_key or account_id" }, { status: 400 })
				}

				// Verify ownership - RLS handles this but we check explicitly
				const { data: existing, error: fetchError } = await userDb
					.from("conversation_lens_templates")
					.select("*")
					.eq("template_key", templateKey)
					.eq("account_id", accountId)
					.eq("created_by", userId)
					.single()

				if (fetchError || !existing) {
					return Response.json({ ok: false, error: "Template not found or access denied" }, { status: 404 })
				}

				const updates: Record<string, any> = {}

				// Direct template updates (e.g., from EditLensDialog after preview)
				if (templateDefinition) {
					try {
						updates.template_definition = JSON.parse(templateDefinition)
					} catch {
						return Response.json({ ok: false, error: "Invalid template_definition JSON" }, { status: 400 })
					}
				}

				if (templateName) updates.template_name = templateName
				if (summary !== undefined) updates.summary = summary || null
				if (primaryObjective !== undefined) updates.primary_objective = primaryObjective || null
				if (nlpSource !== undefined) updates.nlp_source = nlpSource || null

				// Legacy: Regenerate from description if no direct template updates provided
				if (!templateDefinition && description && description.length >= 10) {
					consola.info("[lens-templates] Regenerating template from description:", description.substring(0, 100))
					try {
						const generated = await b.GenerateLensTemplate(description, null)
						updates.template_name = generated.template_name
						updates.summary = generated.summary
						updates.primary_objective = generated.primary_objective
						updates.template_definition = {
							sections: generated.sections,
							entities: generated.entities,
							recommendations_enabled: generated.recommendations_enabled,
						}
						updates.nlp_source = description
					} catch (err) {
						consola.error("[lens-templates] Regeneration failed:", err)
						return Response.json(
							{ ok: false, error: "Failed to regenerate template. Please try a different description." },
							{ status: 500 }
						)
					}
				}

				// Toggle visibility
				if (isPublicStr !== undefined) {
					updates.is_public = isPublicStr === "true"
				}

				if (Object.keys(updates).length === 0) {
					return Response.json({ ok: false, error: "No updates provided" }, { status: 400 })
				}

				const { data: template, error } = await userDb
					.from("conversation_lens_templates")
					.update(updates)
					.eq("template_key", templateKey)
					.eq("account_id", accountId)
					.select()
					.single()

				if (error) {
					consola.error("[lens-templates] Update error:", error)
					return Response.json({ ok: false, error: error.message }, { status: 500 })
				}

				consola.info("[lens-templates] Updated template:", template.template_key)

				return Response.json({
					ok: true,
					template,
					message: "Template updated successfully",
				})
			}

			// Soft-delete a custom template
			case "delete": {
				const templateKey = formData.get("template_key")?.toString()
				const accountId = formData.get("account_id")?.toString()

				if (!templateKey || !accountId) {
					return Response.json({ ok: false, error: "Missing template_key or account_id" }, { status: 400 })
				}

				// Soft delete by setting is_active = false
				// RLS ensures only creator can update
				const { error } = await userDb
					.from("conversation_lens_templates")
					.update({ is_active: false })
					.eq("template_key", templateKey)
					.eq("account_id", accountId)
					.eq("created_by", userId)

				if (error) {
					consola.error("[lens-templates] Delete error:", error)
					return Response.json({ ok: false, error: error.message }, { status: 500 })
				}

				consola.info("[lens-templates] Soft-deleted template:", templateKey)

				return Response.json({
					ok: true,
					message: "Template deleted successfully",
				})
			}

			default:
				return Response.json({ ok: false, error: "Unknown intent" }, { status: 400 })
		}
	} catch (error: any) {
		console.error("[lens-templates] Action error:", error)
		return Response.json(
			{
				ok: false,
				error: error?.message || "Failed to process request",
			},
			{ status: 500 }
		)
	}
}
