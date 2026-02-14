/**
 * Patches the generated baml_client/index.ts to remove error exports
 * that cause SSR bundling issues.
 *
 * The BAML client re-exports error classes from @boundaryml/baml/errors,
 * but these aren't used in our codebase and cause runtime errors in the
 * SSR bundle. This script removes those exports.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dirname, "..", "baml_client", "index.ts");

const content = fs.readFileSync(indexPath, "utf-8");

// Remove the export block for BAML errors
// Matches: export { BamlClientHttpError, BamlValidationError, BamlClientFinishReasonError } from "@boundaryml/baml/errors";
// Or the multi-line version
const patchedContent = content
	.replace(
		/export\s*\{\s*BamlClientHttpError,\s*BamlValidationError,\s*BamlClientFinishReasonError,?\s*\}\s*from\s*["']@boundaryml\/baml(?:\/errors)?["'];?\n?/g,
		"// PATCHED: Error exports removed to fix SSR bundling\n"
	)
	.replace(
		/export\s*\{\s*\n?\s*BamlClientHttpError,\s*\n?\s*BamlValidationError,\s*\n?\s*BamlClientFinishReasonError,?\s*\n?\s*\}\s*from\s*["']@boundaryml\/baml(?:\/errors)?["'];?\n?/g,
		"// PATCHED: Error exports removed to fix SSR bundling\n"
	);

if (content !== patchedContent) {
	fs.writeFileSync(indexPath, patchedContent);
	console.log("Patched baml_client/index.ts - removed error exports");
} else {
	console.log("baml_client/index.ts already patched or no changes needed");
}
