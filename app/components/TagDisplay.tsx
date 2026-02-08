import type { CSSProperties } from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

interface Tag {
	name: string;
	frequency: number;
}

interface TagDisplayProps {
	tags?: Tag[];
	maxTags?: number;
}

export const StyledTag = ({ name, style, frequency }: { name: string; style: CSSProperties; frequency?: number }) => {
	return (
		<div
			key={`${name}-${frequency}`}
			className="m-2 cursor-pointer rounded-full transition-all duration-200 hover:scale-105"
			style={style}
		>
			<Badge className={cn("bg-slate-400")} style={style}>
				{name}
				{frequency && <span className="ml-2 text-xs opacity-90">{frequency}</span>}
			</Badge>
		</div>
	);
};

export default function TagDisplay({ tags = [], maxTags = 5 }: TagDisplayProps) {
	const defaultTags: Tag[] = [];

	// Use provided tags or default tags, then limit to maxTags
	const allTags = tags.length > 0 ? tags : defaultTags;
	const displayTags = allTags
		.sort((a, b) => b.frequency - a.frequency) // Sort by frequency descending
		.slice(0, maxTags); // Take only the top N tags

	// Find min and max frequencies for normalization
	const frequencies = displayTags.map((tag) => tag.frequency);
	const minFreq = Math.min(...frequencies);
	const maxFreq = Math.max(...frequencies);

	// Get vibrant, high-contrast styling based on frequency
	const getTagStyle = (frequency: number) => {
		const normalized = (frequency - minFreq) / (maxFreq - minFreq);

		// Create distinct frequency tiers for better visual hierarchy
		let tier = 0;
		if (normalized > 0.8)
			tier = 4; // Top 20%
		else if (normalized > 0.6)
			tier = 3; // 60-80%
		else if (normalized > 0.4)
			tier = 2; // 40-60%
		else if (normalized > 0.2)
			tier = 1; // 20-40%
		else tier = 0; // Bottom 20%

		const styles = [
			// Tier 0 - Lowest frequency
			{
				fontSize: "0.75rem",
				backgroundColor: "#f1f5f9",
				color: "#475569",
				fontWeight: "500",
				border: "1px solid #e2e8f0",
			},
			// Tier 1
			{
				fontSize: "0.875rem",
				backgroundColor: "#dbeafe",
				color: "#1e40af",
				fontWeight: "600",
				border: "1px solid #93c5fd",
			},
			// Tier 2
			{
				fontSize: "1rem",
				backgroundColor: "#3b82f6",
				color: "#ffffff",
				fontWeight: "600",
				border: "1px solid #2563eb",
			},
			// Tier 3
			{
				fontSize: "1.125rem",
				backgroundColor: "#1d4ed8",
				color: "#ffffff",
				fontWeight: "700",
				border: "1px solid #1e40af",
			},
			// Tier 4 - Highest frequency
			{
				fontSize: "1.25rem",
				backgroundColor: "#1e40af",
				color: "#ffffff",
				fontWeight: "700",
				border: "2px solid #1e3a8a",
				boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
			},
		];

		return styles[tier];
	};

	if (displayTags.length === 0) {
		return <div className="mx-auto flex w-full max-w-2xl items-center p-6">No insight tags yet</div>;
	}

	return (
		<div className="mx-auto w-full max-w-4xl p-6">
			{/* <div className="mb-8">
				<h2 className="mb-2 font-bold text-3xl text-gray-900">Popular Tags</h2>
				<p className="text-gray-600">Larger, darker tags appear more frequently</p>
			</div> */}

			<div className="flex flex-wrap items-center justify-start">
				{displayTags
					.sort((a, b) => b.frequency - a.frequency)
					.map((tag, _index) => {
						const style = getTagStyle(tag.frequency);

						return (
							<StyledTag
								key={`${tag.name}-$index`}
								name={tag.name}
								style={style}
								frequency={tag.frequency > 1 ? tag.frequency : undefined}
							/>
						);
					})}
			</div>
		</div>
	);
}
