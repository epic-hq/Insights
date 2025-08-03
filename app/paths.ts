const AUTH = {
	LOGIN: "/login",
	REGISTER: "/register",
	LOGOUT: "/logout",
	CALLBACK: "/auth/callback",
} as const

export const PATHS = {
	DASHBOARD: "/dashboard",
	INTERVIEWS: "/interviews",
	PEOPLE: "/people",
	INSIGHTS: "/insights",
	AUTO_INSIGHTS: "/insights/auto",
	OPPORTUNITIES: "/opportunities",
	PERSONAS: "/personas",
	PROJECTS: "/projects",
	ABOUT: "/about",
	AUTH,
} as const

export const aPath = (accountId: string, projectId: string, subPath = "") =>
	`/a/${accountId}/${projectId}${subPath}`

/**
 * Generates a project/account-scoped path for any feature route key in PATHS.
 * Example: projectPath("DASHBOARD", accountId, projectId) => /a/{accountId}/{projectId}/dashboard
 */
export function projectPath(
	path: keyof typeof PATHS,
	accountId: string,
	projectId: string,
	subPath = ""
) {
	return `/a/${accountId}/${projectId}${PATHS[path]}${subPath}`
}
