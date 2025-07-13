import { Fragment } from "react"

export interface TranscriptChunk {
	speaker: string
	text: string
	ts: number // seconds
}

export interface TranscriptViewerProps {
	chunks: TranscriptChunk[]
	onSeek?: (time: number) => void
}

export default function TranscriptViewer({ chunks, onSeek }: TranscriptViewerProps) {
	return (
		<div className="max-h-[60vh] space-y-2 overflow-y-auto pr-2">
			{chunks.map((c) => (
				<Fragment key={c.ts}>
					<button
						type="button"
						className="block w-full cursor-pointer rounded-md p-1 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30"
						onClick={() => onSeek?.(c.ts)}
					>
						<span className="mr-1 font-semibold text-blue-700 dark:text-blue-300">{c.speaker}:</span>
						{c.text}
					</button>
				</Fragment>
			))}
		</div>
	)
}
