interface ObservationsNotesProps {
	notes: string;
	className?: string;
}

export default function ObservationsNotes({ notes, className }: ObservationsNotesProps) {
	return (
		<div className={`max-w-xl space-y-2 rounded-lg border bg-white p-6 shadow dark:bg-gray-900 ${className ?? ""}`}>
			<h3 className="mb-2 font-semibold text-lg">Observations & Contextual Notes</h3>
			<p className="whitespace-pre-line text-sm">{notes}</p>
		</div>
	);
}
