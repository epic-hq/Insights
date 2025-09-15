import consola from "consola"
import { RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"

interface ContextualSuggestionsProps {
	suggestionType: "decision_questions" | "assumptions" | "unknowns" | "organizations" | "roles"
	currentInput: string
	researchGoal: string
	existingItems: string[]
	onSuggestionClick: (suggestion: string) => void
	apiPath?: string // Allow custom API path to be passed in
	shownSuggestions?: string[] // Track previously shown suggestions
	onSuggestionShown?: (suggestions: string[]) => void // Callback when suggestions are shown
	isActive?: boolean // Whether this component should show suggestions
}

export default function ContextualSuggestions({
	suggestionType,
	currentInput,
	researchGoal,
	existingItems,
	onSuggestionClick,
	apiPath = "/api/contextual-suggestions", // Default fallback for backward compatibility
	shownSuggestions = [],
	onSuggestionShown,
	isActive = false,
}: ContextualSuggestionsProps) {
	const [suggestions, setSuggestions] = useState<string[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [hasGenerated, setHasGenerated] = useState(false)

	const generateSuggestions = async () => {
		if (!researchGoal.trim()) return

		setIsLoading(true)
		try {
			const formData = new FormData()
			formData.append("researchGoal", researchGoal)
			formData.append("currentInput", currentInput)
			formData.append("suggestionType", suggestionType)
			formData.append("existingItems", JSON.stringify(existingItems))
			formData.append("projectContext", "") // Could be expanded later

			const response = await fetch(apiPath, {
				method: "POST",
				body: formData,
			})

			if (!response.ok) {
				const errorText = await response.text()
				console.error("API Error Response:", response.status, response.statusText, errorText)
				throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`)
			}

			const data = await response.json()
			consola.log("Received suggestions data:", data)
			const suggestionsArray = Array.isArray(data) ? data : data.suggestions || []
			// Filter out suggestions that have already been shown
			const filteredSuggestions = suggestionsArray.filter(suggestion => 
				!shownSuggestions.includes(suggestion) && !existingItems.includes(suggestion)
			)
			const finalSuggestions = filteredSuggestions.slice(0, 3)
			setSuggestions(finalSuggestions)
			// Notify parent component about shown suggestions
			if (onSuggestionShown && finalSuggestions.length > 0) {
				onSuggestionShown(finalSuggestions)
			}
			setHasGenerated(true)
		} catch (error) {
			consola.error("Error generating contextual suggestions:", error)
			setSuggestions([])
		} finally {
			setIsLoading(false)
		}
	}

	// Auto-generate suggestions when component mounts and research goal is available
	useEffect(() => {
		if (!hasGenerated && researchGoal.trim()) {
			// Auto-generate after a short delay to improve UX
			const timer = setTimeout(() => {
				generateSuggestions()
			}, 500)
			return () => clearTimeout(timer)
		}
	}, [researchGoal, suggestionType, hasGenerated])

	if (!researchGoal.trim() || !isActive) return null

	return (
		<div className="space-y-2">
			{isLoading && <div className="text-gray-500 text-xs">💭 Generating contextual suggestions...</div>}

			{suggestions.length > 0 && !isLoading && (
				<div>
					<div className="mb-2 flex items-center justify-between">
						<div className="text-gray-600 text-xs">💡 Contextual suggestions:</div>
						<button
							onClick={() => {
								setHasGenerated(false)
								generateSuggestions()
							}}
							className="flex items-center gap-1 rounded px-2 py-1 text-gray-500 text-xs transition-colors hover:bg-gray-100 hover:text-gray-700"
						>
							<RefreshCw className="h-3 w-3" />
							Refresh
						</button>
					</div>
					<div className="flex flex-wrap gap-2">
						{suggestions.map((suggestion, index) => (
							<button
								key={index}
								onClick={() => onSuggestionClick(suggestion)}
								className="cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700 text-xs transition-colors hover:bg-slate-100"
							>
								+ {suggestion}
							</button>
						))}
					</div>
				</div>
			)}

			{!isLoading && !hasGenerated && (
				<button
					onClick={generateSuggestions}
					className="flex items-center gap-1 rounded px-2 py-1 text-gray-600 text-xs transition-colors hover:bg-gray-100"
				>
					💡 Get suggestions
				</button>
			)}
		</div>
	)
}
