/**
 * Backfill Asset Embeddings Task
 *
 * Triggers indexAssetTask for all project_assets that don't have embeddings yet.
 * Can be filtered by project_id.
 */

import { schemaTask } from "@trigger.dev/sdk"
import consola from "consola"
import { z } from "zod"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { indexAssetTask } from "./indexAsset"

export const backfillAssetEmbeddingsTask = schemaTask({
	id: "asset.backfill-embeddings",
	schema: z.object({
		projectId: z.string().uuid().optional().describe("Optional: only backfill assets for this project"),
		limit: z.number().int().min(1).max(500).optional().default(100),
	}),
	retry: {
		maxAttempts: 2,
	},
	run: async (payload) => {
		const { projectId, limit } = payload
		const db = createSupabaseAdminClient()

		consola.info(`[backfillAssetEmbeddings] Starting backfill`, { projectId, limit })

		// Find assets without embeddings
		let query = db
			.from("project_assets")
			.select("id, title, asset_type, project_id")
			.is("embedding", null)
			.order("created_at", { ascending: false })
			.limit(limit)

		if (projectId) {
			query = query.eq("project_id", projectId)
		}

		const { data: assets, error } = await query

		if (error) {
			consola.error("[backfillAssetEmbeddings] Query error:", error)
			throw new Error(`Failed to query assets: ${error.message}`)
		}

		if (!assets || assets.length === 0) {
			consola.info("[backfillAssetEmbeddings] No assets found without embeddings")
			return {
				success: true,
				message: "No assets to backfill",
				triggeredCount: 0,
			}
		}

		consola.info(`[backfillAssetEmbeddings] Found ${assets.length} assets to index`)

		// Trigger indexAssetTask for each asset
		const batchResult = await indexAssetTask.batchTrigger(
			assets.map((asset) => ({
				payload: { assetId: asset.id },
			}))
		)

		// batchTrigger returns { batchId, runs } but runs might be under different key
		const triggeredCount = batchResult?.runs?.length ?? assets.length

		consola.success(`[backfillAssetEmbeddings] Triggered ${triggeredCount} index tasks`)

		return {
			success: true,
			triggeredCount,
			assetIds: assets.map((a) => a.id),
			batchId: batchResult?.batchId ?? "unknown",
		}
	},
})
