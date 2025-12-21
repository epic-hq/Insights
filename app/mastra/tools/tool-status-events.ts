import consola from "consola"

type WriterLike = {
	custom?: (payload: unknown) => Promise<unknown> | unknown
}

type ToolContextLike = {
	writer?: WriterLike
}

type ToolLike = {
	id?: string
	execute?: (input: unknown, context?: unknown) => Promise<unknown> | unknown
}

type ToolStatus =
	| "thinking"
	| "searching"
	| "doing"
	| "creating"
	| "updating"
	| "deleting"
	| "saving"
	| "done"
	| "error"

function inferStatus(tool_name: string): ToolStatus {
	const name = tool_name.toLowerCase()

	if (name.includes("semantic") || name.includes("search") || name.startsWith("fetch") || name.includes("lookup")) {
		return "searching"
	}
	if (name.includes("delete") || name.includes("remove") || name.includes("archive")) return "deleting"
	if (name.includes("update") || name.includes("edit") || name.includes("set")) return "updating"
	if (name.includes("create") || name.includes("upsert") || name.includes("import") || name.includes("generate"))
		return "creating"
	if (name.includes("save")) return "saving"

	return "doing"
}

function statusMessage(status: ToolStatus): string {
	switch (status) {
		case "thinking":
			return "Thinking…"
		case "searching":
			return "Searching…"
		case "creating":
			return "Creating…"
		case "updating":
			return "Updating…"
		case "deleting":
			return "Deleting…"
		case "saving":
			return "Saving…"
		case "done":
			return "Done"
		case "error":
			return "Error"
		default:
			return "Working…"
	}
}

async function emitToolStatus(params: { context?: unknown; tool: string; status: ToolStatus; message?: string }) {
	try {
		const writer = (params.context as ToolContextLike | undefined)?.writer
		await writer?.custom?.({
			type: "data-tool-progress",
			data: {
				tool: params.tool,
				status: params.status,
				message: params.message ?? statusMessage(params.status),
			},
		})
	} catch (error) {
		consola.debug("[tool-status-events] failed to emit tool status", error)
	}
}

export function wrapToolWithStatusEvents<T extends ToolLike>(tool: T, tool_name: string): T {
	if (!tool?.execute) return tool

	const original_execute = tool.execute.bind(tool)

	const wrapped: ToolLike = {
		...tool,
		execute: async (input: unknown, context?: unknown) => {
			const status = inferStatus(tool_name)
			await emitToolStatus({ context, tool: tool_name, status })

			try {
				const result = await original_execute(input, context)
				await emitToolStatus({ context, tool: tool_name, status: "done" })
				return result
			} catch (error) {
				await emitToolStatus({
					context,
					tool: tool_name,
					status: "error",
					message: error instanceof Error ? error.message : "Tool failed",
				})
				throw error
			}
		},
	}

	return wrapped as T
}

export function wrapToolsWithStatusEvents<T extends Record<string, unknown>>(tools: T): T {
	const wrapped: Record<string, unknown> = {}
	for (const [key, tool] of Object.entries(tools)) {
		wrapped[key] = wrapToolWithStatusEvents(tool as ToolLike, key)
	}
	return wrapped as T
}
