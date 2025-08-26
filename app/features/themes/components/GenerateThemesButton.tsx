import { Loader2, Sparkles } from "lucide-react"
import { useState } from "react"
import { useFetcher } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
// import { toast } from "sonner"

export function GenerateThemesButton() {
	const { projectId } = useCurrentProject()
	const fetcher = useFetcher()
	const [isGenerating, setIsGenerating] = useState(false)

	const handleGenerate = async () => {
		if (!projectId) {
			return
		}

		setIsGenerating(true)

		const formData = new FormData()
		formData.append("projectId", projectId)
		formData.append("guidance", "Generate themes that capture the main user pain points and needs")

		fetcher.submit(formData, {
			method: "POST",
			action: "/api/generate-themes",
		})
	}

	// Handle fetcher response
	if (fetcher.data && !isGenerating) {
		if (fetcher.data.success) {
			window.location.reload() // Refresh to show new themes
		}
	}

	if (fetcher.state === "idle" && isGenerating) {
		setIsGenerating(false)
	}

	return (
		<Button
			onClick={handleGenerate}
			disabled={isGenerating || fetcher.state === "submitting"}
			className="flex items-center gap-2"
		>
			{isGenerating || fetcher.state === "submitting" ? (
				<Loader2 className="h-4 w-4 animate-spin" />
			) : (
				<Sparkles className="h-4 w-4" />
			)}
			{isGenerating || fetcher.state === "submitting" ? "Generating..." : "Generate Themes"}
		</Button>
	)
}
