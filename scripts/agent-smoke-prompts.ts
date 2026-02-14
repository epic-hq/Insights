import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type SmokePrompt = {
	id: string;
	prompt: string;
};

type SmokeResult = {
	id: string;
	prompt: string;
	status: number;
	ok: boolean;
	text: string;
	hasLink: boolean;
	durationMs: number;
	error?: string;
};

const DEFAULT_PROMPTS: SmokePrompt[] = [
	{ id: "icp_matches", prompt: "what icp matches do i have?" },
	{ id: "people_commonality", prompt: "what do john rubey and jered lish have in common?" },
	{ id: "top_themes", prompt: "what are the top 2 themes so far and who has them?" },
	{ id: "missing_people_data", prompt: "which people are missing title or company data?" },
	{ id: "create_survey", prompt: "create a survey to learn more from people with missing profile data" },
	{ id: "debug_survey", prompt: "/debug create a survey to learn more from people with missing profile data" },
	{ id: "next_steps", prompt: "what should i do next?" },
	{ id: "theme_evidence", prompt: "show me evidence behind the top pain themes" },
	{ id: "interview_priority", prompt: "which interviews should i review first?" },
	{ id: "status_summary", prompt: "give me a quick status summary" },
];

function parseArgs(argv: string[]) {
	const args = new Map<string, string>();
	for (let i = 0; i < argv.length; i += 1) {
		const raw = argv[i];
		if (!raw.startsWith("--")) continue;
		const key = raw.slice(2);
		const next = argv[i + 1];
		if (!next || next.startsWith("--")) {
			args.set(key, "true");
			continue;
		}
		args.set(key, next);
		i += 1;
	}
	return args;
}

function decodeEscapedJsonString(value: string) {
	try {
		return JSON.parse(`"${value}"`) as string;
	} catch {
		return value;
	}
}

function extractTextFromUiStream(raw: string) {
	const deltas: string[] = [];
	const matches = raw.matchAll(/"type":"text-delta"[^}]*"delta":"([^"]*)"/g);
	for (const match of matches) {
		if (!match[1]) continue;
		deltas.push(decodeEscapedJsonString(match[1]));
	}

	if (deltas.length > 0) {
		return deltas.join("");
	}

	const trimmed = raw.trim();
	return trimmed;
}

async function run() {
	const args = parseArgs(process.argv.slice(2));
	const baseUrl = (args.get("base-url") || process.env.AGENT_SMOKE_BASE_URL || "http://localhost:4280").replace(
		/\/$/,
		""
	);
	const accountId = args.get("account-id") || process.env.AGENT_SMOKE_ACCOUNT_ID || "";
	const projectId = args.get("project-id") || process.env.AGENT_SMOKE_PROJECT_ID || "";
	const outPath = resolve(
		args.get("out") || process.env.AGENT_SMOKE_OUT || "app/test/fixtures/agent-smoke-prompts.snapshot.json"
	);
	const authBearer = args.get("auth-bearer") || process.env.AGENT_SMOKE_AUTH_BEARER || "";

	if (!accountId || !projectId) {
		throw new Error("Missing required --account-id and --project-id (or AGENT_SMOKE_ACCOUNT_ID/PROJECT_ID env vars).");
	}

	const endpoint = `${baseUrl}/a/${accountId}/${projectId}/api/chat/project-status`;
	const results: SmokeResult[] = [];

	for (const smokePrompt of DEFAULT_PROMPTS) {
		const startedAt = Date.now();
		try {
			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(authBearer ? { Authorization: `Bearer ${authBearer}` } : {}),
				},
				body: JSON.stringify({
					messages: [{ role: "user", content: smokePrompt.prompt }],
					system: "Agent smoke prompt run. Keep answers concise and grounded in project data.",
				}),
			});

			const raw = await response.text();
			const text = extractTextFromUiStream(raw).trim();

			results.push({
				id: smokePrompt.id,
				prompt: smokePrompt.prompt,
				status: response.status,
				ok: response.ok,
				text,
				hasLink: /\[[^\]]+\]\((?:\/|https?:\/\/|#|mailto:)[^)]+\)/.test(text),
				durationMs: Date.now() - startedAt,
			});
		} catch (error) {
			results.push({
				id: smokePrompt.id,
				prompt: smokePrompt.prompt,
				status: 0,
				ok: false,
				text: "",
				hasLink: false,
				durationMs: Date.now() - startedAt,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	const output = {
		generatedAt: new Date().toISOString(),
		baseUrl,
		accountId,
		projectId,
		endpoint,
		promptCount: DEFAULT_PROMPTS.length,
		results,
	};

	await mkdir(dirname(outPath), { recursive: true });
	await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

	const failures = results.filter((result) => !result.ok || result.text.length === 0);
	const summary = {
		passed: results.length - failures.length,
		failed: failures.length,
		total: results.length,
		outPath,
	};

	// eslint-disable-next-line no-console
	console.log(`[agent-smoke] ${summary.passed}/${summary.total} prompts passed. Snapshot: ${summary.outPath}`);

	if (failures.length > 0) {
		// eslint-disable-next-line no-console
		console.error(
			`[agent-smoke] failed prompts: ${failures
				.map((failure) => `${failure.id} (status=${failure.status}, textLen=${failure.text.length})`)
				.join(", ")}`
		);
		process.exitCode = 1;
	}
}

run().catch((error) => {
	// eslint-disable-next-line no-console
	console.error("[agent-smoke] fatal error:", error);
	process.exitCode = 1;
});
