/**
 * Index Asset Task
 *
 * Generates embeddings for project_assets to enable semantic search.
 * Handles tables, documents, PDFs and other asset types.
 */

import { schemaTask } from "@trigger.dev/sdk";
import consola from "consola";
import { z } from "zod";
import {
  generateEmbeddingWithBilling,
  systemBillingContext,
} from "~/lib/billing";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

/**
 * Convert table data to searchable text representation
 */
function tableToText(tableData: {
  headers: string[];
  rows: Record<string, unknown>[];
}): string {
  const { headers, rows } = tableData;
  if (!headers?.length || !rows?.length) return "";

  // Include headers
  let text = `Columns: ${headers.join(", ")}\n\n`;

  // Include sample rows (limit to avoid token limits)
  const sampleRows = rows.slice(0, 50);
  for (const row of sampleRows) {
    const rowText = headers.map((h) => `${h}: ${row[h] ?? ""}`).join(", ");
    text += `${rowText}\n`;
  }

  if (rows.length > 50) {
    text += `\n... and ${rows.length - 50} more rows`;
  }

  return text;
}

export const indexAssetTask = schemaTask({
  id: "asset.index",
  schema: z.object({
    assetId: z.string().uuid(),
  }),
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload) => {
    const { assetId } = payload;
    const db = createSupabaseAdminClient();

    consola.info(`[indexAsset] Starting indexing for asset: ${assetId}`);

    // 1. Load the asset
    const { data: asset, error: assetError } = await db
      .from("project_assets")
      .select("*")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    // 2. Build text for embedding based on asset type
    let textToEmbed = `${asset.title || ""}\n${asset.description || ""}\n`;

    if (asset.asset_type === "table" && asset.table_data) {
      // For tables, convert structured data to searchable text
      const tableText = tableToText(
        asset.table_data as {
          headers: string[];
          rows: Record<string, unknown>[];
        },
      );
      textToEmbed += tableText;
    } else if (asset.content_md) {
      // For documents, use markdown content
      textToEmbed += asset.content_md;
    } else if (asset.content_raw) {
      // Fallback to raw content
      textToEmbed += asset.content_raw;
    }

    if (textToEmbed.trim().length < 20) {
      consola.warn(
        `[indexAsset] Asset ${assetId} has insufficient text for embedding`,
      );
      return {
        success: false,
        error: "Insufficient text content",
        assetId,
      };
    }

    consola.info(
      `[indexAsset] Generating embedding for ${asset.asset_type}, text length: ${textToEmbed.length}`,
    );

    // 3. Generate embedding with billing
    const billingCtx = systemBillingContext(
      asset.account_id,
      "embedding_generation",
      asset.project_id,
    );

    const embedding = await generateEmbeddingWithBilling(
      billingCtx,
      textToEmbed,
      {
        idempotencyKey: `asset:${assetId}:embed`,
        resourceType: "project_asset",
        resourceId: assetId,
      },
    );

    if (!embedding) {
      return {
        success: false,
        error: "Embedding generation failed",
        assetId,
      };
    }

    // 4. Update asset with embedding
    const { error: updateError } = await db
      .from("project_assets")
      .update({
        embedding,
        embedding_model: "text-embedding-3-small",
        embedding_generated_at: new Date().toISOString(),
      })
      .eq("id", assetId);

    if (updateError) {
      consola.error("[indexAsset] Failed to save embedding:", updateError);
      throw new Error(`Failed to save embedding: ${updateError.message}`);
    }

    consola.success(`[indexAsset] Indexed asset ${assetId}`);

    return {
      success: true,
      assetId,
      assetType: asset.asset_type,
      textLength: textToEmbed.length,
    };
  },
});
