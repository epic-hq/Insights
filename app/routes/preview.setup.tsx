// Preview route for redesigned setup page
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router-dom";
import ProjectGoalsScreen from "~/features/onboarding/components/ProjectGoalsScreen";
import { getProjectById } from "~/features/projects/db";
import { userContext } from "~/server/user-context";

type TemplatePrefill = {
	template_key: string;
	target_orgs: string[];
	target_roles: string[];
	research_goal: string;
	research_goal_details: string;
	decision_questions: string[];
	assumptions: string[];
	unknowns: string[];
	custom_instructions: string;
};

function fallbackPrefill(templateKey: string, projectName: string, signup: Record<string, unknown>): TemplatePrefill {
	const goalFromSignup = (signup?.goal || "").toString().trim();
	const challenges = (signup?.challenges || "").toString().trim();
	const _inferredGoal = goalFromSignup || `Understand customer needs for ${projectName}`;

	const pre: TemplatePrefill = {
		template_key: templateKey,
		target_orgs: [],
		target_roles: [],
		research_goal: goalFromSignup || "",
		research_goal_details: challenges || "",
		decision_questions: [],
		assumptions: [],
		unknowns: [],
		custom_instructions: "",
	};

	return pre;
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const accountId = ctx.account_id;
	const projectId = params.projectId;

	if (!projectId) {
		throw new Response("Project ID required", { status: 400 });
	}

	// Get the actual project for context
	const projectResult = await getProjectById({
		supabase: ctx.supabase,
		id: projectId,
	});

	if (!projectResult.data) {
		throw new Response("Project not found", { status: 404 });
	}

	// Default template: Understand Customer Needs
	const template_key = "understand_customer_needs";
	const signup = { ...(ctx.user_settings?.signup_data || {}) };

	const prefill: TemplatePrefill = fallbackPrefill(template_key, projectResult.data.name || "Project", signup);

	return {
		project: projectResult.data,
		accountId,
		projectId,
		template_key,
		prefill,
		isPreview: true,
	};
}

export default function PreviewSetupPage() {
	const { project, projectId, accountId, template_key, prefill } = useLoaderData<typeof loader>();

	const handleNext = () => {
		// For preview, just show an alert
		alert("Preview mode - this would normally navigate to the questions step");
	};

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Preview Banner */}
			<div className="bg-blue-600 p-3 text-center text-white">
				<p className="text-sm">
					🎨 <strong>Preview Mode</strong> - This is the redesigned version of the setup page
				</p>
			</div>
			<div className="mx-auto max-w-4xl px-0 py-8">
				<ProjectGoalsScreen
					onNext={handleNext}
					project={project}
					projectId={projectId}
					accountId={accountId}
					templateKey={template_key}
					prefill={prefill}
				/>
			</div>
		</div>
	);
}
