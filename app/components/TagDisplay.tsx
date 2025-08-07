interface Tag {
	name: string
	frequency: number
}

interface TagDisplayProps {
	tags?: Tag[]
	maxTags?: number
}

export default function TagDisplay({ tags = [], maxTags = 5 }: TagDisplayProps) {
	// Sample data if none provided
	const defaultTags: Tag[] = []
	// { name: "React", frequency: 45 },
	// { name: "JavaScript", frequency: 38 },
	// { name: "TypeScript", frequency: 32 },
	// { name: "Next.js", frequency: 28 },
	// { name: "CSS", frequency: 25 },
	// { name: "Node.js", frequency: 22 },
	// { name: "Python", frequency: 18 },
	// { name: "HTML", frequency: 15 },
	// { name: "Tailwind", frequency: 12 },
	// { name: "API", frequency: 10 },
	// { name: "Database", frequency: 8 },
	// { name: "Authentication", frequency: 6 },
	// { name: "Testing", frequency: 5 },
	// { name: "Docker", frequency: 4 },
	// { name: "GraphQL", frequency: 3 },
	// { name: "MongoDB", frequency: 2 },
	// { name: "Redis", frequency: 1 },
	// ]

	// Use provided tags or default tags, then limit to maxTags
	const allTags = tags.length > 0 ? tags : defaultTags
	const displayTags = allTags
		.sort((a, b) => b.frequency - a.frequency) // Sort by frequency descending
		.slice(0, maxTags) // Take only the top N tags

	// Find min and max frequencies for normalization
	const frequencies = displayTags.map((tag) => tag.frequency)
	const minFreq = Math.min(...frequencies)
	const maxFreq = Math.max(...frequencies)

	// Get vibrant, high-contrast styling based on frequency
	const getTagStyle = (frequency: number) => {
		const normalized = (frequency - minFreq) / (maxFreq - minFreq)

		// Create distinct frequency tiers for better visual hierarchy
		let tier = 0
		if (normalized > 0.8)
			tier = 4 // Top 20%
		else if (normalized > 0.6)
			tier = 3 // 60-80%
		else if (normalized > 0.4)
			tier = 2 // 40-60%
		else if (normalized > 0.2)
			tier = 1 // 20-40%
		else tier = 0 // Bottom 20%

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
		]

		return styles[tier]
	}

	if (displayTags.length === 0) {
		return <div className="mx-auto flex w-full max-w-2xl items-center p-6">No insight tags yet</div>
	}

	return (
		<div className="mx-auto w-full max-w-4xl p-6">
			{/* <div className="mb-8">
				<h2 className="mb-2 font-bold text-3xl text-gray-900">Popular Tags</h2>
				<p className="text-gray-600">Larger, darker tags appear more frequently</p>
			</div> */}

			<div className="flex flex-wrap items-center justify-start gap-4">
				{displayTags
					.sort((a, b) => b.frequency - a.frequency)
					.map((tag, index) => {
						const style = getTagStyle(tag.frequency)

						return (
							<div
								key={`${tag.name}-${index}`}
								className="cursor-pointer rounded-full px-4 py-2 transition-all duration-200 hover:scale-105"
								style={style}
							>
								<span className="select-none">
									{tag.name}
									<span className="ml-2 text-xs opacity-90">{tag.frequency}</span>
								</span>
							</div>
						)
					})}
			</div>
		</div>
	)
}
