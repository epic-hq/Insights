import fg from "fast-glob";
import path from "path";
import { readDocFile, fileExists, getLineNumber } from "../utils.js";
import type { LinkValidationResult } from "../types.js";

export async function validateDocLinks(docsRoot: string): Promise<LinkValidationResult[]> {
	const markdownFiles = await fg("**/*.md", {
		cwd: docsRoot,
		absolute: true,
		ignore: ["**/node_modules/**", "**/dist/**"],
	});

	const results: LinkValidationResult[] = [];

	for (const filePath of markdownFiles) {
		try {
			const doc = await readDocFile(filePath, docsRoot);
			const brokenLinks: LinkValidationResult["brokenLinks"] = [];

			for (const link of doc.links) {
				// Skip external links
				if (link.startsWith("http://") || link.startsWith("https://")) {
					continue;
				}

				// Skip anchors
				if (link.startsWith("#")) {
					continue;
				}

				// Remove anchor from link
				const [linkPath] = link.split("#");

				// Resolve relative path
				const fileDir = path.dirname(filePath);
				const resolvedPath = path.resolve(fileDir, linkPath);

				// Check if file exists
				const exists = await fileExists(resolvedPath);

				if (!exists) {
					const lineNumber = getLineNumber(doc.content, link);
					brokenLinks.push({
						link,
						line: lineNumber,
						reason: `File not found: ${linkPath}`,
					});
				}
			}

			if (brokenLinks.length > 0) {
				results.push({
					file: doc.relativePath,
					brokenLinks,
				});
			}
		} catch (error) {
			console.error(`Error validating ${filePath}:`, error);
		}
	}

	return results;
}
