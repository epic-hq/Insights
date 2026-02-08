import { cn } from "~/lib/utils";

interface InterviewMetadataProps {
	interviewId: string;
	date: string;
	interviewer: string;
	participant: string;
	segment: string;
	duration: number; // minutes
	transcriptLink?: string;
	className?: string;
}

export default function InterviewMetadata({
	interviewId,
	date,
	interviewer,
	participant,
	segment,
	duration,
	transcriptLink,
	className = "",
}: InterviewMetadataProps) {
	return (
		<div className={cn("max-w-xl space-y-2 rounded-lg border bg-white p-6 shadow dark:bg-gray-900", className)}>
			<h3 className="mb-2 font-semibold text-lg">Interview Metadata</h3>
			<div className="text-sm">
				<span className="font-medium">Interview ID:</span> {interviewId}
			</div>
			<div className="text-sm">
				<span className="font-medium">Date:</span> {date}
			</div>
			<div className="text-sm">
				<span className="font-medium">Interviewer:</span> {interviewer}
			</div>
			<div className="text-sm">
				<span className="font-medium">Participant:</span> {participant}
			</div>
			<div className="text-sm">
				<span className="font-medium">Segment / Role:</span> {segment}
			</div>
			<div className="text-sm">
				<span className="font-medium">Duration:</span> {duration} min
			</div>
			{transcriptLink && (
				<div className="text-sm">
					<span className="font-medium">Transcript:</span>{" "}
					<a href={transcriptLink} className="text-primary-600 underline" target="_blank" rel="noreferrer">
						View
					</a>
				</div>
			)}
		</div>
	);
}
