import { cn } from "~/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"

export interface TranscriptEntry {
	speaker: "A" | "B"
	timeRange: string
	content: string
}

export interface TranscriptDisplayProps {
	transcript: TranscriptEntry[]
	speakerNames?: {
		speakerA?: string
		speakerB?: string
	}
	className?: string
}

export default function TranscriptDisplay({
	transcript,
	speakerNames = { speakerA: "Speaker A", speakerB: "Speaker B" },
	className,
}: TranscriptDisplayProps) {
	const getSpeakerName = (speaker: "A" | "B") => {
		return speaker === "A" ? speakerNames.speakerA : speakerNames.speakerB
	}

	const getSpeakerColor = (speaker: "A" | "B") => {
		return speaker === "A"
			? "bg-blue-50 border-l-blue-400 text-blue-900"
			: "bg-green-50 border-l-green-400 text-green-900"
	}

	const getSpeakerBadgeColor = (speaker: "A" | "B") => {
		return speaker === "A"
			? "bg-blue-100 text-blue-800 border-blue-200"
			: "bg-green-100 text-green-800 border-green-200"
	}

	return (
		<Card className={cn("w-full", className)}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
					Interview Transcript (WIP)
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{transcript.map((entry, index) => (
					<div
						key={index}
						className={cn(
							"rounded-lg border-l-4 p-4 transition-all duration-200 hover:shadow-sm",
							getSpeakerColor(entry.speaker)
						)}
					>
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-3">
								<span
									className={cn(
										"inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium text-xs",
										getSpeakerBadgeColor(entry.speaker)
									)}
								>
									{getSpeakerName(entry.speaker)}
								</span>
								<span className="font-mono text-muted-foreground text-xs">{entry.timeRange}</span>
							</div>
						</div>
						<div className="text-sm leading-relaxed">{entry.content}</div>
					</div>
				))}
			</CardContent>
		</Card>
	)
}
