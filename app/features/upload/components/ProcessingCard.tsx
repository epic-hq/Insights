import { AlertTriangleIcon, CheckCircle } from "lucide-react"
import { useEffect, useState } from "react"

export type ProcessingState = "uploaded" | "transcribing" | "analyzing" | "ready" | "error"

export interface ProcessingCardProps {
	id: string
	filename: string
	progress?: number // 0-100
	state: ProcessingState
	onClick?: () => void
}

export default function ProcessingCard({ filename, progress = 0, state, onClick }: ProcessingCardProps) {
	const [internalProgress, setInternalProgress] = useState(progress)

	// Simulate progress if only state changes without explicit percentage (demo mode)
	useEffect(() => {
		if (state === "ready" || state === "error") {
			setInternalProgress(100)
		} else if (progress !== undefined) {
			setInternalProgress(progress)
		}
	}, [state, progress])

	const stateColor: Record<ProcessingState, string> = {
		uploaded: "bg-gray-300",
		transcribing: "bg-yellow-400",
		analyzing: "bg-blue-400",
		ready: "bg-green-500",
		error: "bg-red-500",
	}

	const stateLabel: Record<ProcessingState, string> = {
		uploaded: "Uploaded",
		transcribing: "Transcribing",
		analyzing: "Analyzing",
		ready: "Ready",
		error: "Error",
	}

	return (
		<div
			onClick={onClick}
			className="flex cursor-pointer flex-col gap-2 rounded-lg border p-4 hover:shadow-sm dark:border-gray-600"
		>
			<div className="flex items-center justify-between">
				<h4 className="max-w-[70%] truncate font-medium text-gray-900 text-sm dark:text-gray-100" title={filename}>
					{filename}
				</h4>
				{state === "ready" ? (
					<CheckCircle className="h-5 w-5 text-green-500" />
				) : state === "error" ? (
					<AlertTriangleIcon className="h-5 w-5 text-red-500" />
				) : null}
			</div>
			<div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
				<div
					style={{ width: `${internalProgress}%` }}
					className={`h-2 rounded-full transition-all ${stateColor[state]}`}
				/>
			</div>
			<p className="mt-1 text-gray-600 text-xs dark:text-gray-400">{stateLabel[state]}</p>
		</div>
	)
}
