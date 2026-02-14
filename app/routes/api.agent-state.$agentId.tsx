import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { getAuthenticatedUser } from "~/lib/supabase/client.server";
import { mastra } from "~/mastra";

export async function loader({ request, params }: LoaderFunctionArgs) {
	try {
		// Get authenticated user
		const { user } = await getAuthenticatedUser(request);
		if (!user) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		const { agentId } = params;
		if (!agentId) {
			return new Response(JSON.stringify({ error: "Agent ID is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Get the agent from Mastra
		const agent = mastra.getAgent(agentId);
		if (!agent) {
			return new Response(JSON.stringify({ error: `Agent '${agentId}' not found` }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Since memory is disabled, return a mock project status
		const mockProjectStatus = {
			keyFindings: [
				"Users need better onboarding experience",
				"Pain points in current workflow identified",
				"Strong demand for mobile features",
			],
			nextSteps: ["Conduct additional user interviews", "Prototype mobile interface", "Test new onboarding flow"],
			totalInsights: 11,
			totalInterviews: 6,
			totalOpportunities: 4,
			totalPeople: 8,
			totalPersonas: 3,
			lastUpdated: new Date().toISOString(),
			currentProject: "Undergraduate Multicultural Students Research",
			currentAccount: user.account_id,
		};

		consola.log(`Agent ${agentId} mock state returned`);

		return new Response(
			JSON.stringify({
				agentId,
				projectStatus: mockProjectStatus,
				timestamp: new Date().toISOString(),
			}),
			{
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error) {
		consola.error("Error fetching agent state:", error);
		return new Response(JSON.stringify({ error: "Failed to fetch agent state" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
