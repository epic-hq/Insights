import consola from "consola";
import { aggregateAutoInsightsData } from "~/utils/autoInsightsData.server";

export const action = async ({ request }: { request: Request }) => {
	// You may want to extract accountId/projectId from session or formData
	// For now, assume they are passed in the formData
	const formData = await request.formData();
	const accountId = formData.get("accountId") as string;
	const projectId = formData.get("projectId") as string;

	if (!accountId || !projectId) {
		return new Response("Missing accountId or projectId", { status: 400 });
	}

	// Call the aggregation utility
	const data = await aggregateAutoInsightsData(request, accountId);
	consola.log("**[AUTO-INSIGHTS ACTION] Data:", data);
	return data;
};
