import type { Decorator } from "@storybook/react"
import React from "react"
import { createMemoryRouter, RouterProvider } from "react-router"

/**
 * Minimal router decorator for Storybook
 * Provides React Router context so hooks like useLoaderData work
 */
export const withRouter: Decorator = (Story, context) => {
	// Get mock loader data from story parameters
	const loaderData = context.parameters?.loaderData || {}

	// Create a simple memory router with the story as the only route
	const router = createMemoryRouter([
		{
			path: "/",
			element: <Story />,
			loader: () => loaderData, // Return mock data
		},
	])

	return <RouterProvider router={router} />
}
