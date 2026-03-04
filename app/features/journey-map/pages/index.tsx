/**
 * Journey Map page - Visualizes user's research journey progress.
 * Shows "Steps to Wow" for new projects, full journey map for established ones.
 */

export const handle = { fullWidth: true, hideProjectStatusAgent: true };

import { useLoaderData } from "react-router";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useJourneyProgress } from "~/hooks/useJourneyProgress";
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes";
import { useSidebarCounts } from "~/hooks/useSidebarCounts";
import { userContext } from "~/server/user-context";
import { JourneyMapView } from "../components/JourneyMapView";
import type { WowPath, WowSettings } from "../journey-config";
import type { Route } from "./+types/index";

export async function loader({ context, params }: Route.LoaderArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;
	const projectId = params.projectId;

	if (!projectId) {
		throw new Response("Project ID required", { status: 400 });
	}

	const { data: project } = await supabase.from("projects").select("project_settings").eq("id", projectId).single();

	const settings = (project?.project_settings ?? {}) as Record<string, unknown>;

	const wowSettings: WowSettings = {
		wow_path: (settings.wow_path as WowPath | "full_setup" | null) ?? null,
		wow_steps_completed: Array.isArray(settings.wow_steps_completed) ? (settings.wow_steps_completed as number[]) : [],
	};

	return { wowSettings };
}

export async function action({ request, context, params }: Route.ActionArgs) {
	const ctx = context.get(userContext);
	const supabase = ctx.supabase;
	const projectId = params.projectId;

	if (!projectId) {
		throw new Response("Project ID required", { status: 400 });
	}

	const formData = await request.formData();
	const actionType = formData.get("_action");

	// Fetch current settings to merge
	const { data: project } = await supabase.from("projects").select("project_settings").eq("id", projectId).single();

	const currentSettings = (project?.project_settings ?? {}) as Record<string, unknown>;

	if (actionType === "set_wow_path") {
		const wowPath = formData.get("wow_path") as string;
		const updatedSettings = {
			...currentSettings,
			wow_path: wowPath,
			wow_steps_completed: [],
		};

		await supabase.from("projects").update({ project_settings: updatedSettings }).eq("id", projectId);

		return { ok: true };
	}

	if (actionType === "reset_wow_path") {
		const { wow_path: _, wow_steps_completed: __, ...rest } = currentSettings;
		await supabase.from("projects").update({ project_settings: rest }).eq("id", projectId);

		return { ok: true };
	}

	if (actionType === "advance_wow_step") {
		const stepsRaw = formData.get("wow_steps_completed") as string;
		const steps = JSON.parse(stepsRaw) as number[];
		const updatedSettings = {
			...currentSettings,
			wow_steps_completed: steps,
		};

		await supabase.from("projects").update({ project_settings: updatedSettings }).eq("id", projectId);

		return { ok: true };
	}

	return { ok: false };
}

export default function JourneyMapPage() {
	const { accountId, projectId } = useCurrentProject();
	const routes = useProjectRoutesFromIds(accountId, projectId);
	const { counts } = useSidebarCounts(accountId, projectId);
	const { progress } = useJourneyProgress(projectId);

	// StepsToWow is deprecated — agent-first experience owns onboarding now.
	// Always show JourneyMapView directly.
	return <JourneyMapView routes={routes} counts={counts} journeyProgress={progress} />;
}
