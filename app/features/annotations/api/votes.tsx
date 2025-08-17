import consola from "consola"
import type { ActionFunction, LoaderFunction } from "react-router"
import { getServerClient } from "~/lib/supabase/server"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import { type EntityType, getVoteCountsForEntities, getVoteCountsForEntity, removeVote, upsertVote } from "../db"

// GET /api/votes - Fetch vote counts for an entity
export const loader: LoaderFunction = async ({ request, params, context }) => {
	// Try to use context if available; otherwise construct our own server client
	let supabase = context?.get?.(userContext)?.supabase as ReturnType<typeof getServerClient>["client"] | undefined
	let userId: string | undefined = context?.get?.(userContext)?.claims?.sub
	const projectCtx = context?.get?.(currentProjectContext)
	let projectId: string | undefined = projectCtx?.projectId || params.projectId

	if (!supabase) {
		const server = getServerClient(request)
		supabase = server.client
	}

	if (!projectId) {
		const { pathname } = new URL(request.url)
		// Expect path like /a/:accountId/:projectId/...
		const parts = pathname.split("/").filter(Boolean)
		const idx = parts.indexOf("a")
		if (idx >= 0 && parts.length >= idx + 3) {
			projectId = parts[idx + 2]
		}
	}

	if (!projectId) {
		return Response.json({ error: { message: "Missing project context" } }, { status: 400 })
	}

	// Claims are optional for GET; fetch locally if not provided (no network due to SSR settings)
	if (!userId) {
		try {
			const { data: claims } = await supabase!.auth.getClaims()
			userId = (claims?.claims as any)?.sub
		} catch {}
	}

	const url = new URL(request.url)
	const entityType = url.searchParams.get("entityType") as EntityType
	const singleEntityId = url.searchParams.get("entityId")

	// Collect potential batched IDs from repeated entityId params and/or a CSV entityIds param
	const repeatedIds = url.searchParams.getAll("entityId").filter(Boolean) as string[]
	const csvParam = url.searchParams.get("entityIds") || ""
	const csvIds = csvParam
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0)

	const entityIds = Array.from(new Set([...(repeatedIds || []), ...(csvIds || [])]))

	if (!entityType) {
		return Response.json({ error: { message: "Missing entityType" } }, { status: 400 })
	}

	try {
		// Batched path
		if (entityIds.length > 1 || (entityIds.length === 1 && !singleEntityId)) {
			const { data, error } = await getVoteCountsForEntities({
				supabase,
				projectId,
				entityType,
				entityIds,
				userId,
			})

			if (error) {
				consola.error("Failed to fetch batched vote counts:", error)
				return Response.json({ error: { message: "Failed to fetch vote counts" } }, { status: 500 })
			}

			return Response.json({ voteCountsById: data })
		}

		// Single-entity fallback for full backward compatibility
		const entityId = singleEntityId || entityIds[0]
		if (!entityId) {
			return Response.json({ error: { message: "Missing entityId" } }, { status: 400 })
		}

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
	// Build client regardless of middleware
	const server = getServerClient(request)
	const supabase = server.client
	let userId: string | undefined = context?.get?.(userContext)?.claims?.sub
	let accountId: string | undefined = context?.get?.(userContext)?.account_id

	let projectId: string | undefined = context?.get?.(currentProjectContext)?.projectId || params.projectId
	if (!projectId) {
		const { pathname } = new URL(request.url)
		const parts = pathname.split("/").filter(Boolean)
		const idx = parts.indexOf("a")
		if (idx >= 0 && parts.length >= idx + 3) {
			projectId = parts[idx + 2]
		}
	}

	try {
		if (!userId || !accountId) {
			const { data: claims } = await supabase.auth.getClaims()
			const c = claims?.claims as any
			userId = userId || c?.sub
			accountId = accountId || c?.sub
		}
	} catch {}

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
