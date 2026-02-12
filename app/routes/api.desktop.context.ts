import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticateDesktopRequest } from "~/lib/auth/desktop-auth.server";

/**
 * GET /api/desktop/context
 * Returns the user's accounts and projects for the desktop app selection UI.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const auth = await authenticateDesktopRequest(request);
	if (!auth) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { supabase, user } = auth;

	try {
		// Get user's accounts using the RPC function
		const { data: accounts, error: accountsError } = await supabase.rpc("get_user_accounts");

		if (accountsError) {
			console.error("Failed to get accounts:", accountsError);
			return Response.json({ error: "Failed to get accounts" }, { status: 500 });
		}

		// Get projects for each account
		const accountsArray = (Array.isArray(accounts) ? accounts : []) as Array<{
			account_id: string;
			name: string;
			personal_account: boolean;
		}>;
		const accountIds = accountsArray.map((a) => a.account_id);
		const { data: projects, error: projectsError } = await supabase
			.from("projects")
			.select("id, name, slug, account_id, created_at")
			.in("account_id", accountIds)
			.order("created_at", { ascending: false });

		if (projectsError) {
			console.error("Failed to get projects:", projectsError);
			return Response.json({ error: "Failed to get projects" }, { status: 500 });
		}

		// Get user's last used preferences
		const { data: userSettings } = await supabase
			.from("user_settings")
			.select("last_used_account_id, last_used_project_id")
			.eq("user_id", user.id)
			.single();

		// Determine default account/project (last used, or first available)
		const defaultAccountId =
			userSettings?.last_used_account_id || (accountsArray.length > 0 ? accountsArray[0].account_id : null);
		const defaultProjectId =
			userSettings?.last_used_project_id || (projects && projects.length > 0 ? projects[0].id : null);

		return Response.json({
			user: {
				id: user.id,
				email: user.email,
				name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
			},
			accounts: accountsArray.map((a) => ({
				id: a.account_id,
				name: a.name,
				personal: a.personal_account,
			})),
			projects: (projects || []).map((p) => ({
				id: p.id,
				name: p.name,
				slug: p.slug,
				accountId: p.account_id,
			})),
			// Desktop app expects these field names
			default_account_id: defaultAccountId,
			default_project_id: defaultProjectId,
		});
	} catch (error) {
		console.error("Context fetch error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/desktop/context
 * Persists desktop-selected account/project context for the authenticated user.
 */
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const auth = await authenticateDesktopRequest(request);
	if (!auth) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { supabase, user } = auth;

	try {
		const body = (await request.json().catch(() => ({}))) as {
			account_id?: string;
			project_id?: string;
		};

		const accountId = (body.account_id || "").trim();
		const projectId = (body.project_id || "").trim();

		if (!accountId || !projectId) {
			return Response.json({ error: "Missing account_id or project_id" }, { status: 400 });
		}

		// Ensure the selected account belongs to the user
		const { data: accounts, error: accountsError } = await supabase.rpc("get_user_accounts");
		if (accountsError) {
			console.error("Failed to get accounts:", accountsError);
			return Response.json({ error: "Failed to validate account" }, { status: 500 });
		}

		const accountsArray = (Array.isArray(accounts) ? accounts : []) as Array<{
			account_id: string;
		}>;
		const hasAccount = accountsArray.some((a) => a.account_id === accountId);
		if (!hasAccount) {
			return Response.json({ error: "Account not accessible" }, { status: 403 });
		}

		// Ensure project belongs to selected account
		const { data: project, error: projectError } = await supabase
			.from("projects")
			.select("id, account_id")
			.eq("id", projectId)
			.eq("account_id", accountId)
			.single();

		if (projectError || !project) {
			return Response.json({ error: "Project not found for selected account" }, { status: 400 });
		}

		const { error: settingsError } = await supabase.from("user_settings").upsert(
			{
				user_id: user.id,
				last_used_account_id: accountId,
				last_used_project_id: projectId,
			},
			{ onConflict: "user_id" }
		);

		if (settingsError) {
			console.error("Failed to update user settings:", settingsError);
			return Response.json({ error: "Failed to persist context selection" }, { status: 500 });
		}

		return Response.json({
			success: true,
			default_account_id: accountId,
			default_project_id: projectId,
		});
	} catch (error) {
		console.error("Context update error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
