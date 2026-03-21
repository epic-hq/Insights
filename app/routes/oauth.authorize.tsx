/**
 * OAuth 2.1 Authorization Endpoint
 *
 * Standalone page that renders in a browser popup during the OAuth flow.
 * Claude Desktop, ChatGPT, and other MCP clients redirect here so the user
 * can authenticate, pick a project, and grant access.
 *
 * Implements Authorization Code Grant with PKCE (RFC 7636).
 */

import { useState } from "react";
import { Form, redirect } from "react-router";
import consola from "consola";
import type { Route } from "./+types/oauth.authorize";
import {
  getServerClient,
  createSupabaseAdminClient,
} from "~/lib/supabase/client.server";
import { createAuthorizationCode, validateClient } from "~/lib/oauth.server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OAuthParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  scope: string;
}

interface Project {
  id: string;
  name: string;
  account_id: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an error redirect URL per OAuth 2.1 spec (RFC 6749 section 4.1.2.1). */
function buildErrorRedirect(
  redirectUri: string,
  error: string,
  state: string,
  errorDescription?: string,
): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (errorDescription) {
    url.searchParams.set("error_description", errorDescription);
  }
  if (state) {
    url.searchParams.set("state", state);
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);

  // ---- Parse OAuth query params ----
  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state") ?? "";
  const scope = url.searchParams.get("scope") ?? "read write";

  // ---- Validate required params ----
  if (
    !responseType ||
    !clientId ||
    !redirectUri ||
    !codeChallenge ||
    !codeChallengeMethod
  ) {
    consola.warn("[oauth/authorize] Missing required OAuth parameters");
    throw new Response("Missing required OAuth parameters", { status: 400 });
  }

  if (responseType !== "code") {
    consola.warn("[oauth/authorize] Unsupported response_type:", responseType);
    throw new Response("Unsupported response_type. Only 'code' is supported.", {
      status: 400,
    });
  }

  if (codeChallengeMethod !== "S256") {
    consola.warn(
      "[oauth/authorize] Unsupported code_challenge_method:",
      codeChallengeMethod,
    );
    throw new Response(
      "Unsupported code_challenge_method. Only 'S256' is supported.",
      { status: 400 },
    );
  }

  // ---- Validate the client ----
  const adminSupabase = createSupabaseAdminClient();
  const client = await validateClient(adminSupabase, clientId);

  if (!client) {
    consola.warn("[oauth/authorize] Unknown client_id:", clientId);
    throw new Response("Unknown client_id", { status: 400 });
  }

  // ---- Validate redirect_uri against registered URIs ----
  const registeredUris: string[] = Array.isArray(client.redirect_uris)
    ? client.redirect_uris
    : [];

  if (!registeredUris.includes(redirectUri)) {
    consola.warn("[oauth/authorize] redirect_uri mismatch", {
      redirectUri,
      registeredUris,
    });
    throw new Response(
      "redirect_uri does not match any registered redirect URIs for this client",
      { status: 400 },
    );
  }

