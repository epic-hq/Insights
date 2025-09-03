import type { RouteConfig } from "@react-router/dev/routes"

// No top-level /onboarding routes. Onboarding lives inside project paths:
// - /a/:accountId/:projectId/setup (goals)
// - /a/:accountId/:projectId/interviews/upload (upload)
// This file intentionally exports an empty config to avoid global routes.
export default [] satisfies RouteConfig
