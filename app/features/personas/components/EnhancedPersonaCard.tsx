import { formatDistance } from "date-fns"
import { motion } from "framer-motion"
import { Palette, Users } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"

import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card"
import { cn } from "~/lib/utils"
import type { Database } from "~/types"

type PersonaRow = Database["public"]["Tables"]["personas"]["Row"]

interface EnhancedPersonaCardProps {
	persona: PersonaRow & {
		people_personas?: Array<{ count: number }>
	}
	className?: string
}

export default function EnhancedPersonaCard({ persona, className }: EnhancedPersonaCardProps) {
	const [isHovered, setIsHovered] = useState(false)

	// Calculate people count from junction table
	const peopleCount = persona.people_personas?.[0]?.count || 0

	// Get persona details with fallbacks
	const name = persona.name || "Untitled Persona"
	const description = persona.description || "No description available"
	const themeColor = persona.color_hex || "#6b7280"

	// Get initials for avatar
	const initials =
		name
			.split(" ")
			.map((word) => word[0])
			.join("")
			.toUpperCase()
			.slice(0, 2) || "?"

	return (
		<Link to={`/personas/${persona.id}`}>
			<motion.div
				className={cn(
					"group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-background",
					"transition-all duration-300 ease-out",
					"hover:shadow-black/10 hover:shadow-lg dark:hover:shadow-white/5",
					className
				)}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				whileHover={{ y: -4, scale: 1.02 }}
				transition={{ duration: 0.3, ease: "easeOut" }}
			>
				{/* Theme color accent bar */}
				<div className="h-1 w-full" style={{ backgroundColor: themeColor }} />

				{/* Gradient overlay that appears on hover */}
				<motion.div
					className="pointer-events-none absolute inset-0 opacity-0"
					style={{
						background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`,
					}}
					animate={{ opacity: isHovered ? 1 : 0 }}
					transition={{ duration: 0.3 }}
				/>

				<Card className="border-0 bg-transparent shadow-none">
					<CardHeader className="pb-3">
						{/* Header with avatar and people count */}
						<div className="flex items-start">
							<motion.div className="relative" whileHover={{ scale: 1.1 }} transition={{ duration: 0.2 }}>
								<Avatar className="h-16 w-16 border-2" style={{ borderColor: themeColor }}>
									<AvatarFallback className="font-medium text-lg text-white" style={{ backgroundColor: themeColor }}>
										{persona.image_url ? (
											<img src={persona.image_url} alt={name} className="h-full w-full object-cover" />
										) : (
											initials
										)}
									</AvatarFallback>
								</Avatar>
								<motion.div
									className="-bottom-1 -right-1 absolute flex h-6 w-6 items-center justify-center rounded-full shadow-sm"
									style={{ backgroundColor: themeColor }}
									animate={{ rotate: isHovered ? 180 : 0 }}
									transition={{ duration: 0.3 }}
								>
									<Palette className="h-3 w-3 text-white" />
								</motion.div>
							</motion.div>

							<div className="flex w-full items-start justify-between">
								{/* Title */}
								<div>
									<motion.h3
										className="mb-3 ml-4 font-bold text-foreground text-xl leading-tight"
										style={{ color: isHovered ? themeColor : undefined }}
										transition={{ duration: 0.3 }}
									>
										{name}
									</motion.h3>
								</div>
								{/* People Count */}
								<div className="flex items-center gap-1">
									<motion.div
										className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 font-medium text-muted-foreground text-xs"
										whileHover={{ scale: 1.05 }}
									>
										<Users className="h-3 w-3" />
										{peopleCount}
									</motion.div>
								</div>
							</div>
						</div>
					</CardHeader>

					<CardContent className="pt-0">
						{/* Description */}
						<p className="mb-4 line-clamp-3 text-muted-foreground text-sm leading-relaxed">{description}</p>

						{/* People count display
						{peopleCount > 0 && (
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">People</span>
								</div>
							</div>
						)} */}

						<CardFooter>
							{/* Metadata */}
							<div className="flex w-full justify-end text-muted-foreground/50 text-xs">
								<span>Updated {formatDistance(new Date(persona.updated_at), new Date(), { addSuffix: true })}</span>
							</div>
						</CardFooter>
					</CardContent>
				</Card>

				{/* Bottom gradient border effect */}
				<motion.div
					className="absolute right-0 bottom-0 left-0 h-px"
					style={{
						background: `linear-gradient(90deg, transparent 0%, ${themeColor} 50%, transparent 100%)`,
					}}
					animate={{ opacity: isHovered ? 1 : 0 }}
					transition={{ duration: 0.3 }}
				/>
			</motion.div>
		</Link>
	)
}
