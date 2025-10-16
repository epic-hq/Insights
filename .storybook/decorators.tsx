import React, { createContext } from "react"
import type { Decorator } from "@storybook/react"
import type { GetAccount, Project, UUID } from "../app/types"

// Re-create the CurrentProjectContext type for Storybook
type CurrentProjectContextType = {
	accountId: UUID | null
	projectId: UUID | null
	account: GetAccount | null
	project: Project | null
	projectPath?: string
}

// Create a mock context for Storybook
const MockCurrentProjectContext = createContext<CurrentProjectContextType>({
	accountId: null,
	projectId: null,
	account: null,
	project: null,
})

// Decorator to provide CurrentProjectContext
export const withCurrentProject: Decorator = (Story, context) => {
	const { parameters } = context
	const routerParams = parameters?.reactRouter?.location?.pathParams || {}
	
	const projectContext: CurrentProjectContextType = {
		accountId: routerParams.accountId || "account-1",
		projectId: routerParams.projectId || "project-1",
		account: null,
		project: null,
		projectPath: `/a/${routerParams.accountId || "account-1"}/${routerParams.projectId || "project-1"}`,
	}

	return (
		<MockCurrentProjectContext.Provider value={projectContext}>
			<Story />
		</MockCurrentProjectContext.Provider>
	)
}

// Global decorator to mock environment variables
export const withMockEnv: Decorator = (Story) => {
	// Mock environment variables for Supabase (window.env is what the client looks for)
	if (typeof window !== "undefined") {
		;(window as any).env = {
			SUPABASE_URL: "https://mock.supabase.co",
			SUPABASE_ANON_KEY: "mock-anon-key",
		}
	}
	
	return <Story />
}
