import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import type { DocFile } from "./types.js";

export async function readDocFile(filePath: string, docsRoot: string): Promise<DocFile> {
	const content = await fs.readFile(filePath, "utf-8");
	const { data: frontmatter, content: body } = matter(content);

	const headings = extractHeadings(body);
	const links = extractLinks(body);
	const relativePath = path.relative(docsRoot, filePath);

	return {
		path: filePath,
		relativePath,
		content: body,
		frontmatter,
		headings,
		links,
	};
}

function extractHeadings(content: string): string[] {
	const headingRegex = /^#{1,6}\s+(.+)$/gm;
	const headings: string[] = [];
	let match;

	while ((match = headingRegex.exec(content)) !== null) {
		headings.push(match[1].trim());
	}

	return headings;
}

function extractLinks(content: string): string[] {
	const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
	const links: string[] = [];
	let match;

	while ((match = linkRegex.exec(content)) !== null) {
		links.push(match[2]);
	}

	return links;
}

export function calculateSimilarity(query: string, text: string): number {
	const queryLower = query.toLowerCase();
	const textLower = text.toLowerCase();

	// Exact match
	if (textLower.includes(queryLower)) {
		return 1.0;
	}

	// Word overlap
	const queryWords = queryLower.split(/\s+/);
	const textWords = textLower.split(/\s+/);
	const matchedWords = queryWords.filter((word) => textWords.includes(word));

	return matchedWords.length / queryWords.length;
}

export function getLineNumber(content: string, searchText: string): number {
	const lines = content.split("\n");
	const index = lines.findIndex((line) => line.includes(searchText));
	return index + 1;
}

export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}
