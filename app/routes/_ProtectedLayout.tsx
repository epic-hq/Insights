import consola from "consola";
import { Mail } from "lucide-react";
import type { PostHogConfig } from "posthog-js";
import { useEffect, useState } from "react";
import { Link, redirect, useLoaderData, useLocation, useNavigation, useParams } from "react-router";
import { TrialBanner, type TrialInfo } from "~/components/billing/TrialBanner";
import { type LimitExceededInfo, UpgradeLimitModal } from "~/components/billing/UpgradeLimitModal";
import { UsageLimitBanner, type UsageLimitInfo } from "~/components/billing/UsageLimitBanner";
import { AppLayout } from "~/components/layout/AppLayout";
import { OnboardingProvider } from "~/components/onboarding";
import { PLANS, type PlanId } from "~/config/plans";
import { AuthProvider } from "~/contexts/AuthContext";
import { CurrentProjectProvider } from "~/contexts/current-project-context";
import { getProjects } from "~/features/projects/db";
import { useDeviceDetection } from "~/hooks/useDeviceDetection";
import { provisionTrial } from "~/lib/billing/polar.server";
import { buildFeatureGateContext, checkLimitAccess } from "~/lib/feature-gate/check-limit.server";
import { isProjectRootPath, parseProjectRoute, writeLastProjectRoute } from "~/lib/last-project-route.client";
import { resolvePosthogHost } from "~/lib/posthog/config";
import { getAuthenticatedUser, getRlsClient, supabaseAdmin } from "~/lib/supabase/client.server";
import type { UserAccount } from "~/server/user-context";
import { userContext } from "~/server/user-context";
import type { UserSettings } from "~/types";
import type { Route } from "../+types/root";

// Server-side Authentication Middleware
// This middleware runs before every loader in protected routes
// It ensures the user is authenticated and sets up the user context
export const middleware: Route.MiddlewareFunction[] = [
	async ({ request, context, params }) => {
		try {
			const { user, headers: authHeaders } = await getAuthenticatedUser(request);
			// consola.log("middleware user", user?.aud, ": ", user?.sub, ": ", user?.email)
			if (!user) {
				// Preserve the original URL for deep linking after login
				const url = new URL(request.url);
				const redirectParam = encodeURIComponent(url.pathname + url.search);
				throw redirect(`/login?redirect=${redirectParam}`, {
					headers: authHeaders,
				});
			}

			// Extract JWT from normalized claims when available.
			const jwt =
				typeof user.jwt === "string" ? user.jwt : typeof user.access_token === "string" ? user.access_token : null;

			// Use RLS client if JWT is present, otherwise fallback to anon client
			const supabase = jwt
				? getRlsClient(jwt)
				: (await import("~/lib/supabase/client.server")).getServerClient(request).client;

			// Get user's settings and accounts in parallel
			const [userSettingsResult, userAccountsResult] = await Promise.all([
				supabase.from("user_settings").select("*").eq("user_id", user.sub).single(),
				supabase.rpc("get_user_accounts"),
			]);

			const user_settings = (userSettingsResult.data ?? null) as UserSettings | null;
			const { data: rawAccounts, error: accountsError } = userAccountsResult;
			const accounts = Array.isArray(rawAccounts) ? rawAccounts.filter(isUserAccount) : [];

			if (accountsError) {
				consola.error("Get user accounts error in middleware:", accountsError);
				throw redirect("/login");
			}

			// DEBUG: Log all accounts this user belongs to (use debug level to reduce noise)
			consola.debug("[AUTH MIDDLEWARE] User accounts:", {
				userId: user.sub,
				email: user.email,
				accountCount: accounts.length,
				accounts: accounts.map((acc) => ({
					accountId: acc.account_id,
					name: acc.name,
					personal: acc.personal_account,
					role: acc.account_role,
				})),
			});

			// Determine current account with priority:
			// 1. URL accountId param (if user has access)
			// 2. last_used_account_id from user_settings
			// 3. First non-personal account, or first account
			let currentAccount: UserAccount | null = null;

			// First priority: URL accountId param
			const urlAccountId = params.accountId;
			if (urlAccountId) {
				currentAccount = accounts.find((acc) => acc.account_id === urlAccountId) ?? null;
			}

			// Second priority: last_used_account_id from user_settings
			if (!currentAccount && user_settings?.last_used_account_id) {
				currentAccount = accounts.find((acc) => acc.account_id === user_settings.last_used_account_id) ?? null;
			}

			// Fallback: first non-personal account, or first account if only personal
			if (!currentAccount) {
				currentAccount = accounts.find((acc) => !acc.personal_account) || accounts[0] || null;
			}

			if (!currentAccount) {
				consola.error("No accounts found for user");
				throw redirect("/login");
			}

			// Set user context for all child loaders/actions to access
			context.set(userContext, {
				claims: user,
				account_id: currentAccount.account_id, // Use team account, not user.sub
				user_metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
				supabase,
				headers: request.headers,
				authHeaders, // Include auth headers for token refresh
				user_settings: user_settings ?? undefined,
				accounts,
				currentAccount,
			});
			// consola.log(
			// 	"_ProtectedLayout Authentication middleware success, {",
			// 	{
			// 		// user_settings,
			// 		// accounts,
			// 		currentAccount,
			// 	},
			// 	"\n"
			// )

			// Check if signup process is completed
			const signupCompleted = getSignupCompleted(user_settings);
			const signupChatRequired = process.env.SIGNUP_CHAT_REQUIRED === "true";
			if (signupChatRequired && !signupCompleted) {
				consola.log("Signup not completed. Redirecting to signup-chat.", {
					signupCompleted,
					signupChatRequired,
				});
				throw redirect("/signup-chat");
			}

			// Check if user has any projects, if not redirect to onboarding
			const projectsResult = await getProjects({
				supabase,
				accountId: currentAccount.account_id,
			});

			const userProjects = projectsResult.data || [];
			if (userProjects.length === 0) {
				// Check current path to avoid redirect loops
				const url = new URL(request.url);
				const pathname = url.pathname;
				const hasInviteToken = url.searchParams.has("invite_token");
				const isTeamManagePage = pathname.includes("/team/manage");

				// Don't redirect if:
				// - Already in onboarding or project creation
				// - Has an invite token on team manage page (let loader accept invitation)
				if (
					!pathname.includes("/projects/new") &&
					!pathname.includes("onboarding=true") &&
					!pathname.includes("/home") &&
					!(hasInviteToken && isTeamManagePage)
				) {
					consola.log("No projects found. Redirecting to account home.");
					throw redirect(`/a/${currentAccount.account_id}/home`);
				}
			}

			// consola.log("User authenticated and has projects.")
			// Continue without redirect for normal flow
		} catch (error) {
			// Preserve intended redirects thrown above (e.g., to /signup-chat)
			if (error instanceof Response) {
				throw error;
			}
			consola.error("_ProtectedLayout Authentication middleware error:", error);
			throw redirect("/login");
		}
	},
];

