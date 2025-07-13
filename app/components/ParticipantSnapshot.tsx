interface ParticipantSnapshotProps {
	narrative: string
	className?: string
}

export default function ParticipantSnapshot({ narrative, className }: ParticipantSnapshotProps) {
	return (
		<div className={`max-w-xl space-y-2 rounded-lg border bg-white p-6 shadow dark:bg-gray-900 ${className ?? ""}`}>
			<h3 className="mb-2 font-semibold text-lg">Participant Snapshot</h3>
			<p className="whitespace-pre-line text-sm">{narrative}</p>
		</div>
	)
}
