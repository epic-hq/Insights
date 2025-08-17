import { useMemo } from "react"
import { createRouteDefinitions } from "~/utils/route-definitions"

/**
 * Type-safe route builder hook that handles all project-scoped routes
 * Uses shared route definitions to maintain single source of truth
 */
export function useProjectRoutes(projectPath = "") {
	return useMemo(() => {
		return createRouteDefinitions(projectPath)
	}, [projectPath])
}

/**
 * Hook that creates project routes from accountId and projectId
 * @param accountId - Account ID
 * @param projectId - Project ID
 */
export function useProjectRoutesFromIds(accountId: string, projectId: string) {
	return useMemo(() => {
		const projectPath = `/a/${accountId}/${projectId}`
		return createRouteDefinitions(projectPath)
	}, [accountId, projectId])
}

/**
 * Type definitions for better IDE support
 */
export type RouteBuilder = ReturnType<typeof useProjectRoutes>
export type InterviewRoutes = RouteBuilder["interviews"]
export type InsightRoutes = RouteBuilder["insights"]
export type PeopleRoutes = RouteBuilder["people"]
export type PersonaRoutes = RouteBuilder["personas"]
export type OpportunityRoutes = RouteBuilder["opportunities"]
export type ProjectRoutes = RouteBuilder["projects"]
export type AuthRoutes = RouteBuilder["auth"]
export type ApiRoutes = RouteBuilder["api"]
