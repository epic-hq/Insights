/**
 * API route for conversation lens templates CRUD operations
 *
 * GET: List all available templates
 * POST: Create a new custom template
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"

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

		// Get user-scoped client
		const { client: userDb } = getServerClient(request)

		const formData = await request.formData()
		const intent = formData.get("intent")?.toString()

		switch (intent) {
			case "create": {
				const templateKey = formData.get("template_key")?.toString()
				const templateName = formData.get("template_name")?.toString()
				const summary = formData.get("summary")?.toString()
				const category = formData.get("category")?.toString() || "custom"
				const templateDefinition = formData.get("template_definition")?.toString()
				const accountId = formData.get("account_id")?.toString()

				if (!templateKey || !templateName || !templateDefinition) {
					return Response.json({ ok: false, error: "Missing required fields" }, { status: 400 })
				}

				// Validate template_key format (URL-safe slug)
				if (!/^[a-z0-9-]+$/.test(templateKey)) {
					return Response.json(
						{ ok: false, error: "Template key must be a URL-safe slug (lowercase letters, numbers, hyphens)" },
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

				// Insert template
				const { data: template, error } = await userDb
					.from("conversation_lens_templates")
					.insert({
						template_key: templateKey,
						template_name: templateName,
						summary,
						category,
						template_definition: parsedDefinition,
						is_active: true,
						display_order: 100, // Custom templates go at the end
					})
					.select()
					.single()

				if (error) {
					if (error.code === "23505") {
						return Response.json({ ok: false, error: "A template with this key already exists" }, { status: 409 })
					}
					return Response.json({ ok: false, error: error.message }, { status: 500 })
				}

				return Response.json({
					ok: true,
					template,
					message: "Template created successfully",
				})
			}

			case "update": {
				const templateKey = formData.get("template_key")?.toString()
				const templateName = formData.get("template_name")?.toString()
				const summary = formData.get("summary")?.toString()
				const category = formData.get("category")?.toString()
				const templateDefinition = formData.get("template_definition")?.toString()

				if (!templateKey) {
					return Response.json({ ok: false, error: "Missing template_key" }, { status: 400 })
				}

				const updates: Record<string, any> = {}
				if (templateName) updates.template_name = templateName
				if (summary !== undefined) updates.summary = summary
				if (category) updates.category = category

				if (templateDefinition) {
					try {
						updates.template_definition = JSON.parse(templateDefinition)
					} catch {
						return Response.json({ ok: false, error: "Invalid template_definition JSON" }, { status: 400 })
					}
				}

				const { data: template, error } = await userDb
					.from("conversation_lens_templates")
					.update(updates)
					.eq("template_key", templateKey)
					.select()
					.single()

				if (error) {
					return Response.json({ ok: false, error: error.message }, { status: 500 })
				}

				return Response.json({
					ok: true,
					template,
					message: "Template updated successfully",
				})
			}

			case "delete": {
				const templateKey = formData.get("template_key")?.toString()

				if (!templateKey) {
					return Response.json({ ok: false, error: "Missing template_key" }, { status: 400 })
				}

				// Soft delete by setting is_active = false
				const { error } = await userDb
					.from("conversation_lens_templates")
					.update({ is_active: false })
					.eq("template_key", templateKey)

				if (error) {
					return Response.json({ ok: false, error: error.message }, { status: 500 })
				}

				return Response.json({
					ok: true,
					message: "Template deactivated successfully",
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
