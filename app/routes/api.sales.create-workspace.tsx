import consola from "consola";
import { format } from "date-fns";
import type { ActionFunctionArgs } from "react-router";

import { createProject } from "~/features/projects/db";
import { userContext } from "~/server/user-context";

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405,
			headers: { "Content-Type": "application/json" },
		});
	}

	const ctx = context.get(userContext);
	if (!ctx?.supabase || !ctx?.account_id) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const timestamp = format(new Date(), "MMM d, yyyy HH:mm");
		const projectName = `Sales Workspace ${timestamp}`;

		const { data, error } = await createProject({
			supabase: ctx.supabase,
			data: {
				name: projectName,
				description: "Discovery-to-CRM hygiene workspace",
				account_id: ctx.account_id,
				workflow_type: "sales",
			},
		});

		if (error || !data) {
			consola.error("Failed to create sales workspace", error);
			return new Response(JSON.stringify({ error: error?.message ?? "Unable to create workspace" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response(JSON.stringify({ projectId: data.id }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		consola.error("Unexpected error creating sales workspace", error);
		return new Response(JSON.stringify({ error: "Unexpected error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
