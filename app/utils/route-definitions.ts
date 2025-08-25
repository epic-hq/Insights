/**
 * Single source of truth for all route definitions
 * Used by both client-side hooks and server-side utilities
 */

import { PATHS } from "~/paths"

function extractAccountId(projectPath: string): string {
	const match = projectPath.match(/^\/a\/([^/]+)/)
	return match ? match[1] : ""
}

export interface RouteDefinitions {
	home: () => string
	login: () => string
	register: () => string

	// Dashboard
	dashboard: () => string

	// Interviews
	interviews: {
		index: () => string
		onboard: () => string
		new: () => string
		detail: (id: string) => string
		edit: (id: string) => string
	}

	// Themes
	themes: {
		index: () => string
		new: () => string
		detail: (id: string) => string
		edit: (id: string) => string
	}

	// Insights
	insights: {
		index: () => string
		quick: () => string
		table: () => string
		cards: () => string
		map: () => string
		autoInsights: () => string
		new: () => string
		detail: (id: string) => string
		edit: (id: string) => string
		withSort: (sort: string) => string
	}

	// People
	people: {
		index: () => string
		new: () => string
		detail: (id: string) => string
		edit: (id: string) => string
	}

	// Personas
	personas: {
		index: () => string
		new: () => string
		detail: (id: string) => string
		edit: (id: string) => string
		interview: (personaId: string, interviewId: string) => string
	}

	// Opportunities
	opportunities: {
		index: () => string
		new: () => string
		detail: (id: string) => string
		edit: (id: string) => string
	}

	// Projects (note: these are at account level, not project level)
	projects: {
		index: () => string
		new: () => string
		detail: (id: string) => string
		edit: (id: string) => string
		dashboard: (id: string) => string
	}

	// Authentication
	auth: {
		login: () => string
		register: () => string
		loginSuccess: () => string
		callback: () => string
		signout: () => string
	}

	// API routes
	api: {
		uploadFile: () => string
		uploadFromUrl: () => string
		generatePersonaInsights: () => string
		interviewStatus: () => string
		generatePersonas: () => string
		insightsUpdateField: () => string
		// Annotations API routes (project-scoped)
		annotations: () => string
		votes: () => string
		entityFlags: () => string
	}
}

/**
 * Creates route definitions for a given project path
 * @param projectPath - Format: /a/:accountId/:projectId
 */
export function createRouteDefinitions(projectPath = ""): RouteDefinitions {
	const base = projectPath

	return {
		// Marketing
		home: () => PATHS.HOME,
		login: () => PATHS.AUTH.LOGIN,
		register: () => PATHS.AUTH.REGISTER,

		// Dashboard
		dashboard: () => `${base}/dashboard`,

		// Interviews
		interviews: {
			index: () => `${base}/interviews`,
			onboard: () => `${base}/interviews/onboard`,
			new: () => `${base}/interviews/new`,
			detail: (id: string) => `${base}/interviews/${id}`,
			edit: (id: string) => `${base}/interviews/${id}/edit`,
		},

		// Themes
		themes: {
			index: () => `${base}/themes`,
			new: () => `${base}/themes/new`,
			detail: (id: string) => `${base}/themes/${id}`,
			edit: (id: string) => `${base}/themes/${id}/edit`,
		},

		// Insights
		insights: {
			index: () => `${base}/insights`,
			quick: () => `${base}/insights/quick`,
			table: () => `${base}/insights/table`,
			cards: () => `${base}/insights/cards`,
			map: () => `${base}/insights/map`,
			autoInsights: () => `${base}/insights/auto-insights`,
			new: () => `${base}/insights/new`,
			detail: (id: string) => `${base}/insights/${id}`,
			edit: (id: string) => `${base}/insights/${id}/edit`,
			// Query parameter helpers
			withSort: (sort: string) => `${base}/insights/?sort=${sort}`,
		},

		// People
		people: {
			index: () => `${base}/people`,
			new: () => `${base}/people/new`,
			detail: (id: string) => `${base}/people/${id}`,
			edit: (id: string) => `${base}/people/${id}/edit`,
		},

		// Personas
		personas: {
			index: () => `${base}/personas`,
			new: () => `${base}/personas/new`,
			detail: (id: string) => `${base}/personas/${id}`,
			edit: (id: string) => `${base}/personas/${id}/edit`,
			interview: (personaId: string, interviewId: string) => `${base}/personas/${personaId}/interviews/${interviewId}`,
		},

		// Opportunities
		opportunities: {
			index: () => `${base}/opportunities`,
			new: () => `${base}/opportunities/new`,
			detail: (id: string) => `${base}/opportunities/${id}`,
			edit: (id: string) => `${base}/opportunities/${id}/edit`,
		},

		// Projects (note: these are at account level, not project level)
		projects: {
			index: () => `/a/${extractAccountId(projectPath)}/projects`,
			new: () => `/a/${extractAccountId(projectPath)}/projects/new`,
			detail: (id: string) => `/a/${extractAccountId(projectPath)}/${id}`,
			edit: (id: string) => `/a/${extractAccountId(projectPath)}/projects/${id}/edit`,
			dashboard: (id: string) => `/a/${extractAccountId(projectPath)}/${id}/dashboard`,
		},

		// Authentication
		auth: {
			login: () => "/login",
			register: () => "/register",
			loginSuccess: () => "/login_success",
			callback: () => "/auth/callback",
			signout: () => "/auth/signout",
		},

		// API routes
		api: {
			uploadFile: () => "/api/upload-file",
			uploadFromUrl: () => "/api/upload-from-url",
			generatePersonaInsights: () => "/api/generate-persona-insights",
			interviewStatus: () => "/api/interview-status",
			generatePersonas: () => `${base}/personas/api/generate-personas`,
			insightsUpdateField: () => `${base}/insights/api/update-field`,
			annotations: () => `${base}/api/annotations`,
			votes: () => `${base}/api/votes`,
			entityFlags: () => `${base}/api/entity-flags`,
		},
	}
}
