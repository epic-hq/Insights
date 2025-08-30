// FilterChips.tsx
import type { Filters } from "~/features/signup-chat/lib/filters"

export function FilterChips({
	filters,
	update,
}: {
	filters: Filters
	update: (p: Record<string, string | null>) => void
}) {
	return (
		<div className="flex flex-wrap gap-2">
			<Chip active={!!filters.pinned} onClick={() => update({ pinned: filters.pinned ? null : "1" })}>
				Pinned
			</Chip>
			<Chip active={!!filters.hasEvidence} onClick={() => update({ evidence: filters.hasEvidence ? null : "1" })}>
				Has evidence
			</Chip>
			{/* Emotion selector is compact; you have the colors */}
			<select
				className="rounded-full border px-3 py-1 text-sm"
				value={filters.emotion ?? ""}
				onChange={(e) => update({ emotion: e.target.value || null })}
			>
				<option value="">Emotion</option>
				{/* inject your emotion list here */}
				<option value="Frustrated">Frustrated</option>
				<option value="Hopeful">Hopeful</option>
				<option value="Worried">Worried</option>
			</select>
			<input
				placeholder="Category"
				className="rounded-full border px-3 py-1 text-sm"
				defaultValue={filters.category ?? ""}
				onBlur={(e) => update({ category: e.target.value || null })}
			/>
		</div>
	)
}
function Chip({ active, children, onClick }: any) {
	return (
		<button
			onClick={onClick}
			className={`rounded-full border px-3 py-1 text-sm ${active ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-100"}`}
		>
			{children}
		</button>
	)
}

// --- shadcn version ---
import { useMemo, useState } from "react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "~/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"

export function CategoryFilterChip({
	categories,
	value,
	onChange,
}: {
	categories: string[]
	value?: string
	onChange: (v?: string) => void
}) {
	const [open, setOpen] = useState(false)
	const items = useMemo(() => ["All", ...categories], [categories])

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					className={`h-9 rounded-full border px-3 text-sm ${
						value ? "bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
					}`}
				>
					{value ?? "Category"}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-56 p-0" align="start">
				<Command>
					<CommandInput placeholder="Filter categories…" />
					<CommandEmpty>No match.</CommandEmpty>
					<CommandGroup>
						{items.map((c) => (
							<CommandItem
								key={c}
								onSelect={() => {
									onChange(c === "All" ? undefined : c)
									setOpen(false)
								}}
							>
								{c}
							</CommandItem>
						))}
					</CommandGroup>
				</Command>
			</PopoverContent>
		</Popover>
	)
}

export function CategoryFilterChipBasic({
	categories,
	value,
	onChange,
}: {
	categories: string[]
	value?: string
	onChange: (v?: string) => void
}) {
	return (
		<select
			className="h-9 rounded-full border border-slate-200 bg-white px-3 text-sm"
			value={value ?? ""}
			onChange={(e) => onChange(e.target.value || undefined)}
		>
			<option value="">Category</option>
			{categories.map((c) => (
				<option key={c}>{c}</option>
			))}
		</select>
	)
}
