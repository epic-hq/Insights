import { formatDistance } from "date-fns"
import { Calendar, Clock, Download, File, FileText, Image as ImageIcon, User } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import MediaTypeIcon from "~/components/ui/MediaTypeIcon"
import { cn } from "~/lib/utils"
import type { Database } from "~/types"

type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]

interface DocumentViewerProps {
	interview: InterviewRow & {
		interview_people?: Array<{
			people?: {
				name?: string
				segment?: string
			}
			role?: string
		}>
	}
	className?: string
}

export function DocumentViewer({ interview, className }: DocumentViewerProps) {
	const primaryParticipant = interview.interview_people?.[0]
	const participantName = primaryParticipant?.people?.name
	const participantSegment = primaryParticipant?.people?.segment

	const getStatusColor = (status?: string | null) => {
		if (!status) return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"

		switch (status.toLowerCase()) {
			case "ready":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
			case "transcribed":
			case "transcribing":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
			case "processing":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
			case "uploaded":
			case "uploading":
				return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
			case "error":
			case "failed":
				return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
		}
	}

	const formatStatus = (status?: string | null) => {
		if (!status) return "Saved"
		return status.charAt(0).toUpperCase() + status.slice(1)
	}

	const isTextContent =
		interview.source_type === "transcript" ||
		interview.source_type === "note" ||
		(interview.transcript && !interview.media_url) ||
		interview.observations_and_notes
	const isImage =
		interview.file_extension &&
		["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(interview.file_extension.toLowerCase())
	const isDocument = interview.source_type === "document" || !isTextContent

	// Clean up media URL - should be an absolute URL (R2 presigned URL)
	// The loader should have converted R2 keys to presigned URLs
	// If media_url is still a relative path, it means the database has a bad value
	const _mediaUrl = interview.media_url

	return (
		<div className={cn("mx-auto max-w-4xl px-4 py-8", className)}>
			{/* Header */}
			<div className="mb-6">
				<div className="mb-4 flex items-start justify-between">
					<div className="flex items-center gap-3">
						<MediaTypeIcon
							mediaType={interview.media_type}
							sourceType={interview.source_type}
							showLabel={true}
							iconClassName="h-5 w-5"
							labelClassName="text-base font-semibold"
						/>
					</div>
					<Badge className={cn("font-medium text-xs", getStatusColor(interview.status))}>
						{formatStatus(interview.status)}
					</Badge>
				</div>

				<h1 className="mb-2 font-bold text-3xl text-slate-900 dark:text-white">
					{interview.title || "Untitled Document"}
				</h1>

				{/* Participant info */}
				{participantName && (
					<div className="mb-4 flex items-center gap-2 text-slate-600 dark:text-slate-400">
						<User className="h-4 w-4" />
						<span>{participantName}</span>
						{participantSegment && <span className="text-slate-400">• {participantSegment}</span>}
					</div>
				)}

				{/* Metadata */}
				<div className="flex flex-wrap items-center gap-4 text-slate-600 text-sm dark:text-slate-400">
					{interview.created_at && (
						<div className="flex items-center gap-1.5">
							<Calendar className="h-4 w-4" />
							<span>{formatDistance(new Date(interview.created_at), new Date(), { addSuffix: true })}</span>
						</div>
					)}
					{interview.duration_sec && (
						<div className="flex items-center gap-1.5">
							<Clock className="h-4 w-4" />
							<span>{Math.round(interview.duration_sec / 60)} min</span>
						</div>
					)}
				</div>
			</div>

			{/* Content Area - no extra card wrapper */}
			<div>
				{/* Text Content */}
				{isTextContent && (interview.transcript || interview.observations_and_notes) && (
					<div className="prose prose-slate dark:prose-invert max-w-none">
						<div className="mb-4 flex items-center gap-2 text-slate-600 dark:text-slate-400">
							<FileText className="h-5 w-5" />
							<h2 className="m-0 font-semibold text-slate-900 text-xl dark:text-white">
								{interview.source_type === "note" ? "Note" : "Transcript"}
							</h2>
						</div>
						<div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-6 font-mono text-slate-800 text-sm dark:bg-slate-800/50 dark:text-slate-200">
							{interview.observations_and_notes || interview.transcript}
						</div>
					</div>
				)}

				{/* Image Content */}
				{isImage && interview.media_url && (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
								<ImageIcon className="h-5 w-5" />
								<h2 className="font-semibold text-slate-900 text-xl dark:text-white">Image</h2>
							</div>
							<Button asChild size="sm" variant="outline">
								<a href={interview.media_url} download target="_blank" rel="noopener noreferrer">
									<Download className="mr-1.5 h-3.5 w-3.5" />
									Download
								</a>
							</Button>
						</div>
						<div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
							<img src={interview.media_url} alt={interview.title || "Document image"} className="w-full" />
						</div>
					</div>
				)}

				{/* PDF Documents */}
				{interview.media_url && interview.file_extension?.toLowerCase() === "pdf" && (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
								<File className="h-5 w-5" />
								<h2 className="font-semibold text-slate-900 text-xl dark:text-white">PDF Document</h2>
							</div>
							<Button asChild size="sm" variant="outline">
								<a href={interview.media_url} download target="_blank" rel="noopener noreferrer">
									<Download className="mr-1.5 h-3.5 w-3.5" />
									Download
								</a>
							</Button>
						</div>
						<div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
							<iframe
								src={`${interview.media_url}#view=FitH`}
								className="h-[800px] w-full"
								title={interview.title || "PDF Document"}
							/>
						</div>
						{interview.transcript && (
							<div className="mt-6 border-slate-200 border-t pt-6 dark:border-slate-700">
								<div className="mb-4 flex items-center gap-2 text-slate-600 dark:text-slate-400">
									<FileText className="h-5 w-5" />
									<h3 className="font-semibold text-lg text-slate-900 dark:text-white">Notes</h3>
								</div>
								<div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-6 text-slate-800 text-sm dark:bg-slate-800/50 dark:text-slate-200">
									{interview.transcript}
								</div>
							</div>
						)}
					</div>
				)}

				{/* Markdown Files */}
				{interview.media_url &&
					interview.file_extension &&
					["md", "markdown"].includes(interview.file_extension.toLowerCase()) && (
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
									<FileText className="h-5 w-5" />
									<h2 className="font-semibold text-slate-900 text-xl dark:text-white">Markdown Document</h2>
								</div>
								<Button asChild size="sm" variant="outline">
									<a href={interview.media_url} download target="_blank" rel="noopener noreferrer">
										<Download className="mr-1.5 h-3.5 w-3.5" />
										Download
									</a>
								</Button>
							</div>
							{interview.transcript ? (
								<div className="prose prose-slate dark:prose-invert max-w-none">
									<div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-6 text-slate-800 text-sm dark:bg-slate-800/50 dark:text-slate-200">
										{interview.transcript}
									</div>
								</div>
							) : (
								<div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
									<iframe
										src={interview.media_url}
										className="h-[600px] w-full"
										title={interview.title || "Markdown Document"}
									/>
								</div>
							)}
						</div>
					)}

				{/* Other Documents (Word, Excel, etc.) - Try iframe, fallback to download */}
				{isDocument &&
					interview.media_url &&
					!isImage &&
					interview.file_extension &&
					!["pdf", "md", "markdown"].includes(interview.file_extension.toLowerCase()) && (
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
									<File className="h-5 w-5" />
									<h2 className="font-semibold text-slate-900 text-xl dark:text-white">
										{interview.file_extension.toUpperCase()} Document
									</h2>
								</div>
								<Button asChild size="sm" variant="outline">
									<a href={interview.media_url} download target="_blank" rel="noopener noreferrer">
										<Download className="mr-1.5 h-3.5 w-3.5" />
										Download
									</a>
								</Button>
							</div>

							{/* Try to display with Google Docs Viewer for Office files */}
							{interview.file_extension &&
							["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(interview.file_extension.toLowerCase()) ? (
								<div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
									<iframe
										src={`https://docs.google.com/viewer?url=${encodeURIComponent(interview.media_url)}&embedded=true`}
										className="h-[800px] w-full"
										title={interview.title || "Document"}
									/>
								</div>
							) : (
								<div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
									<iframe
										src={interview.media_url}
										className="h-[600px] w-full"
										title={interview.title || "Document"}
									/>
								</div>
							)}

							{interview.transcript && (
								<div className="mt-6 border-slate-200 border-t pt-6 dark:border-slate-700">
									<div className="mb-4 flex items-center gap-2 text-slate-600 dark:text-slate-400">
										<FileText className="h-5 w-5" />
										<h3 className="font-semibold text-lg text-slate-900 dark:text-white">Notes</h3>
									</div>
									<div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-6 text-slate-800 text-sm dark:bg-slate-800/50 dark:text-slate-200">
										{interview.transcript}
									</div>
								</div>
							)}
						</div>
					)}

				{/* Empty state */}
				{!interview.transcript && !interview.observations_and_notes && !interview.media_url && (
					<div className="py-12 text-center text-slate-500">
						<FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
						<p>No content available</p>
					</div>
				)}
			</div>
		</div>
	)
}
