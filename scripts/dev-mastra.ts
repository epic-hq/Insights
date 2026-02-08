import { spawn } from "node:child_process";
import { createServer } from "node:net";

const DEFAULT_PORT = Number(process.env.MASTRA_PORT || "4111");
const MAX_ATTEMPTS = 25;

async function isPortAvailable(port: number): Promise<boolean> {
	return await new Promise((resolve) => {
		const server = createServer();

		server.once("error", () => {
			resolve(false);
		});

		server.once("listening", () => {
			server.close(() => resolve(true));
		});

		server.listen(port, "0.0.0.0");
	});
}

async function findAvailablePort(startPort: number, maxAttempts = MAX_ATTEMPTS): Promise<number> {
	for (let offset = 0; offset < maxAttempts; offset += 1) {
		const candidate = startPort + offset;
		// eslint-disable-next-line no-await-in-loop
		if (await isPortAvailable(candidate)) {
			return candidate;
		}
	}

	throw new Error(`Unable to find an available port after ${maxAttempts} attempts starting at ${startPort}.`);
}

async function main() {
	const args = new Set(process.argv.slice(2));
	const dryRun = args.has("--dry-run");
	const startPort = Number.isFinite(DEFAULT_PORT) && DEFAULT_PORT > 0 ? DEFAULT_PORT : 4111;
	const selectedPort = await findAvailablePort(startPort);

	if (selectedPort !== startPort) {
		console.warn(`[dev:mastra] Port ${startPort} is in use. Using ${selectedPort} instead.`);
	} else {
		console.info(`[dev:mastra] Using port ${selectedPort}.`);
	}

	if (dryRun) {
		return;
	}

	const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
	const child = spawn(npxCommand, ["mastra", "dev", "--dir", "app/mastra"], {
		stdio: "inherit",
		env: {
			...process.env,
			MASTRA_PORT: String(selectedPort),
		},
	});

	const forwardSignal = (signal: NodeJS.Signals) => {
		if (!child.killed) {
			child.kill(signal);
		}
	};

	process.on("SIGINT", () => forwardSignal("SIGINT"));
	process.on("SIGTERM", () => forwardSignal("SIGTERM"));

	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}
		process.exit(code ?? 1);
	});

	child.on("error", (error) => {
		console.error("[dev:mastra] Failed to launch Mastra dev server:", error);
		process.exit(1);
	});
}

main().catch((error) => {
	console.error("[dev:mastra] Startup failed:", error);
	process.exit(1);
});
