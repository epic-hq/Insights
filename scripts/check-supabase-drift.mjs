import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const localPath = path.join(root, "supabase/types.ts");
const remotePath = path.join(root, ".cache/supabase/types.remote.ts");

function normalize(content) {
	return content
		.replace(/PostgrestVersion:\s*"[^"]+"/g, 'PostgrestVersion: "<normalized>"')
		.replace(/\r\n/g, "\n")
		.trim();
}

if (!existsSync(localPath)) {
	console.error(`Local generated types not found: ${localPath}`);
	process.exit(1);
}

if (!existsSync(remotePath)) {
	console.error(`Remote generated types not found: ${remotePath}`);
	process.exit(1);
}

const local = normalize(readFileSync(localPath, "utf8"));
const remote = normalize(readFileSync(remotePath, "utf8"));

if (local === remote) {
	console.log("Supabase drift check passed: local canonical types match the remote verification artifact.");
	process.exit(0);
}

console.error("Supabase drift detected between local canonical types and remote verification output.");
console.error(`Local:  ${path.relative(root, localPath)}`);
console.error(`Remote: ${path.relative(root, remotePath)}`);
console.error("This usually means one of three things:");
console.error("1. The repo is missing a migration or schema update.");
console.error("2. The remote project has platform-specific capabilities that belong in compatibility wrappers.");
console.error("3. Local and remote schema exposure differ.");
process.exit(1);
