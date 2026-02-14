/**
 * Dashboard Page - Project overview with lens results
 *
 * State-aware dashboard that adapts to project progress:
 * - Empty: Guides users to setup goals or upload content
 * - Processing: Shows progress indicator
 * - Has Data: Displays lens results and AI insights
 */

import { type LoaderFunctionArgs, type MetaFunction, redirect } from "react-router";

export const meta: MetaFunction = () => [{ title: "Dashboard | Insights" }];

export async function loader({ params }: LoaderFunctionArgs) {
	const accountId = params.accountId;
	const projectId = params.projectId;

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 });
	}

	return redirect(`/a/${accountId}/${projectId}`);
}

export default function DashboardPage() {
	return null;
}
