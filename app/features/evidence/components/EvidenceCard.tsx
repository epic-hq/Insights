import { FileText, Quote } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import type { Database } from "~/types"

type Evidence = Database["public"]["Tables"]["evidence"]["Row"]

interface EvidenceCardProps {
	evidence: Evidence
	showInterviewLink?: boolean
	interviewTitle?: string
	projectPath?: string
	className?: string
}

export function EvidenceCard({
	evidence,
	showInterviewLink = false,
	interviewTitle,
	projectPath,
	className = "",
}: EvidenceCardProps) {
	return (
		<Card className={`border-l-4 border-l-blue-500 ${className}`}>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					<Quote className="mt-1 h-4 w-4 flex-shrink-0 text-blue-600" />
					<div className="flex-1 space-y-2">
						{/* Main verbatim quote */}
						<blockquote className="text-foreground italic">"{evidence.verbatim}"</blockquote>

						{/* Support/context if available */}
						{evidence.support && <p className="text-muted-foreground text-sm">{evidence.support}</p>}

						{/* Metadata row */}
						<div className="flex flex-wrap items-center gap-2 text-xs">
							{/* Confidence badge */}
							{evidence.confidence && (
								<Badge variant="outline" className="text-xs">
									{evidence.confidence} confidence
								</Badge>
							)}

							{/* Journey stage */}
							{evidence.journey_stage && (
								<Badge variant="secondary" className="text-xs">
									{evidence.journey_stage}
								</Badge>
							)}

							{/* Method */}
							{evidence.method && (
								<Badge variant="outline" className="text-xs">
									{evidence.method}
								</Badge>
							)}

							{/* Interview link */}
							{showInterviewLink && evidence.interview_id && projectPath && (
								<Link
									to={`${projectPath}/interviews/${evidence.interview_id}`}
									className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
								>
									<FileText className="h-3 w-3" />
									<span>{interviewTitle || "View Interview"}</span>
								</Link>
							)}
						</div>

						{/* Kind tags if available */}
						{evidence.kind_tags && evidence.kind_tags.length > 0 && (
							<div className="flex flex-wrap gap-1">
								{evidence.kind_tags.map((tag, index) => (
									<Badge key={index} variant="outline" className="text-xs">
										{tag}
									</Badge>
								))}
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export default EvidenceCard
