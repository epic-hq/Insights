/**
 * MCP Server launcher for Claude Desktop / Cursor.
 *
 * Registers tsconfig path aliases (~/) and loads .env so the server
 * can run standalone via `npx tsx` outside of Vite.
 *
 * Users only need to provide UPSIGHT_API_KEY — everything else
 * is loaded from the project's .env file.
 */

import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// 1. Load .env from project root before anything else
const projectRoot = resolve(__dirname, "../..");
require("dotenv").config({ path: resolve(projectRoot, ".env") });

// 2. Register ~/  → app/* path alias so all imports resolve
require("tsconfig-paths").register({
	baseUrl: projectRoot,
	paths: { "~/*": ["./app/*"] },
});

// 3. Start the server
const { startMCPServer } = await import("./mcp-server");
startMCPServer();
