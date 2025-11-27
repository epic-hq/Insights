import { formatDistance } from "date-fns"
import { Calendar, Trash2 } from "lucide-react"
import { useState } from "react"
import { useFetcher, useNavigate } from "react-router"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { BackButton } from "~/components/ui/back-button"
import { Button } from "~/components/ui/button"
import InlineEdit from "~/components/ui/inline-edit"
import { PageContainer } from "~/components/layout/PageContainer"
import { MediaTypeIcon } from "~/components/ui/MediaTypeIcon"
import { cn } from "~/lib/utils"
import type { Database } from "~/types"

type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"]

interface NoteViewerProps {
	interview: InterviewRow
	projectId: string
	className?: string
}

export function NoteViewer({ interview, projectId, className }: NoteViewerProps) {
	const fetcher = useFetcher()
	const navigate = useNavigate()
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	const handleSave = (value: string) => {
		fetcher.submit(
			{
				entity: "interview",
				entityId: interview.id,
				accountId: interview.account_id,
				projectId: projectId,
				fieldName: "observations_and_notes",
				fieldValue: value,
			},
			{
				method: "POST",
				action: "/api/update-field",
			}
		)
	}

	const handleDelete = () => {
		fetcher.submit(
			{
				interviewId: interview.id,
				projectId: projectId,
			},
			{
				method: "DELETE",
				action: "/api/interviews/delete",
			}
		)
	}

	return (
		<PageContainer size="md" className={className}>
			<BackButton />

			{/* Header */}
			<div className="mb-6 mt-6">
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
					<Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(true)}>
						<Trash2 className="h-4 w-4 text-destructive" />
					</Button>
				</div>

				<h1 className="mb-3 font-bold text-3xl text-slate-900 dark:text-white">{interview.title || "Untitled Note"}</h1>

				{/* Metadata */}
				<div className="flex flex-wrap items-center gap-4 text-slate-600 text-sm dark:text-slate-400">
					{interview.created_at && (
						<div className="flex items-center gap-1.5">
							<Calendar className="h-4 w-4" />
							<span>{formatDistance(new Date(interview.created_at), new Date(), { addSuffix: true })}</span>
						</div>
					)}
				</div>
			</div>

			{/* Audio Player */}
			{interview.media_url &&
				(interview.media_type === "voice_memo" ||
					interview.file_extension === "mp3" ||
					interview.file_extension === "wav" ||
					interview.file_extension === "m4a") && (
					<div className="mb-6">
						<audio controls className="w-full">
							<source src={interview.media_url} type={`audio/${interview.file_extension || "mp3"}`} />
							Your browser does not support the audio element.
						</audio>
					</div>
				)}

			{/* Note Content */}
			<div className="prose max-w-none text-foreground">
				<InlineEdit
					value={interview.observations_and_notes || ""}
					onSubmit={handleSave}
					multiline={true}
					markdown={true}
					submitOnBlur={true}
					placeholder="Click to add note content..."
					textClassName="prose text-foreground"
					inputClassName="min-h-[500px] font-mono text-sm"
				/>
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Note</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this note? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageContainer>
	)
}
