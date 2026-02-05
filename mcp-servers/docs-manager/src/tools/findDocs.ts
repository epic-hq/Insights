import fg from "fast-glob";
import path from "path";
import { readDocFile, calculateSimilarity, getLineNumber } from "../utils.js";
import type { SearchResult } from "../types.js";

export async function findDocs(query: string, docsRoot: string): Promise<SearchResult[]> {
	const markdownFiles = await fg("**/*.md", {
		cwd: docsRoot,
		absolute: true,
		ignore: ["**/node_modules/**", "**/dist/**"],
	});

	const results: SearchResult[] = [];

	for (const filePath of markdownFiles) {
		try {
			const doc = await readDocFile(filePath, docsRoot);

			// Search in content, headings, and frontmatter
			const contentScore = calculateSimilarity(query, doc.content);
			const headingScore = Math.max(
				...doc.headings.map((h) => calculateSimilarity(query, h)),
				0
			);
			const titleScore = doc.frontmatter?.title
				? calculateSimilarity(query, doc.frontmatter.title)
				: 0;

			const maxScore = Math.max(contentScore, headingScore, titleScore);

			if (maxScore > 0.2) {
				// Threshold for relevance
				const matches = findMatches(doc.content, query);

				results.push({
					path: doc.path,
					relativePath: doc.relativePath,
					score: maxScore,
					matches,
					headings: doc.headings.slice(0, 5), // Top 5 headings
				});
			}
		} catch (error) {
			console.error(`Error processing ${filePath}:`, error);
		}
	}

	// Sort by score descending
	results.sort((a, b) => b.score - a.score);

	return results.slice(0, 10); // Top 10 results
}

function findMatches(
	content: string,
	query: string
): Array<{ line: number; content: string; context: string }> {
	const lines = content.split("\n");
	const queryLower = query.toLowerCase();
	const matches: Array<{ line: number; content: string; context: string }> = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.toLowerCase().includes(queryLower)) {
			// Get context (line before and after)
			const contextStart = Math.max(0, i - 1);
			const contextEnd = Math.min(lines.length - 1, i + 1);
			const context = lines.slice(contextStart, contextEnd + 1).join("\n");

			matches.push({
				line: i + 1,
				content: line.trim(),
				context,
			});

			if (matches.length >= 3) break; // Max 3 matches per file
		}
	}

	return matches;
}
