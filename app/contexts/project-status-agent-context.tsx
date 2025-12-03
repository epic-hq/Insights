import { createContext, type ReactNode, useContext, useEffect, useState } from "react"
import { useLocation } from "react-router"
import { useDeviceDetection } from "~/hooks/useDeviceDetection"

interface ProjectStatusAgentContextType {
	isExpanded: boolean
	setIsExpanded: (expanded: boolean) => void
	pendingInput: string | null
	setPendingInput: (input: string | null) => void
	insertText: (text: string) => void
}

const ProjectStatusAgentContext = createContext<ProjectStatusAgentContextType | null>(null)

export function ProjectStatusAgentProvider({ children }: { children: ReactNode }) {
	const location = useLocation()
	const { isMobile } = useDeviceDetection()

	// On mobile and interviews route, default to collapsed
	const shouldDefaultCollapsed = isMobile && location.pathname.includes("/interviews")
	const [isExpanded, setIsExpanded] = useState(!shouldDefaultCollapsed)
	const [pendingInput, setPendingInput] = useState<string | null>(null)

	// Auto-collapse when navigating to interviews on mobile
	useEffect(() => {
		if (isMobile && location.pathname.includes("/interviews")) {
			setIsExpanded(false)
		}
	}, [location.pathname, isMobile])

	const insertText = (text: string) => {
		setPendingInput(text)
		setIsExpanded(true)
	}

	return (
		<ProjectStatusAgentContext.Provider
			value={{
				isExpanded,
				setIsExpanded,
				pendingInput,
				setPendingInput,
				insertText,
			}}
		>
			{children}
		</ProjectStatusAgentContext.Provider>
	)
}

export function useProjectStatusAgent() {
	const context = useContext(ProjectStatusAgentContext)
	if (!context) {
		throw new Error("useProjectStatusAgent must be used within ProjectStatusAgentProvider")
	}
	return context
}

export function useOptionalProjectStatusAgent() {
	return useContext(ProjectStatusAgentContext)
}
