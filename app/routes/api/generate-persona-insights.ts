import { tasks } from "@trigger.dev/sdk";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import type { generatePersonaSummaryTask } from "~/../src/trigger/persona/generatePersonaSummary";
import { getServerClient } from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
	try {
		const { client: supabase } = getServerClient(request);
		const { data: jwt } = await supabase.auth.getClaims();
		const accountId = jwt?.claims.sub;

		if (!accountId) {
			consola.error("[Persona Insights API] User not authenticated");
			throw new Response("Unauthorized", { status: 401 });
		}

		const formData = await request.formData();
		const personaId = formData.get("personaId") as string;
		const projectId = formData.get("projectId") as string;
		if (!personaId || !projectId) {
			throw new Response("Missing personaId or projectId", { status: 400 });
		}

		// 1. Aggregate people for this persona
		const result = await tasks.triggerAndWait<typeof generatePersonaSummaryTask>("personas.generate-summary", {
			personaId,
			projectId,
			accountId,
		});

		if (!result.ok) {
			consola.error("[Persona Insights API] Persona refresh failed", result.error);
			throw new Response("Failed to refresh persona", { status: 500 });
		}

		return {
			success: true,
			data: result.output,
		};
	} catch (error) {
		consola.error("[Persona Insights API] Error:", error);
		throw new Response("Internal server error", { status: 500 });
	}
}
