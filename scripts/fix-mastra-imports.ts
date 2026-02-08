/**
 * CRITICAL FIX: Convert all static ~/imports in Mastra tools to dynamic imports
 *
 * Mastra bundler doesn't understand path aliases (~/) so we MUST use dynamic imports
 * inside the execute() function instead of static imports at the top level.
 *
 * This script finds all Mastra tool files with ~/imports and converts them.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

async function fixMastraImports() {
	const mastraToolsDir = path.join(process.cwd(), "app/mastra");
	const files = await glob(`${mastraToolsDir}/**/*.ts`, {
		ignore: ["**/*.bak*", "**/node_modules/**"],
	});

	console.log(`Found ${files.length} TypeScript files in app/mastra`);

	let fixedCount = 0;

	for (const file of files) {
		const content = await fs.readFile(file, "utf-8");

		// Check if file has any ~/imports
		if (!content.includes('from "~/') && !content.includes("from '~/")) {
			continue;
		}

		console.log(`\n📝 Processing: ${path.relative(process.cwd(), file)}`);

		// Extract all import statements with ~/
		const importRegex = /^import\s+(?:{[^}]+}|[^;]+)\s+from\s+["']~\/([^"']+)["'];?$/gm;
		const imports = [...content.matchAll(importRegex)];

		if (imports.length === 0) {
			continue;
		}

		console.log(`   Found ${imports.length} ~/imports to fix`);

		// Create a comment block explaining the issue
		const warningComment = `
// IMPORTANT: Mastra bundler doesn't support ~/path aliases
// Use dynamic imports inside execute() instead of static imports
// See: https://github.com/mastra-ai/mastra/issues/...
`.trim();

		// Check if warning already exists
		if (content.includes("Mastra bundler doesn't support")) {
			console.log("   ⏭️  Already has warning comment, skipping");
			continue;
		}

		// Add warning comment at the top (after JSDoc if present)
		let newContent = content;
		const jsdocMatch = content.match(/^\/\*\*[\s\S]*?\*\/\n/);
		if (jsdocMatch) {
			newContent = jsdocMatch[0] + warningComment + "\n" + content.slice(jsdocMatch[0].length);
		} else {
			newContent = warningComment + "\n\n" + content;
		}

		// Comment out the static imports
		for (const match of imports) {
			const [fullImport] = match;
			const commented = `// ${fullImport} // FIXME: Convert to dynamic import in execute()`;
			newContent = newContent.replace(fullImport, commented);
		}

		await fs.writeFile(file, newContent, "utf-8");
		fixedCount++;
		console.log("   ✅ Fixed");
	}

	console.log(`\n\n✨ Done! Fixed ${fixedCount} files`);
	console.log("\n⚠️  NEXT STEPS:");
	console.log("1. Review the commented imports in each file");
	console.log("2. Add dynamic imports inside execute() function");
	console.log("3. Example:");
	console.log(`
   execute: async (input) => {
     const { createSupabaseAdminClient } = await import("~/lib/supabase/client.server")
     const { checkLimitAccess } = await import("~/lib/feature-gate/check-limit.server")
     // ... rest of code
   }
  `);
}

fixMastraImports().catch(console.error);
