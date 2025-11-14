import type { Decorator } from "@storybook/react"
import React from "react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { CurrentProjectProvider } from "~/contexts/current-project-context"

/**
 * Minimal router decorator for Storybook
 * Provides React Router context so hooks like useLoaderData work
 * Also provides CurrentProject context for pages that need it
 */
export const withRouter: Decorator = (Story, context) => {
	// Get mock loader data from story parameters
	const loaderData = context.parameters?.loaderData || {}

	// Get mock project context from story parameters (optional)
	const mockProjectContext = context.parameters?.projectContext || {
		projectPath: "/a/acc-1/proj-1",
		accountId: "acc-1",
		projectId: "proj-1",
	}

	// Create a simple memory router with the story as the only route
	const router = createMemoryRouter([
		{
			path: "/",
			element: (
				<CurrentProjectProvider value={mockProjectContext}>
					<Story />
				</CurrentProjectProvider>
			),
			loader: () => loaderData, // Return mock data
		},
	])

	return <RouterProvider router={router} />
}
