import consola from "consola"
import type { ActionFunction, LoaderFunction } from "react-router"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import {
	type AnnotationType,
	createAnnotation,
	deleteAnnotation,
	type EntityType,
	getAnnotationsForEntity,
	updateAnnotation,
} from "../db"

// GET /api/annotations - Fetch annotations for an entity
export const loader: LoaderFunction = async ({ context, request, params }) => {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const ctx_project = context.get(currentProjectContext)
	const accountId = ctx_project.accountId ?? params?.accountId ?? ctx.account_id
	const projectId = ctx_project.projectId ?? params?.projectId ?? null

	if (!accountId || !projectId) {
		return Response.json({ error: { message: "Missing account or project context" } }, { status: 400 })
	}

	const url = new URL(request.url)
	const entityType = url.searchParams.get("entityType") as EntityType
	const entityId = url.searchParams.get("entityId")
	const annotationType = url.searchParams.get("annotationType") as AnnotationType | undefined
	const includeThreads = url.searchParams.get("includeThreads") === "true"

	if (!entityType || !entityId) {
		return Response.json({ error: { message: "Missing entityType or entityId" } }, { status: 400 })
	}

	try {
		const { data: annotations, error } = await getAnnotationsForEntity({
			supabase,
			accountId,
			projectId,
			entityType,
			entityId,
			annotationType,
			includeThreads,
		})

		if (error) {
			consola.error("Failed to fetch annotations:", error)
			return Response.json({ error: { message: "Failed to fetch annotations" } }, { status: 500 })
		}

		return Response.json({ annotations })
	} catch (error) {
		consola.error("Exception in annotations loader:", error)
		return Response.json({ error: { message: "Internal server error" } }, { status: 500 })
	}
}

// POST /api/annotations - Handle annotation actions
export const action: ActionFunction = async ({ context, request, params }) => {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const userId = ctx.claims?.sub

	const ctx_project = context.get(currentProjectContext)
	const accountId = ctx_project.accountId ?? params?.accountId ?? ctx.account_id
	const projectId = ctx_project.projectId ?? params?.projectId ?? null

	if (!accountId || !projectId || !userId) {
		return Response.json({ error: { message: "Missing authentication context" } }, { status: 401 })
	}

	try {
		const formData = await request.formData()
		const action = formData.get("action") as string

		switch (action) {
			case "add-comment": {
				const entityType = formData.get("entityType") as EntityType
				const entityId = formData.get("entityId") as string
				const content = formData.get("content") as string
				const contentJsonbStr = formData.get("contentJsonb") as string | undefined
				const parentId = formData.get("parentId") as string | undefined

				if (!entityType || !entityId || !content?.trim()) {
					return Response.json({ error: { message: "Missing required fields" } }, { status: 400 })
				}

				// Parse contentJsonb if provided (for mentions, etc.)
				let contentJsonb: Record<string, unknown> | undefined
				if (contentJsonbStr) {
					try {
						contentJsonb = JSON.parse(contentJsonbStr)
					} catch (_e) {
						consola.warn("Invalid contentJsonb JSON:", contentJsonbStr)
					}
				}

				const { data: annotation, error } = await createAnnotation({
					supabase,
					accountId,
					projectId,
					entityType,
					entityId,
					annotationType: "comment",
					content: content.trim(),
					contentJsonb,
					parentAnnotationId: parentId,
					threadRootId: parentId, // For now, use parent as thread root
					createdByUserId: userId,
				})

				if (error) {
					consola.error("Failed to create comment:", error)
					return Response.json({ error: { message: "Failed to create comment" } }, { status: 500 })
				}

				return Response.json({ annotation })
			}

			case "add-ai-suggestion": {
				const entityType = formData.get("entityType") as EntityType
				const entityId = formData.get("entityId") as string
				const content = formData.get("content") as string
				const metadataStr = formData.get("metadata") as string

				if (!entityType || !entityId || !content?.trim()) {
					return Response.json({ error: { message: "Missing required fields" } }, { status: 400 })
				}

				let metadata = {}
				try {
					if (metadataStr) {
						metadata = JSON.parse(metadataStr)
					}
				} catch (_e) {
					consola.warn("Invalid metadata JSON:", metadataStr)
				}

				const { data: annotation, error } = await createAnnotation({
					supabase,
					accountId,
					projectId,
					entityType,
					entityId,
					annotationType: "ai_suggestion",
					content: content.trim(),
					metadata,
					createdByAi: true,
					aiModel: "gpt-4", // TODO: Make this configurable
					createdByUserId: userId,
				})

				if (error) {
					consola.error("Failed to create AI suggestion:", error)
					return Response.json({ error: { message: "Failed to create AI suggestion" } }, { status: 500 })
				}

				return Response.json({ annotation })
			}

			case "update-annotation": {
				const annotationId = formData.get("annotationId") as string
				const updatesStr = formData.get("updates") as string

				if (!annotationId || !updatesStr) {
					return Response.json({ error: { message: "Missing required fields" } }, { status: 400 })
				}

				let updates = {}
				try {
					updates = JSON.parse(updatesStr)
				} catch (_e) {
					return Response.json({ error: { message: "Invalid updates JSON" } }, { status: 400 })
				}

				const { data: annotation, error } = await updateAnnotation({
					supabase,
					annotationId,
					updates,
				})

				if (error) {
					consola.error("Failed to update annotation:", error)
					return Response.json({ error: { message: "Failed to update annotation" } }, { status: 500 })
				}

				return Response.json({ annotation })
			}

			case "delete-annotation": {
				const annotationId = formData.get("annotationId") as string

				if (!annotationId) {
					return Response.json({ error: { message: "Missing annotation ID" } }, { status: 400 })
				}

				const { error } = await deleteAnnotation({
					supabase,
					annotationId,
				})

				if (error) {
					consola.error("Failed to delete annotation:", error)
					return Response.json({ error: { message: "Failed to delete annotation" } }, { status: 500 })
				}

				return Response.json({ success: true })
			}

			default:
				return Response.json({ error: { message: "Unknown action" } }, { status: 400 })
		}
	} catch (error) {
		consola.error("Exception in annotations action:", error)
		return Response.json({ error: { message: "Internal server error" } }, { status: 500 })
	}
}
