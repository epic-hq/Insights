#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";
import { fileURLToPath } from "url";
import { findDocs } from "./tools/findDocs.js";
import { validateDocLinks } from "./tools/validateLinks.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default to docs/ directory in project root
const DOCS_ROOT = process.env.DOCS_ROOT || path.resolve(__dirname, "../../../docs");

const server = new Server(
	{
		name: "docs-manager",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
		},
	}
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [
			{
				name: "find_docs",
				description:
					"Search documentation using semantic similarity. Returns ranked list of relevant docs with snippets showing why they matched. Use this to find where specific topics are documented.",
				inputSchema: {
					type: "object",
					properties: {
						query: {
							type: "string",
							description: "Search query (e.g., 'authentication', 'trigger.dev tasks', 'PRD for reels')",
						},
					},
					required: ["query"],
				},
			},
			{
				name: "validate_doc_links",
				description:
					"Validate all markdown links in documentation. Checks for broken internal links and reports files with issues. Use this after reorganizing docs or to check doc health.",
				inputSchema: {
					type: "object",
					properties: {},
				},
			},
		],
	};
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params;

	try {
		if (name === "find_docs") {
			if (!args || typeof args !== "object") {
				throw new Error("Invalid arguments");
			}
			const query = args.query as string;
			if (!query) {
				throw new Error("Query parameter is required");
			}

			const results = await findDocs(query, DOCS_ROOT);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								query,
								resultsCount: results.length,
								results: results.map((r) => ({
									file: r.relativePath,
									score: r.score.toFixed(2),
									headings: r.headings,
									matches: r.matches.map((m) => ({
										line: m.line,
										snippet: m.content.substring(0, 150),
									})),
								})),
							},
							null,
							2
						),
					},
				],
			};
		}

		if (name === "validate_doc_links") {
			const results = await validateDocLinks(DOCS_ROOT);

			const totalBroken = results.reduce((sum, r) => sum + r.brokenLinks.length, 0);

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								summary: {
									filesWithIssues: results.length,
									totalBrokenLinks: totalBroken,
									status: totalBroken === 0 ? "✅ All links valid" : "⚠️ Broken links found",
								},
								issues: results,
							},
							null,
							2
						),
					},
				],
			};
		}

		throw new Error(`Unknown tool: ${name}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({ error: errorMessage }, null, 2),
				},
			],
			isError: true,
		};
	}
});

// Start server
async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("Docs Manager MCP server running on stdio");
	console.error(`Docs root: ${DOCS_ROOT}`);
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
