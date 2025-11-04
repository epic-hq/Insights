import consola from "consola"
import { createContext, useContext, useMemo, useState } from "react"
import { useParams, useRouteLoaderData } from "react-router"

interface CurrentProjectContextType {
	accountId: string
	projectId: string
	accountPath: string
	projectPath: string
	lastProjectPath: { accountId: string; projectId: string }
	setLastProjectPath: (path: { accountId: string; projectId: string }) => void
}

const CurrentProjectContext = createContext<CurrentProjectContextType>({
	accountId: "",
	projectId: "",
	accountPath: "",
	projectPath: "",
	lastProjectPath: { accountId: "", projectId: "" },
	setLastProjectPath: () => {},
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
	const [lastProjectPath, setLastProjectPath] = useState<{ accountId: string; projectId: string }>({
		accountId: "",
		projectId: "",
	})
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as
		| { auth: { accountId: string }; user_settings?: unknown }
		| undefined

	// Get accountId from organizations prop (top account) or fallback to URL params
	const accountId = useMemo(() => {
		if (params.accountId) return params.accountId
		if (protectedData?.auth?.accountId) return protectedData.auth.accountId
		// Avoid noisy errors in routes that are not account-scoped
		consola.debug("[CurrentProject] No accountId in params; non-account route")
		return ""
	}, [params.accountId, protectedData?.auth?.accountId])

	// Get projectId from top account's first project or fallback to URL params
	const projectId = useMemo(() => {
		if (params.projectId) return params.projectId
		return ""
	}, [params.projectId])

	const value = {
		accountId,
		projectId,
		accountPath: `/a/${accountId}`,
		projectPath: `/a/${accountId}/${projectId}`,
		lastProjectPath,
		setLastProjectPath,
	}

	return <CurrentProjectContext.Provider value={value}>{children}</CurrentProjectContext.Provider>
}
