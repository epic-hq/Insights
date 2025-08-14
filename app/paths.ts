// need to add acheck for if env NODE_ENV=development then set HOST to localhost, else "upsight.fly.dev"

const HOST = process.env.NODE_ENV === "development" ? "http://localhost:4280" : "https://upsight.fly.dev"

const AUTH = {
	LOGIN: "/login",
	REGISTER: "/register",
	LOGOUT: "/logout",
	CALLBACK: "/auth/callback",
	HOST,
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
	PROFILE: "/profile",
	HOME: "/home",
} as const
