/**
 * Upload a slide deck (HTML + assets) for public sharing.
 * HTML is stored in the decks table; assets go to R2.
 *
 * Usage:
 *   npx tsx scripts/upload-deck.ts <html-file> [assets-dir] [--title "Deck Title"]
 *   npx tsx scripts/upload-deck.ts <html-file> [assets-dir] [--title "Deck Title"] --update <token>
 *
 * Examples:
 *   npx tsx scripts/upload-deck.ts iwd-upsight-pitch.html iwd-assets --title "IWD Pitch"
 *   npx tsx scripts/upload-deck.ts deck.html assets --update Xkh4gga79rw_ --title "Updated Deck"
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { config } from "@dotenvx/dotenvx";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { uploadToR2 } from "../app/utils/r2.server";

config({ quiet: true });

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".webp": "image/webp",
	".css": "text/css",
	".js": "application/javascript",
};

function parseArgs(args: string[]) {
	let htmlPath = "";
	let assetsDir = "";
	let title = "";
	let updateToken = "";

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--title" && args[i + 1]) {
			title = args[++i];
		} else if (args[i] === "--update" && args[i + 1]) {
			updateToken = args[++i];
		} else if (!htmlPath) {
			htmlPath = args[i];
		} else if (!assetsDir) {
			assetsDir = args[i];
		}
	}

	return { htmlPath, assetsDir, title, updateToken };
}

async function main() {
	const { htmlPath, assetsDir, title, updateToken } = parseArgs(process.argv.slice(2));

	if (!htmlPath) {
		console.error(
			'Usage: npx tsx scripts/upload-deck.ts <html-file> [assets-dir] [--title "Title"] [--update <token>]'
		);
		process.exit(1);
	}

	const supabaseUrl = process.env.SUPABASE_URL;
	const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!supabaseUrl || !supabaseKey) {
		console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
		process.exit(1);
	}

	const supabase = createClient(supabaseUrl, supabaseKey);
	const token = updateToken || nanoid(12);
	const prefix = `decks/${token}`;
	let html = await readFile(resolve(htmlPath), "utf-8");
	const deckTitle = title || basename(htmlPath, extname(htmlPath));

	// Upload assets to R2, rewrite references in HTML
	if (assetsDir) {
		const dir = resolve(assetsDir);
		const files = await readdir(dir);

		for (const file of files) {
			const filePath = join(dir, file);
			const key = `${prefix}/assets/${file}`;
			const body = new Uint8Array(await readFile(filePath));
			const ext = extname(file).toLowerCase();
			const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

			console.log(`  Uploading asset: ${file}`);
			const result = await uploadToR2({ key, body, contentType });
			if (!result.success) {
				console.error(`  Failed: ${"error" in result ? result.error : "unknown"}`);
				continue;
			}

			// Rewrite asset references to the server-side proxy route
			const assetUrl = `/deck/${token}/assets/${file}`;
			const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			html = html.replace(new RegExp(`(?:[\\w-]+/)*${escaped}`, "g"), assetUrl);
		}
	}

	// Store HTML in database (upsert to support --update)
	console.log(updateToken ? "  Updating existing deck..." : "  Saving deck to database...");
	const { error } = await supabase
		.from("decks")
		.upsert({ token, title: deckTitle, html_content: html }, { onConflict: "token" });

	if (error) {
		console.error("Failed to save deck:", error.message);
		process.exit(1);
	}

	const host = process.env.HOST || "https://getupsight.com";
	console.log("\n  Done! Share this link:\n");
	console.log(`  ${host}/deck/${token}\n`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
