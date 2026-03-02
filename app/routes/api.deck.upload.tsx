/**
 * API endpoint to upload a slide deck (HTML + assets) to R2 for public sharing.
 * Accepts multipart form data with:
 *   - html: the HTML file
 *   - assets: one or more asset files (images, etc.)
 *   - title: optional deck title
 *
 * Returns a shareable URL at /deck/:token
 */
import { extname } from "node:path";
import consola from "consola";
import { nanoid } from "nanoid";
import type { ActionFunctionArgs } from "react-router";
import { userContext } from "~/server/user-context";
import { getR2PublicUrl, uploadToR2 } from "~/utils/r2.server";

/** Content types for common asset extensions */
const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html",
	".css": "text/css",
	".js": "application/javascript",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".webp": "image/webp",
	".mp4": "video/mp4",
	".webm": "video/webm",
};

function getContentType(filename: string): string {
	const ext = extname(filename).toLowerCase();
	return CONTENT_TYPES[ext] || "application/octet-stream";
}

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const ctx = context.get(userContext);
	if (!ctx.supabase) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const formData = await request.formData();
		const htmlFile = formData.get("html") as File | null;
		const assetsDir = formData.get("assetsDir") as string | null;

		if (!htmlFile) {
			return Response.json({ error: "Missing html file" }, { status: 400 });
		}

		const token = nanoid(12);
		const deckPrefix = `decks/${token}`;

		// Read the HTML content
		let htmlContent = await htmlFile.text();

		// If an assets directory path is provided, upload all files from it
		// and rewrite references in the HTML
		if (assetsDir) {
			const assetFiles = formData.getAll("assetFiles") as File[];

			for (const assetFile of assetFiles) {
				const assetName = assetFile.name;
				const assetKey = `${deckPrefix}/assets/${assetName}`;
				const assetBytes = new Uint8Array(await assetFile.arrayBuffer());

				const result = await uploadToR2({
					key: assetKey,
					body: assetBytes,
					contentType: getContentType(assetName),
				});

				if (!result.success) {
					consola.warn("[deck.upload] Failed to upload asset", {
						assetName,
						error: "error" in result ? result.error : undefined,
					});
					continue;
				}

				// Rewrite asset references in HTML to use CDN URL
				const cdnUrl = getR2PublicUrl(assetKey);
				if (cdnUrl) {
					// Replace relative references like "iwd-assets/file.jpg" or "./assets/file.jpg"
					const escapedName = assetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
					const pattern = new RegExp(`(?:(?:[\\w-]+/)*${escapedName})`, "g");
					htmlContent = htmlContent.replace(pattern, cdnUrl);
				}
			}
		}

		// Also handle inline asset files sent directly in the form
		const inlineAssets = formData.getAll("asset") as File[];
		for (const assetFile of inlineAssets) {
			const assetName = assetFile.name;
			const assetKey = `${deckPrefix}/assets/${assetName}`;
			const assetBytes = new Uint8Array(await assetFile.arrayBuffer());

			const result = await uploadToR2({
				key: assetKey,
				body: assetBytes,
				contentType: getContentType(assetName),
			});

			if (!result.success) {
				consola.warn("[deck.upload] Failed to upload inline asset", {
					assetName,
				});
				continue;
			}

			const cdnUrl = getR2PublicUrl(assetKey);
			if (cdnUrl) {
				const escapedName = assetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const pattern = new RegExp(`(?:(?:[\\w-]+/)*${escapedName})`, "g");
				htmlContent = htmlContent.replace(pattern, cdnUrl);
			}
		}

		// Upload the HTML file
		const htmlBytes = new TextEncoder().encode(htmlContent);
		const htmlResult = await uploadToR2({
			key: `${deckPrefix}/index.html`,
			body: htmlBytes,
			contentType: "text/html",
		});

		if (!htmlResult.success) {
			consola.error("[deck.upload] Failed to upload HTML", {
				error: "error" in htmlResult ? htmlResult.error : undefined,
			});
			return Response.json({ error: "Failed to upload deck" }, { status: 500 });
		}

		const host = process.env.HOST || "https://getupsight.com";
		const shareUrl = `${host}/deck/${token}`;

		consola.info("[deck.upload] Deck uploaded", { token, shareUrl });

		return Response.json({
			ok: true,
			token,
			shareUrl,
			deckUrl: `/deck/${token}`,
		});
	} catch (error) {
		consola.error("[deck.upload] Unexpected error", { error });
		return Response.json({ error: "Failed to upload deck" }, { status: 500 });
	}
}
