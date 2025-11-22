import type { Preview } from "@storybook/react-vite"
import React from "react"
import { withCurrentProject, withMockEnv } from "./decorators"
// import "../app/tailwind.css" // Disabled - using inline styles in preview-head.html for now

// Set window.env immediately when this module loads
if (typeof window !== "undefined") {
	;(window as any).env = {
		SUPABASE_URL: "https://mock.supabase.co",
		SUPABASE_ANON_KEY: "mock-anon-key",
	}
}

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
	},
	decorators: [
		withMockEnv,
		withCurrentProject,
		(Story) => (
			<div style={{ minHeight: "100vh", padding: "1rem" }}>
				<Story />
			</div>
		),
	],
}

export default preview
