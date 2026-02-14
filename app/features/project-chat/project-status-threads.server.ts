const LEGACY_AGENT_RESOURCE_PREFIXES = [
	"projectStatusAgent",
	"chiefOfStaffAgent",
	"researchAgent",
	"feedbackAgent",
	"projectSetupAgent",
	"howtoAgent",
] as const;

export type ProjectStatusThreadSummary = {
	id: string;
	title?: string | null;
	createdAt?: string | Date | null;
	resourceId?: string | null;
};

export function getPrimaryProjectStatusResourceId(userId: string, projectId: string) {
	return `project-chat-${userId}-${projectId}`;
}

export function getProjectStatusResourceIds(userId: string, projectId: string) {
	const ids = new Set<string>([getPrimaryProjectStatusResourceId(userId, projectId)]);
	for (const prefix of LEGACY_AGENT_RESOURCE_PREFIXES) {
		ids.add(`${prefix}-${userId}-${projectId}`);
	}
	return Array.from(ids);
}

export function buildShortThreadTitle(seedText?: string | null) {
	const cleaned = (seedText || "")
		.replace(/https?:\/\/\S+/g, " ")
		.replace(/[^\p{L}\p{N}\s'-]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!cleaned) return "New Chat";
	const words = cleaned
		.split(" ")
		.map((word) => word.trim())
		.filter(Boolean);
	if (words.length === 0) return "New Chat";
	const shortWords = words.slice(0, 3).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
	return shortWords.join(" ").slice(0, 48);
}

export function normalizeThreadTitle(rawTitle?: string | null) {
	const title = (rawTitle || "").trim();
	if (!title) return "Chat Session";
	if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(title)) {
		return "Chat Session";
	}
	if (
		/^(projectstatusagent|researchagent|chiefofstaffagent|feedbackagent|howtoagent|projectsetupagent)\b/i.test(title)
	) {
		return "Chat Session";
	}
	return title.slice(0, 64);
}

export async function listProjectStatusThreads({
	memory,
	userId,
	projectId,
	perPage = 100,
}: {
	memory: {
		listThreads: (args: {
			filter: { resourceId: string };
			orderBy: { field: "createdAt"; direction: "DESC" | "ASC" };
			page: number;
			perPage: number;
		}) => Promise<{ threads: ProjectStatusThreadSummary[]; total: number } | null | undefined>;
	};
	userId: string;
	projectId: string;
	perPage?: number;
}) {
	const resourceIds = getProjectStatusResourceIds(userId, projectId);
	const responses = await Promise.all(
		resourceIds.map((resourceId) =>
			memory.listThreads({
				filter: { resourceId },
				orderBy: { field: "createdAt", direction: "DESC" },
				page: 0,
				perPage,
			})
		)
	);

	const deduped = new Map<string, ProjectStatusThreadSummary>();
	for (let index = 0; index < responses.length; index += 1) {
		const resourceId = resourceIds[index];
		const threads = responses[index]?.threads || [];
		for (const thread of threads) {
			if (!thread?.id || deduped.has(thread.id)) continue;
			deduped.set(thread.id, {
				...thread,
				resourceId: thread.resourceId || resourceId,
			});
		}
	}

	return Array.from(deduped.values()).sort((a, b) => {
		const aRaw = a.createdAt ? new Date(a.createdAt).getTime() : 0;
		const bRaw = b.createdAt ? new Date(b.createdAt).getTime() : 0;
		const aTime = Number.isFinite(aRaw) ? aRaw : 0;
		const bTime = Number.isFinite(bRaw) ? bRaw : 0;
		return bTime - aTime;
	});
}

export async function findProjectStatusThread({
	memory,
	userId,
	projectId,
	threadId,
}: {
	memory: {
		listThreads: (args: {
			filter: { resourceId: string };
			orderBy: { field: "createdAt"; direction: "DESC" | "ASC" };
			page: number;
			perPage: number;
		}) => Promise<{ threads: ProjectStatusThreadSummary[]; total: number } | null | undefined>;
	};
	userId: string;
	projectId: string;
	threadId: string;
}) {
	const threads = await listProjectStatusThreads({
		memory,
		userId,
		projectId,
		perPage: 200,
	});
	return threads.find((thread) => thread.id === threadId) ?? null;
}
