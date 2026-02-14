import consola from "consola";

type WriterLike = {
	custom?: (payload: unknown) => Promise<unknown> | unknown;
};

type ToolContextLike = {
	writer?: WriterLike;
};

type ToolLike = {
	id?: string;
	execute?: (input: unknown, context?: unknown) => Promise<unknown> | unknown;
};

type ToolStatus =
	| "thinking"
	| "searching"
	| "doing"
	| "creating"
	| "updating"
	| "deleting"
	| "saving"
	| "done"
	| "error";

function inferStatus(tool_name: string): ToolStatus {
	const name = tool_name.toLowerCase();

	if (name.includes("semantic") || name.includes("search") || name.startsWith("fetch") || name.includes("lookup")) {
		return "searching";
	}
	if (name.includes("delete") || name.includes("remove") || name.includes("archive")) return "deleting";
	if (name.includes("update") || name.includes("edit") || name.includes("set")) return "updating";
	if (name.includes("create") || name.includes("upsert") || name.includes("import") || name.includes("generate"))
		return "creating";
	if (name.includes("save")) return "saving";

	return "doing";
}

function statusMessage(status: ToolStatus): string {
	switch (status) {
		case "thinking":
			return "Thinking…";
		case "searching":
			return "Searching…";
		case "creating":
			return "Creating…";
		case "updating":
			return "Updating…";
		case "deleting":
			return "Deleting…";
		case "saving":
			return "Saving…";
		case "done":
			return "Done";
		case "error":
			return "Error";
		default:
			return "Working…";
	}
}

const IO_SUMMARY_MAX_LEN = 500;

/** Create a compact summary of tool input or output for console logging. */
function summarizeToolIO(value: unknown): Record<string, unknown> | string {
	if (value === null || value === undefined) return "(empty)";
	if (typeof value !== "object") return String(value).slice(0, IO_SUMMARY_MAX_LEN);

	const obj = value as Record<string, unknown>;
	const summary: Record<string, unknown> = {};

	for (const [key, val] of Object.entries(obj)) {
		if (val === null || val === undefined) continue;
		if (Array.isArray(val)) {
			summary[key] = `[${val.length} items]`;
		} else if (typeof val === "object") {
			const keys = Object.keys(val as object);
			summary[key] = `{${keys.length} keys: ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? "…" : ""}}`;
		} else if (typeof val === "string" && val.length > 100) {
			summary[key] = `${val.slice(0, 100)}…`;
		} else {
			summary[key] = val;
		}
	}
	return summary;
}

async function emitToolStatus(params: { context?: unknown; tool: string; status: ToolStatus; message?: string }) {
	try {
		const writer = (params.context as ToolContextLike | undefined)?.writer;
		await writer?.custom?.({
			type: "data-tool-progress",
			data: {
				tool: params.tool,
				status: params.status,
				message: params.message ?? statusMessage(params.status),
			},
		});
	} catch (error) {
		consola.debug("[tool-status-events] failed to emit tool status", error);
	}
}

export function wrapToolWithStatusEvents<T extends ToolLike>(tool: T, tool_name: string): T {
	if (!tool?.execute) return tool;

	const original_execute = tool.execute.bind(tool);
	const wrapped = Object.create(Object.getPrototypeOf(tool)) as T;
	Object.defineProperties(wrapped, Object.getOwnPropertyDescriptors(tool));

	Object.defineProperty(wrapped, "execute", {
		configurable: true,
		writable: true,
		value: async (input: unknown, context?: unknown) => {
			const inputSummary = summarizeToolIO(input);
			consola.info(`[tool] → ${tool_name}`, inputSummary);

			const status = inferStatus(tool_name);
			await emitToolStatus({ context, tool: tool_name, status });

			const startMs = Date.now();
			try {
				const result = await original_execute(input, context);
				const durationMs = Date.now() - startMs;
				const outputSummary = summarizeToolIO(result);
				consola.info(`[tool] ← ${tool_name} (${durationMs}ms)`, outputSummary);
				await emitToolStatus({ context, tool: tool_name, status: "done" });
				return result;
			} catch (error) {
				const durationMs = Date.now() - startMs;
				consola.error(`[tool] ✗ ${tool_name} (${durationMs}ms)`, error instanceof Error ? error.message : error);
				await emitToolStatus({
					context,
					tool: tool_name,
					status: "error",
					message: error instanceof Error ? error.message : "Tool failed",
				});
				throw error;
			}
		},
	});

	return wrapped;
}

export function wrapToolsWithStatusEvents<T extends Record<string, unknown>>(tools: T): T {
	const wrapped: Record<string, unknown> = {};
	for (const [key, tool] of Object.entries(tools)) {
		wrapped[key] = wrapToolWithStatusEvents(tool as ToolLike, key);
	}
	return wrapped as T;
}
