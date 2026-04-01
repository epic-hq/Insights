import { useEffect } from "react";
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData, useNavigate } from "react-router";
import { isValidProjectResumePath, readLastProjectRoute } from "~/lib/last-project-route.client";
import { userContext } from "~/server/user-context";

export const meta: MetaFunction = () => [{ title: "Dashboard | UpSight Customer Intelligence" }];

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;

	if (!supabase) {
		throw new Response("Unauthorized", { status: 401 });
	}

	const accountId = params.accountId;
	const projectId = params.projectId;

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 });
	}

	const { data: project } = await supabase
		.from("projects")
		.select("id")
		.eq("id", projectId)
		.eq("account_id", accountId)
		.single();

	if (!project) {
		throw new Response("Project not found", { status: 404 });
	}

	return {
		accountId,
		projectId,
		fallbackPath: `/a/${accountId}/${projectId}/journey`,
	};
}

export default function ProjectRootRedirect() {
	const { accountId, projectId, fallbackPath } = useLoaderData<typeof loader>();
	const navigate = useNavigate();

	useEffect(() => {
		const stored = readLastProjectRoute(accountId, projectId);
		const target = stored && isValidProjectResumePath(stored, accountId, projectId) ? stored : fallbackPath;
		navigate(target, { replace: true });
	}, [accountId, projectId, fallbackPath, navigate]);

	return (
		<div className="flex min-h-[50vh] items-center justify-center text-muted-foreground text-sm">
			Loading your workspace...
		</div>
	);
}
