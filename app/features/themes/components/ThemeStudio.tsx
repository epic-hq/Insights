import { useMemo, useState } from "react"
import { Input } from "~/components/ui/input"
import { ThemeCard } from "~/features/themes/components/ThemeCard"

type ThemeLite = {
	id: string
	name: string
	statement: string | null
	created_at?: string | null
	evidence_count?: number
	insights_count?: number
}

type ThemeStudioProps = {
	themes: ThemeLite[]
}

export function ThemeStudio({ themes }: ThemeStudioProps) {
	const [filter, setFilter] = useState("")

	const filtered = useMemo(() => {
		const q = filter.trim().toLowerCase()
		if (!q) return themes
		return themes.filter((t) => t.name.toLowerCase().includes(q) || (t.statement || "").toLowerCase().includes(q))
	}, [filter, themes])

	return (
		<div className="mx-auto max-w-6xl space-y-6 p-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h1 className="font-semibold text-2xl">Themes</h1>
					<p className="text-muted-foreground text-sm">Project-curated themes sourced from insights.</p>
				</div>
				<div className="flex items-center gap-2">
					<Input
						placeholder="Filter themes…"
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						className="w-56"
					/>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{filtered.map((t) => (
					<ThemeCard key={t.id} theme={t} />
				))}
			</div>
		</div>
	)
}
