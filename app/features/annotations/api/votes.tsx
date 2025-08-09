import consola from "consola"
import type { ActionFunction, LoaderFunction } from "react-router"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import { type EntityType, getVoteCountsForEntity, removeVote, upsertVote } from "../db"

// GET /api/votes - Fetch vote counts for an entity
export const loader: LoaderFunction = async ({ request, params, context }) => {
	const ctx = context.get(userContext)
	const projectCtx = context.get(currentProjectContext)
	const supabase = ctx.supabase
	const userId = ctx.claims?.sub
	const accountId = ctx.account_id
	const projectId = projectCtx?.projectId || params.projectId

	if (!userId || !accountId) {
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

	try {
		const { data: voteCounts, error } = await getVoteCountsForEntity({
			supabase,
			projectId,
			entityType,
			entityId,
			userId,
		})

		if (error) {
			consola.error("Failed to fetch vote counts:", error)
			return Response.json({ error: { message: "Failed to fetch vote counts" } }, { status: 500 })
		}

		return Response.json({ voteCounts })
	} catch (error) {
		consola.error("Exception in votes loader:", error)
		return Response.json({ error: { message: "Internal server error" } }, { status: 500 })
	}
}

// POST /api/votes - Handle voting actions
export const action: ActionFunction = async ({ context, request, params }) => {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = ctx.account_id
	const userId = ctx.claims?.sub

	const _ctx_project = context.get(currentProjectContext)
	const projectId = _ctx_project?.projectId || params.projectId

	if (!accountId || !projectId || !userId) {
		return Response.json({ error: { message: "Missing authentication context" } }, { status: 401 })
	}

	try {
		const formData = await request.formData()
		const action = formData.get("action") as string

		switch (action) {
			case "upsert-vote": {
				const entityType = formData.get("entityType") as EntityType
				const entityId = formData.get("entityId") as string
				const voteValueStr = formData.get("voteValue") as string

				if (!entityType || !entityId || !voteValueStr) {
					return Response.json({ error: { message: "Missing required fields" } }, { status: 400 })
				}

				const voteValue = Number.parseInt(voteValueStr, 10)
				if (voteValue !== 1 && voteValue !== -1) {
					return Response.json({ error: { message: "Invalid vote value. Must be 1 or -1" } }, { status: 400 })
				}

				const { data: vote, error } = await upsertVote({
					supabase,
					accountId,
					projectId,
					entityType,
					entityId,
					userId,
					voteValue: voteValue as 1 | -1,
				})

				if (error) {
					consola.error("Failed to upsert vote:", error)
					return Response.json({ error: { message: "Failed to save vote" } }, { status: 500 })
				}

				// Return updated vote counts
				const { data: voteCounts, error: countsError } = await getVoteCountsForEntity({
					supabase,
					projectId,
					entityType,
					entityId,
					userId,
				})

				if (countsError) {
					consola.error("Failed to fetch updated vote counts:", countsError)
				}

				return Response.json({ vote, voteCounts })
			}

			case "remove-vote": {
				const entityType = formData.get("entityType") as EntityType
				const entityId = formData.get("entityId") as string

				if (!entityType || !entityId) {
					return Response.json({ error: { message: "Missing required fields" } }, { status: 400 })
				}

				const { error } = await removeVote({
					supabase,
					entityType,
					entityId,
					userId,
				})

				if (error) {
					consola.error("Failed to remove vote:", error)
					return Response.json({ error: { message: "Failed to remove vote" } }, { status: 500 })
				}

				// Return updated vote counts
				const { data: voteCounts, error: countsError } = await getVoteCountsForEntity({
					supabase,
					projectId,
					entityType,
					entityId,
					userId,
				})

				if (countsError) {
					consola.error("Failed to fetch updated vote counts:", countsError)
				}

				return Response.json({ success: true, voteCounts })
			}

			default:
				return Response.json({ error: { message: "Unknown action" } }, { status: 400 })
		}
	} catch (error) {
		consola.error("Exception in votes action:", error)
		return Response.json({ error: { message: "Internal server error" } }, { status: 500 })
	}
}
