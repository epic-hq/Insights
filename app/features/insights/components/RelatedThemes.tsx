/**
 * RelatedThemes component - fetches and displays semantically similar themes
 * Uses embedding similarity via the find_similar_themes RPC
 */

import { Loader2, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

interface SimilarTheme {
	id: string
	name: string
	statement: string | null
	similarity: number
}

interface RelatedThemesProps {
	themeId: string
	projectId: string
	projectPath: string
	limit?: number
}

export function RelatedThemes({ themeId, projectId, projectPath, limit = 5 }: RelatedThemesProps) {
	const [themes, setThemes] = useState<SimilarTheme[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const routes = useProjectRoutes(projectPath)

	useEffect(() => {
		async function fetchSimilarThemes() {
			setLoading(true)
			setError(null)

			try {
				const response = await fetch(`/api/similar-themes?theme_id=${themeId}&project_id=${projectId}&limit=${limit}`)
				const data = await response.json()

				if (!response.ok) {
					setError(data.error || "Failed to fetch similar themes")
					return
				}

				setThemes(data.similar_themes || [])
			} catch {
				setError("Failed to fetch similar themes")
			} finally {
				setLoading(false)
			}
		}

		fetchSimilarThemes()
	}, [themeId, projectId, limit])

	if (loading) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />
				Finding related themes...
			</div>
		)
	}

	if (error || themes.length === 0) {
		return null // Don't show section if no related themes
	}

	return (
		<div className="space-y-3">
			<h4 className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
				<Sparkles className="h-4 w-4" />
				Related Themes
			</h4>
			<div className="flex flex-wrap gap-2">
				{themes.map((theme) => (
					<Link key={theme.id} to={routes.themes.detail(theme.id)}>
						<Badge
							variant="outline"
							className="cursor-pointer transition-colors hover:bg-muted"
							title={`${Math.round(theme.similarity * 100)}% similar${theme.statement ? `: ${theme.statement}` : ""}`}
						>
							{theme.name}
							<span className="ml-1 text-muted-foreground text-xs">{Math.round(theme.similarity * 100)}%</span>
						</Badge>
					</Link>
				))}
			</div>
		</div>
	)
}