type PendingInvite = {
	account_id: string;
	account_name: string | null;
	account_role: string;
	token: string;
};

function isUserAccount(value: unknown): value is UserAccount {
	if (!value || typeof value !== "object") return false;
	return typeof (value as { account_id?: unknown }).account_id === "string";
}

function getSignupCompleted(userSettings: UserSettings | null): boolean {
	const signupData = userSettings?.signup_data;
	if (!signupData || typeof signupData !== "object" || Array.isArray(signupData)) {
		return false;
	}

	return signupData.completed === true;
}

function getUserJobFunction(userSettings: UserSettings | null): string | null {
	const metadata = userSettings?.metadata;
	if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
		const metadataJobFunction = (metadata as Record<string, unknown>).job_function;
		if (typeof metadataJobFunction === "string" && metadataJobFunction.length > 0) {
			return metadataJobFunction;
		}
	}

	if (typeof userSettings?.role === "string" && userSettings.role.length > 0) {
		return userSettings.role;
	}

	return null;
}

export async function loader({ context }: Route.LoaderArgs) {
	try {
		// const loadContextInstance = context.get(loadContext)
		// const { lang } = loadContextInstance
		const user = context.get(userContext);
		if (!user.claims) {
			throw redirect("/login");
		}
		const userClaims = user.claims;

		// Use the current account from middleware context (respects last_used_account_id priority)
		const currentAccountId = user.currentAccount?.account_id || user.account_id;

		// Check for pending invitations for this user's email
		let pendingInvites: PendingInvite[] = [];
		if (user.supabase) {
			try {
				const { data: rawInvites } = await user.supabase.rpc("list_invitations_for_current_user");
				if (Array.isArray(rawInvites)) {
					pendingInvites = rawInvites as PendingInvite[];
				} else if (rawInvites) {
					const parsed = JSON.parse(String(rawInvites));
					if (Array.isArray(parsed)) {
						pendingInvites = parsed as PendingInvite[];
					}
				}
			} catch (inviteError) {
				consola.debug("[PROTECTED_LAYOUT] Failed to fetch pending invites:", inviteError);
			}
		}

		// Check for existing subscription or provision free trial (once per user)
		let trialInfo: TrialInfo = {
			isOnTrial: false,
			planName: "",
			trialEnd: null,
			accountId: currentAccountId,
		};
		try {
			// First check if current account has ANY subscription
			const { data: subscription, error: subError } = await supabaseAdmin
				.schema("accounts")
				.from("billing_subscriptions")
				.select("id, plan_name, status, trial_end")
				.eq("account_id", currentAccountId)
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle();

			if (subError) {
				consola.error("[PROTECTED_LAYOUT] Error fetching subscription", subError);
			}

			if (subscription) {
				// Account has subscription - check if it's trialing
				if (subscription.status === "trialing") {
					const planKey = subscription.plan_name?.toLowerCase() as PlanId;
					trialInfo = {
						isOnTrial: true,
						planName: PLANS[planKey]?.name ?? subscription.plan_name ?? "Pro",
						trialEnd: subscription.trial_end,
						accountId: currentAccountId,
					};
				}
				// If active/canceled/etc, trialInfo stays as default (not on trial)
			} else {
				// No subscription for current account - check if we should provision trial
				// Only provision ONCE per user (check user_settings flag)
				const trialProvisioned = user.user_settings?.legacy_trial_provisioned_at;

				if (!trialProvisioned) {
					// IMPORTANT: Provision trial to user's OWNED team account, not current account
					// This ensures trials go to the team the user owns, not to invited teams
					const ownedTeamAccount = (user.accounts || []).find((acc) => !acc.personal_account && acc.is_primary_owner);

					if (ownedTeamAccount) {
						// Check if owned team already has subscription
						const { data: existingSub } = await supabaseAdmin
							.schema("accounts")
							.from("billing_subscriptions")
							.select("id")
							.eq("account_id", ownedTeamAccount.account_id)
							.maybeSingle();

						if (!existingSub) {
							consola.info("[PROTECTED_LAYOUT] No subscription on owned team, provisioning trial", {
								ownedTeamAccountId: ownedTeamAccount.account_id,
								ownedTeamName: ownedTeamAccount.name,
								currentAccountId,
								userEmail: userClaims.email,
							});

							const trial = await provisionTrial({
								accountId: ownedTeamAccount.account_id,
								email: typeof userClaims.email === "string" ? userClaims.email : undefined,
								planId: "pro", // Give new users Pro trial
							});

							if (trial) {
								// Mark user as having received trial
								await supabaseAdmin
									.from("user_settings")
									.update({
										legacy_trial_provisioned_at: new Date().toISOString(),
									})
									.eq("user_id", userClaims.sub);

								// Only show trial info if the owned team is the current account
								if (ownedTeamAccount.account_id === currentAccountId) {
									trialInfo = {
										isOnTrial: trial.isOnTrial,
										planName: trial.planName,
										trialEnd: trial.trialEnd,
										accountId: ownedTeamAccount.account_id,
									};
								}

								consola.info("[PROTECTED_LAYOUT] Trial provisioned", {
									accountId: ownedTeamAccount.account_id,
									trialEnd: trial.trialEnd,
								});
							}
						} else {
							consola.debug("[PROTECTED_LAYOUT] Owned team already has subscription, marking trial as provisioned", {
								ownedTeamAccountId: ownedTeamAccount.account_id,
							});
							// Mark as provisioned so we don't keep checking
							await supabaseAdmin
								.from("user_settings")
								.update({
									legacy_trial_provisioned_at: new Date().toISOString(),
								})
								.eq("user_id", userClaims.sub);
						}
					} else {
						consola.debug("[PROTECTED_LAYOUT] User has no owned team account, skipping trial provisioning", {
							userId: userClaims.sub,
						});
					}
				} else {
					consola.debug("[PROTECTED_LAYOUT] Trial already provisioned, skipping", {
						provisionedAt: trialProvisioned,
					});
				}
			}
		} catch (trialError) {
			consola.error("[PROTECTED_LAYOUT] Failed to check/provision trial:", trialError);
		}

		// Check usage limits for banner/modal
		let usageLimitInfo: UsageLimitInfo = {
			isApproaching: false,
			limitName: "",
			currentUsage: 0,
			limit: 0,
			percentUsed: 0,
			accountId: currentAccountId,
		};
		let limitExceededInfo: LimitExceededInfo = {
			isExceeded: false,
			limitName: "",
			currentUsage: 0,
			limit: 0,
			accountId: currentAccountId,
		};
		try {
			const gateCtx = await buildFeatureGateContext(currentAccountId, userClaims.sub);
			const aiCheck = await checkLimitAccess(gateCtx, "ai_analyses");

			if (!aiCheck.allowed && aiCheck.reason === "limit_exceeded") {
				limitExceededInfo = {
					isExceeded: true,
					limitName: "AI Analyses",
					currentUsage: aiCheck.currentUsage ?? 0,
					limit: aiCheck.limit ?? 0,
					accountId: currentAccountId,
					requiredPlan: aiCheck.requiredPlan,
				};
			} else if (aiCheck.reason === "limit_approaching" && aiCheck.percentUsed) {
				usageLimitInfo = {
					isApproaching: true,
					limitName: "AI analyses",
					currentUsage: aiCheck.currentUsage ?? 0,
					limit: aiCheck.limit ?? 0,
					percentUsed: Math.round(aiCheck.percentUsed),
					accountId: currentAccountId,
				};
			}
		} catch (limitError) {
			consola.debug("[PROTECTED_LAYOUT] Failed to check usage limits:", limitError);
		}

		const responseData = {
			// lang,
			auth: {
				user: userClaims,
				accountId: currentAccountId, // Use team account ID, not user ID
			},
			accounts: user.accounts || [],
			user_settings: user.user_settings || null,
			pendingInvites,
			trialInfo,
			usageLimitInfo,
			limitExceededInfo,
		};

		// Include auth headers (for token refresh) in the response if present
		if (user.authHeaders) {
			return Response.json(responseData, { headers: user.authHeaders });
		}

		return responseData;
	} catch (error) {
		consola.error("Protected layout loader error:", error);
		throw redirect("/login");
	}
}

