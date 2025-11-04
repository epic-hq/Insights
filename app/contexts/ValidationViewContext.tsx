import { createContext, useContext, useState, type ReactNode } from "react"

interface ValidationViewContextType {
	showValidationView: boolean
	setShowValidationView: (show: boolean) => void
}

const ValidationViewContext = createContext<ValidationViewContextType>({
	showValidationView: false,
	setShowValidationView: () => {},
})

export const useValidationView = () => {
	const context = useContext(ValidationViewContext)
	if (!context) {
		throw new Error("useValidationView must be used within a ValidationViewProvider")
	}
	return context
}

interface ValidationViewProviderProps {
	children: ReactNode
}

export function ValidationViewProvider({ children }: ValidationViewProviderProps) {
	const [showValidationView, setShowValidationView] = useState(false)

	return (
		<ValidationViewContext.Provider value={{ showValidationView, setShowValidationView }}>
			{children}
		</ValidationViewContext.Provider>
	)
}
