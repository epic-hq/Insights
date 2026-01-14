import type { LoaderFunctionArgs } from "react-router";
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
    const { data: accounts, error: accountsError } =
      await supabase.rpc("get_user_accounts");

    if (accountsError) {
      console.error("Failed to get accounts:", accountsError);
      return Response.json(
        { error: "Failed to get accounts" },
        { status: 500 },
      );
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
      return Response.json(
        { error: "Failed to get projects" },
        { status: 500 },
      );
    }

    // Get user's last used preferences
    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("last_used_account_id, last_used_project_id")
      .eq("user_id", user.id)
      .single();

    // Determine default account/project (last used, or first available)
    const defaultAccountId =
      userSettings?.last_used_account_id ||
      (accountsArray.length > 0 ? accountsArray[0].account_id : null);
    const defaultProjectId =
      userSettings?.last_used_project_id ||
      (projects && projects.length > 0 ? projects[0].id : null);

    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        name:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email,
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