export default function ProtectedLayout() {
	const { auth, accounts, user_settings, pendingInvites, trialInfo, usageLimitInfo, limitExceededInfo } =
		useLoaderData<typeof loader>();
	const [showLimitModal, setShowLimitModal] = useState(true);
	const _params = useParams();
	const navigation = useNavigation();
	const location = useLocation();
	const { isMobile } = useDeviceDetection();

	const [posthogProvider, setPosthogProvider] = useState<React.ComponentType<{
		apiKey: string;
		options?: Partial<PostHogConfig>;
		children: React.ReactNode;
	}> | null>(null);
	const [posthogClient, setPosthogClient] = useState<typeof import("posthog-js") | null>(null);

	if (!auth.user) {
		return null;
	}
	const authUser = auth.user;

	const posthogKey =
		typeof window !== "undefined" &&
		typeof window.env?.POSTHOG_KEY === "string" &&
		window.env.POSTHOG_KEY.trim().length > 0
			? window.env.POSTHOG_KEY.trim()
			: null;
	const posthogHost =
		typeof window !== "undefined" ? resolvePosthogHost(window.env?.POSTHOG_HOST) : resolvePosthogHost(undefined);

	// Lazy-load client analytics only inside protected app shell.
	useEffect(() => {
		let cancelled = false;

		if (!posthogKey) return;

		void (async () => {
			const [{ PostHogProvider }, ph] = await Promise.all([import("posthog-js/react"), import("posthog-js")]);

			if (cancelled) return;
			setPosthogProvider(() => PostHogProvider);
			setPosthogClient(ph);
		})();

		return () => {
			cancelled = true;
		};
	}, [posthogKey]);

	// Don't show invite banner on accept-invite page
	const isAcceptInvitePage = location.pathname.includes("/accept-invite");
	const showInviteBanner = pendingInvites.length > 0 && !isAcceptInvitePage;

	const isLoading = navigation.state === "loading";

	// Don't show JourneyNav on home route, project creation, and realtime routes
	const isHomePage = location.pathname === "/home" || location.pathname.match(/^\/a\/[^/]+\/home$/);
	const isProjectNew = location.pathname.includes("/projects/new");
	const isRealtimePage = location.pathname.includes("/realtime");
	const showJourneyNav = !isHomePage && !isProjectNew && !isRealtimePage;

	// Persist last in-project location so project root can resume where the user was working.
	useEffect(() => {
		const parsed = parseProjectRoute(location.pathname);
		if (!parsed) return;
		if (isProjectRootPath(location.pathname)) return;
		writeLastProjectRoute(`${location.pathname}${location.search}${location.hash}`);
	}, [location.pathname, location.search, location.hash]);

	useEffect(() => {
		if (!posthogClient) return;

		const ph = posthogClient.default;
		if (!ph) return;

		// Disable PostHog surveys (and keep disabled until we explicitly enable later)
		if (ph.config) {
			ph.config.disable_surveys = true;
		}

		// Identify user with person properties
		const identifyProps: Record<string, unknown> = {
			email: authUser.email,
			full_name: authUser.user_metadata?.full_name,
		};

		const jobFunction = getUserJobFunction(user_settings);
		if (jobFunction) {
			identifyProps.job_function = jobFunction;
		}
		if (user_settings?.company_name) {
			identifyProps.company_name = user_settings.company_name;
		}

		ph.identify(authUser.sub, identifyProps);

		if (auth.accountId) {
			ph.group("account", auth.accountId, {
				plan: "free",
				seats: accounts?.length || 1,
			});
		}
	}, [posthogClient, authUser, auth.accountId, user_settings, accounts]);

	const content = (
		<AuthProvider user={authUser} organizations={accounts} user_settings={user_settings ?? undefined}>
			<CurrentProjectProvider>
				<OnboardingProvider>
					<div className="flex h-screen flex-col overflow-hidden bg-background">
						{/* Trial Banner */}
						<TrialBanner trial={trialInfo} />

						{/* Usage Limit Warning Banner (80%+) */}
						<UsageLimitBanner usage={usageLimitInfo} />

						{/* Upgrade Modal (100%) */}
						<UpgradeLimitModal
							info={limitExceededInfo}
							open={showLimitModal && limitExceededInfo.isExceeded}
							onOpenChange={setShowLimitModal}
						/>

						{/* Pending Invite Banner */}
						{showInviteBanner && (
							<div className="border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/50">
								<div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
									<div className="flex items-center gap-2 text-emerald-800 text-sm dark:text-emerald-200">
										<Mail className="h-4 w-4" />
										<span>
											You have {pendingInvites.length} pending team{" "}
											{pendingInvites.length === 1 ? "invitation" : "invitations"}
											{pendingInvites[0]?.account_name && (
												<span>
													{" "}
													from <strong>{pendingInvites[0].account_name}</strong>
												</span>
											)}
										</span>
									</div>
									<Link
										to={`/accept-invite?invite_token=${encodeURIComponent(pendingInvites[0]?.token || "")}`}
										className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-sm text-white transition-colors hover:bg-emerald-700"
									>
										Accept Invitation
									</Link>
								</div>
							</div>
						)}

						{/* Global Loading Indicator */}
						{isLoading && (
							<div className="fixed top-0 right-0 left-0 z-50 h-1 bg-gray-200">
								<div className="h-full animate-pulse bg-blue-600" style={{ width: "30%" }}>
									<div className="h-full animate-[loading_2s_ease-in-out_infinite] bg-gradient-to-r from-blue-600 to-blue-400" />
								</div>
							</div>
						)}

						<AppLayout showJourneyNav={showJourneyNav} />
					</div>
				</OnboardingProvider>
			</CurrentProjectProvider>
		</AuthProvider>
	);

	if (!posthogKey || !posthogProvider) {
		return content;
	}

	const PostHogProvider = posthogProvider;
	return (
		<PostHogProvider
			apiKey={posthogKey}
			options={{
				api_host: posthogHost,
				ui_host: "https://us.posthog.com",
				defaults: "2025-05-24",
				debug: false,
				capture_exceptions: true,
				disable_session_recording: false,
				disable_surveys: true,
				session_recording: {
					// Mask all text inputs to avoid capturing passwords/PII in replays
					maskAllInputs: true,
					// Mask all text content by default for privacy — can relax later
					maskTextSelector: "[data-ph-mask]",
					// Capture network requests for debugging (headers/bodies excluded)
					recordHeaders: false,
					recordBody: false,
				},
			}}
		>
			{content}
		</PostHogProvider>
	);
}
