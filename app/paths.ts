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
