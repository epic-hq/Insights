import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import { Card, CardContent } from "~/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"

export function InterviewQuestionHelp({
	open,
	onOpenChange,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const [index, setIndex] = useState(0)

	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + 3) % 3)
			if (e.key === "ArrowRight") setIndex((i) => (i + 1) % 3)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [open])

	const pages = [
		{
			title: "What makes a good question?",
			points: [
				"Open-ended and conversational",
				"Specific and focused (one topic)",
				"Invites stories and concrete examples",
			],
		},
		{
			title: "Order to ask",
			points: [
				"Warm-up context → recent experiences",
				"Dive into pains and workflows",
				"Wrap with motivations and constraints",
			],
		},
		{
			title: "Things to avoid",
			points: ["Leading or binary questions", "Multiple questions at once", "Jargon or product pitching"],
		},
	]

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Interview planning tips</DialogTitle>
				</DialogHeader>
				<div className="relative">
					<button
						type="button"
						className="-translate-y-1/2 absolute top-1/2 left-2 rounded p-1 hover:bg-accent"
						title="Previous"
						onClick={() => setIndex((i) => (i - 1 + pages.length) % pages.length)}
					>
						<ChevronLeft className="h-5 w-5" />
					</button>

					<div className="mx-10">
						<Card className="border-0 shadow-none sm:rounded-xl sm:border sm:shadow-sm">
							<CardContent className="p-4">
								<h3 className="mb-2 font-medium">{pages[index].title}</h3>
								<ul className="list-disc pl-5 text-sm">
									{pages[index].points.map((p, i) => (
										<li key={i}>{p}</li>
									))}
								</ul>
							</CardContent>
						</Card>
					</div>

					<button
						type="button"
						className="-translate-y-1/2 absolute top-1/2 right-2 rounded p-1 hover:bg-accent"
						title="Next"
						onClick={() => setIndex((i) => (i + 1) % pages.length)}
					>
						<ChevronRight className="h-5 w-5" />
					</button>
				</div>

				<div className="mt-4 flex items-center justify-center gap-2">
					{pages.map((_, i) => (
						<button
							key={i}
							type="button"
							onClick={() => setIndex(i)}
							className={`h-2.5 w-2.5 rounded-full ${index === i ? "bg-blue-600" : "bg-gray-300"}`}
						/>
					))}
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default InterviewQuestionHelp
