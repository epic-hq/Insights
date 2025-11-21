import { createContext, useContext, type ReactNode, useState } from "react"

interface ProjectStatusAgentContextType {
	isExpanded: boolean
	setIsExpanded: (expanded: boolean) => void
	pendingInput: string | null
	setPendingInput: (input: string | null) => void
	insertText: (text: string) => void
}

const ProjectStatusAgentContext = createContext<ProjectStatusAgentContextType | null>(null)

export function ProjectStatusAgentProvider({ children }: { children: ReactNode }) {
	const [isExpanded, setIsExpanded] = useState(true)
	const [pendingInput, setPendingInput] = useState<string | null>(null)

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
