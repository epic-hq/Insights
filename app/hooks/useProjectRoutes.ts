import { useMemo } from "react"

/**
 * Type-safe route builder hook that handles all project-scoped routes
 * Accounts for projectPath context and provides consistent URL generation
 */
export function useProjectRoutes(projectPath = "") {
  return useMemo(() => {
    const base = projectPath

    return {
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

      // Insights
      insights: {
        index: () => `${base}/insights`,
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
        interview: (personaId: string, interviewId: string) => 
          `${base}/personas/${personaId}/interviews/${interviewId}`,
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
        detail: (id: string) => `/a/${extractAccountId(projectPath)}/projects/${id}`,
        edit: (id: string) => `/a/${extractAccountId(projectPath)}/projects/${id}/edit`,
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
        generatePersonas: () => "/api.generate-personas",
        insightsUpdateField: () => `${base}/insights/api/update-field`,
      },
    }
  }, [projectPath])
}

/**
 * Extract account ID from project path
 * Expected format: /a/{accountId}/{projectId}
 */
function extractAccountId(projectPath: string): string {
  const match = projectPath.match(/^\/a\/([^\/]+)/)
  return match?.[1] || ""
}

/**
 * Type definitions for better IDE support
 */
export type RouteBuilder = ReturnType<typeof useProjectRoutes>
export type InterviewRoutes = RouteBuilder['interviews']
export type InsightRoutes = RouteBuilder['insights']
export type PeopleRoutes = RouteBuilder['people']
export type PersonaRoutes = RouteBuilder['personas']
export type OpportunityRoutes = RouteBuilder['opportunities']
export type ProjectRoutes = RouteBuilder['projects']
export type AuthRoutes = RouteBuilder['auth']
export type ApiRoutes = RouteBuilder['api']
