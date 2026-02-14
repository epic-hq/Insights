/**
 * API endpoint to list chat threads for the project status agent.
 * Returns all threads for a given user+project combination.
 */

import consola from "consola";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
	buildShortThreadTitle,
	getPrimaryProjectStatusResourceId,
	listProjectStatusThreads,
	normalizeThreadTitle,
} from "~/features/project-chat/project-status-threads.server";
import { memory } from "~/mastra/memory";
import { userContext } from "~/server/user-context";

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const projectId = String(params.projectId || "");
	const userId = ctx?.claims?.sub || "";

	if (!projectId) {
		return Response.json({ error: "Missing projectId" }, { status: 400 });
	}

	if (!userId) {
		return Response.json({ error: "Missing userId" }, { status: 401 });
	}

	try {
		const threads = await listProjectStatusThreads({
			memory,
			userId,
			projectId,
			perPage: 100,
		});

		if (threads.length === 0) {
			return Response.json({ threads: [] });
		}

		const threadList = threads.slice(0, 20).map((thread) => ({
			id: thread.id,
			title: normalizeThreadTitle(thread.title),
			createdAt: thread.createdAt,
		}));

		return Response.json({ threads: threadList });
	} catch (error) {
		consola.error("Error listing project status chat threads:", error);
		return Response.json({ error: "Failed to list threads" }, { status: 500 });
	}
}

export async function action({ request, context, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const ctx = context.get(userContext);
	const projectId = String(params.projectId || "");
	const accountId = String(params.accountId || ctx?.account_id || "");
	const userId = ctx?.claims?.sub || "";

	if (!projectId) {
		return Response.json({ error: "Missing projectId" }, { status: 400 });
	}

	if (!userId) {
		return Response.json({ error: "Missing userId" }, { status: 401 });
	}

	const body = (await request.json().catch(() => ({}))) as { title?: string; seedText?: string };
	const title = buildShortThreadTitle(body?.title || body?.seedText);
	const resourceId = getPrimaryProjectStatusResourceId(userId, projectId);

	try {
		const thread = await memory.createThread({
			resourceId,
			title,
			metadata: {
				user_id: userId,
				project_id: projectId,
				account_id: accountId,
				source: "ui_new_chat",
			},
		});

		return Response.json({
			thread: {
				id: thread.id,
				title: normalizeThreadTitle(thread.title || title),
				createdAt: thread.createdAt,
			},
		});
	} catch (error) {
		consola.error("Error creating project status chat thread:", error);
		return Response.json({ error: "Failed to create thread" }, { status: 500 });
	}
}
