import consola from "consola"
import { createContext, useContext, useMemo } from "react"
import { useParams } from "react-router"

interface CurrentAccountContextType {
	accountId: string
}

const CurrentAccountContext = createContext<CurrentAccountContextType>({
	accountId: "",
})

export const useCurrentAccount = () => {
	const context = useContext(CurrentAccountContext)
	if (!context) {
		throw new Error("useCurrentProject must be used within an CurrentProjectContextProvider")
	}
	return context
}

interface CurrentAccountProviderProps {
	children: React.ReactNode
}

export function CurrentAccountProvider({ children }: CurrentAccountProviderProps) {
	const params = useParams()

	// TODO: Change this to get from loader
	// Get accountId from organizations prop (top account) or fallback to URL params
	const accountId = useMemo(() => {
		// Fallback to URL params
		if (params.accountId) {
			return params.accountId
		}
		consola.error("No accountId available from organizations prop or URL params")
		return ""
	}, [params.accountId])

	const value = {
		accountId,
	}

	return <CurrentAccountContext.Provider value={value}>{children}</CurrentAccountContext.Provider>
}