  // ---- Check authentication ----
  const { client: supabase, headers } = getServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login, preserving all OAuth params so we return here after auth
    const returnUrl = `/oauth/authorize?${url.searchParams.toString()}`;
    return redirect(`/login?redirect=${encodeURIComponent(returnUrl)}`, {
      headers,
    });
  }

  // ---- Fetch user's projects ----
  const { data: accounts } = await supabase.rpc("get_user_accounts");
  const accountsList = (Array.isArray(accounts) ? accounts : []) as Array<{
    account_id: string;
    personal_account?: boolean | null;
  }>;

  const accountIds = accountsList.map((a) => a.account_id);

  let projects: Project[] = [];
  if (accountIds.length > 0) {
    const { data: projectData } = await adminSupabase
      .from("projects")
      .select("id, name, account_id")
      .in("account_id", accountIds)
      .order("name");

    projects = (projectData ?? []) as Project[];
  }

  const clientName = client.client_name ?? "An application";

  return {
    projects,
    oauthParams: {
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      state,
      scope,
    } satisfies OAuthParams,
    clientName,
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  // ---- Read form fields ----
  const projectId = formData.get("projectId") as string;
  const clientId = formData.get("clientId") as string;
  const redirectUri = formData.get("redirectUri") as string;
  const codeChallenge = formData.get("codeChallenge") as string;
  const codeChallengeMethod = formData.get("codeChallengeMethod") as string;
  const state = formData.get("state") as string;
  const scope = formData.get("scope") as string;

  if (
    !projectId ||
    !clientId ||
    !redirectUri ||
    !codeChallenge ||
    !codeChallengeMethod
  ) {
    consola.warn("[oauth/authorize] Missing required form fields in action");
    throw new Response("Missing required form fields", { status: 400 });
  }

  // ---- Authenticate the user ----
  const { client: supabase, headers } = getServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Response("Not authenticated", { status: 401 });
  }

  // ---- Look up the project to get account_id ----
  const adminSupabase = createSupabaseAdminClient();
  const { data: project, error: projectError } = await adminSupabase
    .from("projects")
    .select("id, account_id")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    consola.error("[oauth/authorize] Project lookup failed", projectError);
    throw new Response("Project not found", { status: 400 });
  }

  // ---- Create authorization code ----
  const scopes = scope ? scope.split(" ").filter(Boolean) : ["read", "write"];

  const authCode = await createAuthorizationCode(adminSupabase, {
    clientId,
    userId: user.id,
    accountId: project.account_id,
    projectId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scopes,
  });

  // ---- Redirect back to the client ----
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", authCode);
  if (state) {
    callbackUrl.searchParams.set("state", state);
  }

  consola.info("[oauth/authorize] Authorization granted", {
    userId: user.id,
    projectId,
    clientId,
  });

  return redirect(callbackUrl.toString(), { headers });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OAuthAuthorize({ loaderData }: Route.ComponentProps) {
  const { projects, oauthParams, clientName } = loaderData;
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    projects.length === 1 ? projects[0].id : "",
  );
  const handleDeny = () => {
    const denyUrl = buildErrorRedirect(
      oauthParams.redirectUri,
      "access_denied",
      oauthParams.state,
      "The user denied the authorization request",
    );
    // Navigate away — this is a full-page redirect
    window.location.href = denyUrl;
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Header */}
          <div className="flex flex-col items-center gap-4 border-b border-gray-200 px-8 pt-8 pb-6 dark:border-gray-800">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <svg
                className="h-8 w-8 text-amber-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label="UpSight Logo"
              >
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <circle cx="12" cy="12" r="1" />
                <path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0" />
              </svg>
              <span className="font-semibold text-xl text-gray-900 dark:text-gray-100">
                UpSight
              </span>
            </div>

            <h1 className="text-center font-semibold text-lg text-gray-900 dark:text-gray-100">
              Connect to UpSight
            </h1>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {clientName}
              </span>{" "}
              wants to access your UpSight data
            </p>
          </div>

          {/* Body */}
          <Form method="post">
            {/* Hidden OAuth params */}
            <input type="hidden" name="clientId" value={oauthParams.clientId} />
            <input
              type="hidden"
              name="redirectUri"
              value={oauthParams.redirectUri}
            />
            <input
              type="hidden"
              name="codeChallenge"
              value={oauthParams.codeChallenge}
            />
            <input
              type="hidden"
              name="codeChallengeMethod"
              value={oauthParams.codeChallengeMethod}
            />
            <input type="hidden" name="state" value={oauthParams.state} />
            <input type="hidden" name="scope" value={oauthParams.scope} />
            <input type="hidden" name="projectId" value={selectedProjectId} />

            <div className="px-8 py-6">
              {/* Permissions notice */}
              <div className="mb-5 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                <p className="mb-2 font-medium text-sm text-gray-700 dark:text-gray-300">
                  This will allow access to:
                </p>
                <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                  {oauthParams.scope.includes("read") && (
                    <li className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 text-green-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Read your project data
                    </li>
                  )}
                  {oauthParams.scope.includes("write") && (
                    <li className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 text-green-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Create and modify data in your project
                    </li>
                  )}
                </ul>
              </div>

              {/* Project selector */}
              <div className="mb-6">
                <label
                  htmlFor="project-select"
                  className="mb-2 block font-medium text-sm text-gray-700 dark:text-gray-300"
                >
                  Select a project
                </label>

                {projects.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    You don't have any projects yet. Create a project in UpSight
                    first.
                  </p>
                ) : (
                  <select
                    id="project-select"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">Choose a project...</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-gray-200 px-8 py-6 dark:border-gray-800">
              <button
                type="button"
                onClick={handleDeny}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-sm text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Deny
              </button>
              <button
                type="submit"
                disabled={!selectedProjectId || projects.length === 0}
                className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-sm text-white shadow-sm transition-colors hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-700"
              >
                Allow
              </button>
            </div>
          </Form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
          You can revoke access at any time from your project settings.
        </p>
      </div>
    </div>
  );
}
