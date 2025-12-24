import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useLocation } from "react-router"
import { useDeviceDetection } from "~/hooks/useDeviceDetection"

export interface PendingAssistantMessage {
	id: string
	text: string
}

interface ProjectStatusAgentContextType {
	isExpanded: boolean
	setIsExpanded: (expanded: boolean) => void
	pendingInput: string | null
	setPendingInput: (input: string | null) => void
	insertText: (text: string) => void
	pendingAssistantMessage: PendingAssistantMessage | null
	setPendingAssistantMessage: (msg: PendingAssistantMessage | null) => void
	/** Opens sidebar and injects an assistant message */
	showAssistantMessage: (text: string) => void
	/** Register a callback to be called when force expand is needed (for clearing local collapse state) */
	registerForceExpandCallback: (cb: () => void) => void
	/** Signal to force expand the inner chat component */
	forceExpandChat: boolean
	setForceExpandChat: (expand: boolean) => void
}

const ProjectStatusAgentContext = createContext<ProjectStatusAgentContextType | null>(null)

export function ProjectStatusAgentProvider({ children }: { children: ReactNode }) {
	const location = useLocation()
	const { isMobile } = useDeviceDetection()

	// On mobile and interviews route, default to collapsed
	const shouldDefaultCollapsed = isMobile && location.pathname.includes("/interviews")
	const [isExpanded, setIsExpanded] = useState(!shouldDefaultCollapsed)
	const [pendingInput, setPendingInput] = useState<string | null>(null)
	const [pendingAssistantMessage, setPendingAssistantMessage] = useState<PendingAssistantMessage | null>(null)
	const [forceExpandChat, setForceExpandChat] = useState(false)

	// Callback ref for force expand (registered by ProjectLayout to clear isChatCollapsed)
	const forceExpandCallbackRef = useRef<(() => void) | null>(null)

	const registerForceExpandCallback = useCallback((cb: () => void) => {
		forceExpandCallbackRef.current = cb
	}, [])

	// Auto-collapse when navigating to interviews on mobile
	useEffect(() => {
		if (isMobile && location.pathname.includes("/interviews")) {
			setIsExpanded(false)
		}
	}, [location.pathname, isMobile])

	const insertText = (text: string) => {
		setPendingInput(text)
		forceExpandCallbackRef.current?.()
		setIsExpanded(true)
	}

	const showAssistantMessage = (text: string) => {
		setPendingAssistantMessage({
			id: `assistant-${Date.now()}`,
			text,
		})
		forceExpandCallbackRef.current?.()
		setForceExpandChat(true)
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
				pendingAssistantMessage,
				setPendingAssistantMessage,
				showAssistantMessage,
				registerForceExpandCallback,
				forceExpandChat,
				setForceExpandChat,
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
