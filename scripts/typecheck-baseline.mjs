import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const baselinePath = path.join(root, ".typecheck-baseline.json");
const update = process.argv.includes("--update");
const packageRunner = process.env.PNPM_EXECUTABLE ?? "pnpm";
const packageRunnerArgs = packageRunner === "pnpm" ? [] : packageRunner.split(" ");
const useLocalBins = packageRunner === "local-bin";

function run(command, args) {
	const result = spawnSync(command, args, {
		cwd: root,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

	if (result.error) {
		throw result.error;
	}

	return result;
}

function runPackageExec(args) {
	if (useLocalBins) {
		const [subcommand, tool, ...toolArgs] = args;
		if (subcommand !== "exec" || !tool) {
			throw new Error(`Unsupported local-bin invocation: ${args.join(" ")}`);
		}
		return run(path.join(root, "node_modules", ".bin", tool), toolArgs);
	}

	if (packageRunnerArgs.length === 0) {
		return run(packageRunner, args);
	}

	const [command, ...prefixArgs] = packageRunnerArgs;
	return run(command, [...prefixArgs, ...args]);
}

function ensureDependenciesInstalled() {
	if (existsSync(path.join(root, "node_modules"))) {
		return;
	}

	console.error("Typecheck baseline requires installed dependencies.");
	console.error("Run your package install first, then rerun:");
	console.error("pnpm install");
	console.error("pnpm run typecheck:baseline:update");
	process.exit(1);
}

function normalizeDiagnosticLine(line) {
	const match = line.match(/^(.*)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
	if (!match) {
		return null;
	}

	const [, filePath, , , code, message] = match;
	return `${path.relative(root, filePath)}|${code}|${message.trim()}`;
}

function collectCurrentBaseline() {
	ensureDependenciesInstalled();

	const typegen = runPackageExec(["exec", "react-router", "typegen"]);
	if (typegen.status !== 0) {
		process.stderr.write(typegen.stdout ?? "");
		process.stderr.write(typegen.stderr ?? "");
		process.exit(typegen.status ?? 1);
	}

	const tsc = runPackageExec(["exec", "tsc", "-p", "tsconfig.typecheck.json", "--pretty", "false"]);
	const output = `${tsc.stdout ?? ""}\n${tsc.stderr ?? ""}`;
	const normalized = output
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map(normalizeDiagnosticLine)
		.filter(Boolean);

	const counts = {};
	for (const key of normalized) {
		counts[key] = (counts[key] ?? 0) + 1;
	}

	return {
		generatedAt: new Date().toISOString(),
		totalDiagnostics: normalized.length,
		diagnostics: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
		rawExitCode: tsc.status ?? 0,
	};
}

function writeBaselineFile(baseline) {
	writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
}

if (!existsSync(baselinePath) && !update) {
	if (process.env.CI) {
		console.error(`Missing ${path.basename(baselinePath)}. Run 'pnpm run typecheck:baseline:update' and commit it.`);
		process.exit(1);
	}

	console.warn(`Missing ${path.basename(baselinePath)}. Skipping baseline enforcement locally.`);
	console.warn("Run 'pnpm run typecheck:baseline:update' once your Node/pnpm toolchain is available.");
	process.exit(0);
}

const current = collectCurrentBaseline();

if (update) {
	writeBaselineFile(current);
	console.log(
		`Updated ${path.relative(root, baselinePath)} with ${current.totalDiagnostics} normalized TypeScript diagnostics.`
	);
	process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const regressions = [];

for (const [key, count] of Object.entries(current.diagnostics)) {
	const baselineCount = baseline.diagnostics?.[key] ?? 0;
	if (count > baselineCount) {
		regressions.push({ key, baselineCount, count });
	}
}

if (regressions.length === 0) {
	console.log(
		`Typecheck baseline passed. Current normalized diagnostics: ${current.totalDiagnostics}. Baseline: ${baseline.totalDiagnostics ?? "unknown"}.`
	);
	process.exit(0);
}

console.error("TypeScript regressions detected relative to the committed baseline:");
for (const regression of regressions.slice(0, 50)) {
	console.error(`- ${regression.key} (baseline ${regression.baselineCount}, current ${regression.count})`);
}

if (regressions.length > 50) {
	console.error(`...and ${regressions.length - 50} more.`);
}

console.error("If these are intentional debt reductions or known changes, refresh the baseline with:");
console.error("pnpm run typecheck:baseline:update");
process.exit(1);
