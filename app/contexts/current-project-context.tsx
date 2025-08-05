import consola from "consola"
import { createContext, useContext, useMemo } from "react"
import { useParams } from "react-router"

interface CurrentProjectContextType {
	accountId: string
	projectId: string
	accountPath: string
	projectPath: string
}

const CurrentProjectContext = createContext<CurrentProjectContextType>({
	accountId: "",
	projectId: "",
	accountPath: "",
	projectPath: "",
})

export const useCurrentProject = () => {
	const context = useContext(CurrentProjectContext)
	if (!context) {
		throw new Error("useCurrentProject must be used within an CurrentProjectContextProvider")
	}
	return context
}

interface CurrentProjectProviderProps {
	children: React.ReactNode
}

export function CurrentProjectProvider({ children }: CurrentProjectProviderProps) {
	const params = useParams()

	// Get accountId from organizations prop (top account) or fallback to URL params
	const accountId = useMemo(() => {
		// Fallback to URL params
		if (params.accountId) {
			return params.accountId
		}
		consola.error("No accountId available from organizations prop or URL params")
		return ""
	}, [params.accountId])

	// Get projectId from top account's first project or fallback to URL params
	const projectId = useMemo(() => {
		// Fallback to URL params
		if (params.projectId) {
			return params.projectId
		}
		return ""
	}, [params.projectId])

	const value = {
		accountId,
		projectId,
		accountPath: `/a/${accountId}`,
		projectPath: `/a/${accountId}/${projectId}`,
	}

	return <CurrentProjectContext.Provider value={value}>{children}</CurrentProjectContext.Provider>
}
