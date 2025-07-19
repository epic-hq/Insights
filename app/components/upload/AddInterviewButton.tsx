import { useState } from "react"
import { Button } from "~/components/ui/button"
import type { ProcessingResult } from "~/utils/processInterview.server"
import AddInterview from "./AddInterview"

export default function AddInterviewButton() {
	const [open, setOpen] = useState(false)

	const handleSuccess = (_result: ProcessingResult) => {
		// You could navigate to the new interview here once API returns the id
	}

	return (
		<>
			<Button onClick={() => setOpen(true)}>Add Interview</Button>
			<AddInterview open={open} onClose={() => setOpen(false)} onSuccess={handleSuccess} />
		</>
	)
}
