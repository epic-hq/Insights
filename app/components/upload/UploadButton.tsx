import { useState } from "react"
import UploadModal from "./UploadModal"

export default function UploadButton() {
	const [open, setOpen] = useState(false)

	return (
		<>
			<button
				onClick={() => setOpen(true)}
				className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
			>
				Add interview
			</button>
			<UploadModal open={open} onClose={() => setOpen(false)} onSubmit={() => {}} />
		</>
	)
}
