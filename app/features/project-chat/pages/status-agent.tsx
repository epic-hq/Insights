import type { LoaderFunctionArgs } from "react-router";
import { useParams } from "react-router";
import { useLoaderData } from "react-router-dom";
import { ProjectStatusAgentChat } from "~/components/chat/ProjectStatusAgentChat";
import { userContext } from "~/server/user-context";
import { getProjectStatusData } from "~/utils/project-status.server";

export const handle = { hideProjectStatusAgent: true } as const;

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const { supabase } = ctx;
	const accountId = params.accountId as string;
	const projectId = params.projectId as string;

	if (!accountId || !projectId) {
		throw new Response("Missing accountId or projectId", { status: 400 });
	}

	const [statusData, userSettingsResult] = await Promise.all([
		getProjectStatusData(projectId, supabase),
		supabase
			.from("user_settings")
			.select("metadata")
			.eq("user_id", ctx.claims?.sub ?? "")
			.maybeSingle(),
	]);

	const onboarding = (userSettingsResult?.data?.metadata as Record<string, unknown> | null)?.onboarding as
		| Record<string, string>
		| undefined;

	const projectSystemContext = [
		statusData?.projectName ? `Project: ${statusData.projectName}` : null,
		`Interviews conducted: ${statusData?.totalInterviews ?? 0}`,
		`Evidence collected: ${statusData?.totalEvidence ?? 0}`,
		`Insights generated: ${statusData?.totalInsights ?? 0}`,
		`Personas identified: ${statusData?.totalPersonas ?? 0}`,
		statusData?.nextSteps?.length ? `Current next steps: ${statusData.nextSteps.slice(0, 3).join(", ")}` : null,
		onboarding?.job_function ? `User role: ${onboarding.job_function}` : null,
		onboarding?.primary_use_case ? `Use cases: ${onboarding.primary_use_case}` : null,
		onboarding?.company_size ? `Company size: ${onboarding.company_size}` : null,
	]
		.filter(Boolean)
		.join("\n");

	return {
		accountId,
		projectId,
		projectSystemContext,
	};
}

export default function ProjectStatusAgentPage() {
	const { accountId, projectId, projectSystemContext } = useLoaderData<typeof loader>();
	const params = useParams();

	return (
		<div className="flex h-full flex-col bg-background">
			<div className="flex-1 overflow-hidden">
				<ProjectStatusAgentChat
					accountId={accountId || params.accountId || ""}
					projectId={projectId || params.projectId || ""}
					systemContext={projectSystemContext}
				/>
			</div>
		</div>
	);
}
