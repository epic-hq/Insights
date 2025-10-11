import consola from "consola"
import type { ActionFunction, LoaderFunction } from "react-router"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import { type EntityType, type FlagType, getUserFlagsForEntity, setEntityFlag } from "../db"

// GET /api/entity-flags - Fetch user flags for an entity
export const loader: LoaderFunction = async ({ context, request, params }) => {
	const ctx = context.get(userContext)
	const _projectCtx = context.get(currentProjectContext)
	const supabase = ctx.supabase
	const userId = ctx.claims?.sub
	const _accountId = params?.accountId
	const projectId = params?.projectId

	if (!userId) {
		return Response.json({ error: { message: "Missing user context" } }, { status: 401 })
	}

	if (!projectId) {
		return Response.json({ error: { message: "Missing project context" } }, { status: 400 })
	}

	const url = new URL(request.url)
	const entityType = url.searchParams.get("entityType") as EntityType
	const entityId = url.searchParams.get("entityId")

	if (!entityType || !entityId) {
		return Response.json({ error: { message: "Missing entityType or entityId" } }, { status: 400 })
	}

	// consola.log("getentity-flags", {
	// 	accountId,
	// 	projectId,
	// 	entityType,
	// 	entityId,
	// 	userId,
	// })
	try {
		const { data: flags, error } = await getUserFlagsForEntity({
			supabase,
			entityType,
			entityId,
			userId,
			projectId,
		})

		if (error) {
			consola.error("Failed to fetch user flags:", error)
			return Response.json({ error: { message: "Failed to fetch flags" } }, { status: 500 })
		}

		return Response.json({ flags })
	} catch (error) {
		consola.error("Exception in entity-flags loader:", error)
		return Response.json({ error: { message: "Internal server error" } }, { status: 500 })
	}
}

// POST /api/entity-flags - Handle flag actions
export const action: ActionFunction = async ({ context, request }) => {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = ctx.account_id
	const userId = ctx.claims?.sub

	const ctx_project = context.get(currentProjectContext)
	const projectId = ctx_project.projectId

	if (!accountId || !projectId || !userId) {
		return Response.json({ error: { message: "Missing authentication context" } }, { status: 401 })
	}

	try {
		const formData = await request.formData()
		const action = formData.get("action") as string

		switch (action) {
			case "set-flag": {
				const entityType = formData.get("entityType") as EntityType
				const entityId = formData.get("entityId") as string
				const flagType = formData.get("flagType") as FlagType
				const flagValueStr = formData.get("flagValue") as string
				const metadataStr = formData.get("metadata") as string

				if (!entityType || !entityId || !flagType || !flagValueStr) {
					return Response.json({ error: { message: "Missing required fields" } }, { status: 400 })
				}

				const flagValue = flagValueStr === "true"

				let metadata = {}
				try {
					if (metadataStr) {
						metadata = JSON.parse(metadataStr)
					}
				} catch (_e) {
					consola.warn("Invalid metadata JSON:", metadataStr)
				}

				const { data: flag, error } = await setEntityFlag({
					supabase,
					accountId,
					projectId,
					entityType,
					entityId,
					userId,
					flagType,
					flagValue,
					metadata,
				})

				if (error) {
					consola.error("Failed to set entity flag:", error)
					return Response.json({ error: { message: "Failed to set flag" } }, { status: 500 })
				}

				// Return updated flags
				const { data: flags, error: flagsError } = await getUserFlagsForEntity({
					supabase,
					entityType,
					entityId,
					userId,
					projectId,
				})

				if (flagsError) {
					consola.error("Failed to fetch updated flags:", flagsError)
				}

				return Response.json({ flag, flags })
			}

			default:
				return Response.json({ error: { message: "Unknown action" } }, { status: 400 })
		}
	} catch (error) {
		consola.error("Exception in entity-flags action:", error)
		return Response.json({ error: { message: "Internal server error" } }, { status: 500 })
	}
}
