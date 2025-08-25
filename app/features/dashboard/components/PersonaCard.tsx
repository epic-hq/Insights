// Enhanced component for displaying comprehensive persona information

import type { CSSProperties } from "react"
import { Link } from "react-router-dom"
import type { Database } from "~/../supabase/types"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"

type Persona = Database["public"]["Tables"]["personas"]["Row"] & {
	people_personas?: {
		people: {
			id: string
			name: string
			segment: string | null
		} | null
	}[]
}

interface PersonaCardProps {
	persona: Persona
	style?: CSSProperties
}

export default function PersonaCard({ persona, style }: PersonaCardProps) {
	// Safely extract people data with null checks
	const people = (persona.people_personas || [])
		.map((pp) => pp?.people)
		.filter((person): person is NonNullable<typeof person> => person !== null && person !== undefined)

	// Safely generate initials with fallback
	const personaInitials =
		(persona.name || "")
			.replace(/^The /, "") // Remove "The " prefix
			.split(" ")
			.map((word) => word?.[0] || "")
			.join("")
			.toUpperCase()
			.slice(0, 2) || "??"

	return (
		<Link
			to={`/personas/${persona.id}`}
			className="block transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
			style={style}
		>
			<div
				className="rounded-xl border-2 bg-white p-6 shadow-sm"
				style={{ borderColor: persona.color_hex || "#e5e7eb" }}
			>
				{/* Header with Avatar and Color */}
				<div className="mb-4 flex items-center gap-4">
					<Avatar className="h-12 w-12" style={{ backgroundColor: persona.color_hex || "#6b7280" }}>
						<AvatarFallback
							className="font-bold text-white"
							style={{ backgroundColor: persona.color_hex || "#6b7280" }}
						>
							{personaInitials}
						</AvatarFallback>
					</Avatar>
					<div className="flex-1">
						<h3 className="font-bold text-gray-900 text-lg">{persona.name}</h3>
						<div className="flex items-center gap-2">
							<div className="h-3 w-3 rounded-full" style={{ backgroundColor: persona.color_hex || "#6b7280" }} />
							<span className="text-gray-500 text-sm">
								{people.length} {people.length === 1 ? "person" : "people"}
							</span>
						</div>
					</div>
				</div>

				{/* Description */}
				{persona.description && persona.description.trim() && (
					<div className="mb-4">
						<p className="text-gray-600 text-sm leading-relaxed">{persona.description}</p>
					</div>
				)}

				{/* People List */}
				{people.length > 0 && (
					<div className="space-y-3">
						<h4 className="font-medium text-gray-900 text-sm">People with this persona:</h4>
						<div className="flex flex-wrap gap-2">
							{people.slice(0, 6).map((person) => (
								<Badge
									key={person.id}
									variant="secondary"
									className="text-xs"
									style={{
										backgroundColor: `${persona.color_hex}20`,
										borderColor: persona.color_hex,
										color: persona.color_hex,
									}}
								>
									{person.name}
									{person.segment && <span className="ml-1 opacity-70">({person.segment})</span>}
								</Badge>
							))}
							{people.length > 6 && (
								<Badge variant="outline" className="text-xs">
									+{people.length - 6} more
								</Badge>
							)}
						</div>
					</div>
				)}

				{/* Empty State */}
				{people.length === 0 && (
					<div className="py-4 text-center">
						<p className="text-gray-400 text-sm">No people assigned to this persona yet</p>
					</div>
				)}

				{/* Metadata */}
				<div className="mt-4 border-gray-100 border-t pt-4">
					<div className="flex items-center justify-between text-gray-400 text-xs">
						<span>Created {persona.created_at ? new Date(persona.created_at).toLocaleDateString() : "Unknown"}</span>
						{persona.updated_at && persona.updated_at !== persona.created_at && (
							<span>Updated {new Date(persona.updated_at).toLocaleDateString()}</span>
						)}
					</div>
				</div>
			</div>
		</Link>
	)
}
