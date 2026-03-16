import { spawnSync } from "node:child_process";

const BIOME_EXTENSIONS = new Set([".cjs", ".cts", ".js", ".json", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

function run(command, args) {
	const result = spawnSync(command, args, {
		stdio: "inherit",
		encoding: "utf8",
	});

	if (typeof result.status === "number" && result.status !== 0) {
		process.exit(result.status);
	}

	if (result.error) {
		throw result.error;
	}
}

function getStagedFiles() {
	const result = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
		encoding: "utf8",
	});

	if (result.error) throw result.error;
	if (result.status !== 0) process.exit(result.status ?? 1);

	return result.stdout
		.split("\n")
		.map((value) => value.trim())
		.filter(Boolean)
		.filter((file) => BIOME_EXTENSIONS.has(`.${file.split(".").pop()}`));
}

const stagedFiles = getStagedFiles();

if (stagedFiles.length === 0) {
	process.exit(0);
}

run("pnpm", ["exec", "biome", "check", "--write", "--no-errors-on-unmatched", ...stagedFiles]);
run("git", ["add", "--", ...stagedFiles]);
