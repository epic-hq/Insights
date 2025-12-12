/**
 * SemanticEvidenceSection - Shows semantically related evidence
 *
 * Fetches evidence that is similar to the insight's statement but
 * not yet linked, helping users discover relevant quotes across interviews.
 */

import { Lightbulb, Loader2, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"

interface SemanticEvidence {
	id: string
	gist: string | null
	verbatim: string | null
	interview_id: string | null
	interview: {
		id: string
		title: string | null
		thumbnail_url: string | null
	} | null
	attribution: string
	similarity: number | null
}

interface SemanticEvidenceSectionProps {
	insightId: string
	projectPath: string
}

export function SemanticEvidenceSection({ insightId, projectPath }: SemanticEvidenceSectionProps) {
	const [evidence, setEvidence] = useState<SemanticEvidence[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const { projectId } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)

	useEffect(() => {
		async function fetchRelatedEvidence() {
			if (!projectId) return

			setIsLoading(true)
			setError(null)

			try {
				const response = await fetch(
					`/api/similar-evidence-for-insight?insightId=${insightId}&projectId=${projectId}`
				)

				if (!response.ok) {
					throw new Error("Failed to fetch related evidence")
				}

				const data = await response.json()
				setEvidence(data.evidence || [])
			} catch (err) {
				console.error("[SemanticEvidenceSection] Error:", err)
				setError("Could not load related evidence")
			} finally {
				setIsLoading(false)
			}
		}

		fetchRelatedEvidence()
	}, [insightId, projectId])

	// Don't show section if loading or no results
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8 text-muted-foreground">
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
				Finding related evidence...
			</div>
		)
	}

	if (error || evidence.length === 0) {
		return null
	}

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center gap-2">
				<Sparkles className="h-5 w-5 text-amber-500" />
				<h4 className="font-semibold text-base text-foreground">Related Evidence</h4>
				<Badge variant="secondary" className="text-xs">
					Semantic Match
				</Badge>
			</div>

			<p className="text-muted-foreground text-sm">
				Other quotes across your interviews that relate to this insight
			</p>

			{/* Evidence cards */}
			<div className="grid gap-3 sm:grid-cols-2">
				{evidence.map((ev) => (
					<SemanticEvidenceCard key={ev.id} evidence={ev} projectPath={projectPath} />
				))}
			</div>
		</div>
	)
}

function SemanticEvidenceCard({
	evidence,
	projectPath,
}: {
	evidence: SemanticEvidence
	projectPath: string
}) {
	const routes = useProjectRoutes(projectPath)
	const statement = evidence.gist || evidence.verbatim || "No statement"
	const similarity = evidence.similarity != null ? Math.round(evidence.similarity * 100) : null

	return (
		<Link
			to={evidence.interview_id ? routes.interviews.detail(evidence.interview_id) : "#"}
			className="group block"
		>
			<Card className="h-full transition-all hover:border-amber-200 hover:shadow-sm dark:hover:border-amber-800">
				<CardContent className="p-4">
					{/* Gist/verbatim */}
					<p className="mb-2 line-clamp-3 text-foreground text-sm leading-snug">
						"{statement}"
					</p>

					{/* Footer */}
					<div className="flex items-center justify-between text-xs">
						<span className="truncate text-muted-foreground">— {evidence.attribution}</span>

						{similarity != null && (
							<span
								className={cn(
									"shrink-0 rounded px-1.5 py-0.5",
									similarity >= 80
										? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
										: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
								)}
							>
								{similarity}% match
							</span>
						)}
					</div>
				</CardContent>
			</Card>
		</Link>
	)
}
