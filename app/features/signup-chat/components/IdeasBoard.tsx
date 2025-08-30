import { useEffect, useState } from "react"

type Idea = {
	id: string
	title: string
	fromInsightId?: string
	votes?: number
	createdAt: string
}

export function IdeasBoard() {
	const [ideas, setIdeas] = useState<Idea[] | null>(null)

	useEffect(() => {
		;(async () => {
			const r = await fetch("/api/suggestions", { headers: { accept: "application/json" } })
			setIdeas(r.ok ? await r.json() : [])
		})()
	}, [])

	if (!ideas || ideas.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-300 border-dashed p-8 text-center text-slate-600">
				No suggestions yet. Send an insight to Suggestions to start ideation.
			</div>
		)
	}

	return (
		<ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
			{ideas.map((i) => (
				<li key={i.id}>
					<article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
						<h3 className="font-semibold text-base leading-snug">{i.title}</h3>
						<div className="mt-3 flex items-center justify-between text-slate-600 text-sm">
							<span>👍 {i.votes ?? 0}</span>
							{i.fromInsightId ? (
								<a className="underline underline-offset-2 hover:no-underline" href={`/?focus=${i.fromInsightId}`}>
									View source insight
								</a>
							) : (
								<span />
							)}
						</div>
					</article>
				</li>
			))}
		</ul>
	)
}
