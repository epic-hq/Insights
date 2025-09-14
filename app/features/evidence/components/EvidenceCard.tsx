import { FileText, Quote } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import type { Evidence } from "~/types"

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
	const interviewUrl =
		projectPath && evidence.interview_id ? `${projectPath}/interviews/${evidence.interview_id}` : null
	return (
		<Card className={`border-l-4 border-l-blue-500 ${className}`}>
			<CardContent className="p-2">
				<div className="flex items-start gap-2">
					<Quote className="mt-1 h-4 w-4 flex-shrink-0 text-blue-600" />
					<div className="flex-1">
						{/* Main verbatim quote */}
						<p className="text-foreground leading-relaxed">{evidence.verbatim}</p>

						{/* Journey stage */}
						{evidence.journey_stage && (
							<div className="mt-2">
								Stage:
								<Badge variant="secondary" className="ml-2 text-xs">
									{evidence.journey_stage}
								</Badge>
							</div>
						)}


						{/* Kind tags if available */}
						{evidence.kind_tags && evidence.kind_tags.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-1">
								Tags:
								{evidence.kind_tags.map((tag, index) => (
									<Badge key={index} variant="outline" className="text-xs">
										{tag}
									</Badge>
								))}
							</div>
						)}

						{/* Interview link */}
						{showInterviewLink && interviewUrl && (
							<div className="mt-1 flex justify-between">
								<div className="flex flex-row">
									{/* Method */}
									{evidence.method && (
										<div className="mt-1">
											Source:
											<Badge variant="outline" className="ml-2 text-xs">
												{evidence.method}
											</Badge>
										</div>
									)}
									<Link to={interviewUrl}>
										<Badge variant="outline" className="text-xs">
											{interviewTitle || "Interview"}
										</Badge>
									</Link>
								</div>
								{/* Metadata block on the right */}
								<div className="ml-4 flex flex-row items-end gap-2 text-xs">
									{/* Support/context if available */}
									{evidence.support && <p className="text-foreground text-sm">{evidence.support}</p>}

									{/* Confidence badge */}
									{evidence.confidence && (
										<Badge variant="outline" className="text-xs">
											{evidence.confidence} confidence
										</Badge>
									)}
								</div>
							</div>
						)}


					</div>


				</div>
			</CardContent>
		</Card>
	)
}

export default EvidenceCard
