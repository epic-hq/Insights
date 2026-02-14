import { useState } from "react";

interface FilterBarProps {
	onSearch?(query: string): void;
	onSegmentChange?(segment: string): void;
	segments: string[];
}

export default function FilterBar({ onSearch, onSegmentChange, segments }: FilterBarProps) {
	const [query, setQuery] = useState("");

	return (
		<div className="mb-4 flex flex-wrap items-center gap-2">
			<input
				type="text"
				value={query}
				onChange={(e) => {
					setQuery(e.target.value);
					onSearch?.(e.target.value);
				}}
				placeholder="Search insights…"
				className="min-w-[200px] flex-1 rounded border px-2 py-1 text-sm"
			/>
			<select className="rounded border px-2 py-1 text-sm" onChange={(e) => onSegmentChange?.(e.target.value)}>
				<option value="">All Segments</option>
				{segments.map((s) => (
					<option key={s} value={s}>
						{s}
					</option>
				))}
			</select>
		</div>
	);
}
