import type { ActionFunctionArgs } from "react-router";
import { deduplicateTasks } from "~/features/tasks/deduplicate";
import { userContext } from "~/server/user-context";

export async function action({ context, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext);

	if (!ctx?.claims || !ctx.supabase) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const formData = await request.formData();
	const dryRun = formData.get("dryRun") === "true";

	const result = await deduplicateTasks({
		supabase: ctx.supabase,
		dryRun,
	});

	return Response.json(result);
}
