import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import type { Project } from "~/types"

interface ProjectContextProps {
	project: Project & { account_id: string }
	className?: string
	projectPath: string
}

export default function ProjectContextCard({ project, className, projectPath }: ProjectContextProps) {
	const themeColor = stringToColor(project.slug || "P")
	const initials = (project.slug || project.name || "P")
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2)
	return (
		<motion.div
			className={`relative overflow-hidden rounded-xl border border-border bg-background shadow-md transition-all duration-300 hover:shadow-lg ${className ?? ""}`}
			whileHover={{ y: -4, scale: 1.02 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
		>
			<Link to={projectPath} className="absolute inset-0" />
			<div className="h-1 w-full" style={{ backgroundColor: themeColor }} />
			<div className="flex items-center gap-4 p-6">
				<Avatar className="h-14 w-14 border-2" style={{ borderColor: themeColor }}>
					<AvatarFallback className="font-medium text-lg text-white" style={{ backgroundColor: themeColor }}>
						{initials}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1">
					<h3 className="mb-1 font-bold text-xl" style={{ color: themeColor }}>
						{project.name}
					</h3>
					<div className="py-2 text-md">{project.description}</div>
					<div className="flex flex-wrap gap-2 py-2 text-xs">
						<div>status:</div>
						<div className="rounded bg-muted px-2 py-0.5">{project.status}</div>
					</div>
					{/* <div className="flex flex-wrap gap-2 py-2 text-xs">
						<div>slug:</div>
						<div className="text-muted-foreground text-xs">{project.slug}</div>
					</div> */}
				</div>
			</div>
		</motion.div>
	)
}

// Utility: hash string to color
function stringToColor(str: string) {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash)
	}
	const c = (hash & 0x00ffffff).toString(16).toUpperCase()
	return `#${"00000".substring(0, 6 - c.length)}${c}`
}
