import { motion } from "framer-motion"
import { ChevronDown, ChevronUp, FileText, Lightbulb } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Avatar, AvatarFallback } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { createClient } from "~/lib/supabase/client"
import { cn } from "~/lib/utils"
import type { Evidence, Insight, Person, Theme } from "~/types"

export type ThemeCardTheme = Pick<Theme, "id" | "name" | "statement"> & {
	evidence_count?: number
	insights_count?: number
}

type LinkedEvidence = Pick<Evidence, "id" | "verbatim" | "support" | "interview_id"> & {
	participants?: Array<{
		role: string | null
		person: Pick<Person, "id" | "name" | "image_url"> & {
			persona?: { id: string; name: string; color_hex?: string | null }
		}
	}>
}

type ThemeCardProps = {
	theme: ThemeCardTheme
	className?: string
	defaultExpanded?: boolean
}

export function ThemeCard({ theme, className, defaultExpanded = false }: ThemeCardProps) {
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const supabase = createClient()

	const [evidence, setEvidence] = useState<LinkedEvidence[]>([])
	const [insights, setInsights] = useState<Pick<Insight, "id" | "name">[]>([])
	const [isExpanded, setIsExpanded] = useState(defaultExpanded)
	const [isHovered, setIsHovered] = useState(false)

	useEffect(() => {
		let active = true
		async function load() {
			// 1) get theme->evidence links
			const { data: links } = await supabase
				.from("theme_evidence")
				.select("evidence:evidence_id(id, verbatim, support, interview_id)")
				.eq("theme_id", theme.id)
				.order("created_at", { ascending: false })
			type LinkRow = { evidence: Pick<Evidence, "id" | "verbatim" | "support" | "interview_id"> | null }
			const ev = ((links ?? []) as LinkRow[])
				.map((l) => l.evidence)
				.filter((x): x is NonNullable<LinkRow["evidence"]> => Boolean(x))

			// 2) participants for each evidence's interview (role + person + persona)
			const interviewIds = Array.from(new Set(ev.map((e) => e.interview_id).filter(Boolean))) as string[]
			let participantsByInterview = new Map<string, LinkedEvidence["participants"]>()
			if (interviewIds.length) {
				const { data: parts } = await supabase
					.from("interview_people")
					.select("interview_id, role, people:person_id(id, name, image_url)")
					.in("interview_id", interviewIds)
				type PartRow = {
					interview_id: string
					role: string | null
					people: { id: string; name: string | null; image_url: string | null } | null
				}
				const map = new Map<string, LinkedEvidence["participants"]>()
				for (const row of (parts ?? []) as PartRow[]) {
					const entry = {
						role: row.role,
						person: {
							id: row.people?.id || "",
							name: row.people?.name || "",
							image_url: row.people?.image_url || null,
							persona: undefined,
						},
					}
					const existing = map.get(row.interview_id) || []
					map.set(row.interview_id, [...existing, entry])
				}
				participantsByInterview = map
			}

			// 3) insights by interview (proxy linkage)
			let insightsList: Pick<Insight, "id" | "name">[] = []
			if (interviewIds.length) {
				const { data: ins } = await supabase
					.from("insights")
					.select("id, name, interview_id")
					.in("interview_id", interviewIds)
					.limit(20)
				insightsList = ((ins ?? []) as Array<{ id: string; name: string | null }>).map((i) => ({
					id: i.id,
					name: i.name ?? "",
				}))
			}

			if (!active) return
			const withParticipants: LinkedEvidence[] = ev.map((e) => ({
				...e,
				participants: participantsByInterview.get(e.interview_id || "") || [],
			}))
			setEvidence(withParticipants)
			setInsights(insightsList)
		}
		load()
		return () => {
			active = false
		}
	}, [supabase, theme.id])

	const insightsPreview = useMemo(() => insights.slice(0, 3), [insights])
	const evidencePreview = useMemo(() => evidence.slice(0, 3), [evidence])

	const handleCardClick = () => {
		if (!isExpanded) {
			// Navigate to detail page when in compact mode
			window.location.href = routes.themes.detail(theme.id)
		}
	}

	return (
		<motion.div
			className={cn(
				"group relative overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900",
				"transition-all duration-300 ease-out",
				"hover:shadow-black/5 hover:shadow-lg dark:hover:shadow-white/5",
				!isExpanded && "cursor-pointer",
				className
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={handleCardClick}
			whileHover={{ y: -2, scale: 1.01 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
		>
			{/* Clean Metro-style Layout */}
			<div className="p-6">
				{/* Header Section */}
				<div className="mb-4 flex items-start justify-between">
					<div className="flex-1">
						<motion.h3
							className="mb-2 font-light text-gray-900 text-xl leading-tight tracking-tight dark:text-white"
							style={{ color: isHovered ? "#6366f1" : undefined }}
							transition={{ duration: 0.3 }}
						>
							{theme.name}
						</motion.h3>

						{/* Theme Color Accent Line */}
						<motion.div
							className="h-1 w-12 rounded-full bg-indigo-500 transition-all duration-300"
							animate={{ width: isHovered ? "3rem" : "2.5rem" }}
						/>
					</div>

					{/* Expand/Collapse Button */}
					<Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="ml-2 h-8 w-8 p-0">
						{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
					</Button>
				</div>

				{/* Statement - Always visible but truncated in compact mode */}
				{theme.statement && (
					<div className="mb-4">
						<p
							className={cn("text-gray-600 text-sm leading-relaxed dark:text-gray-400", !isExpanded && "line-clamp-2")}
						>
							{theme.statement}
						</p>
					</div>
				)}

				{/* Counts Section - Always visible */}
				<div className="mb-4 flex items-center gap-3">
					<motion.div
						className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 dark:bg-gray-800"
						whileHover={{ scale: 1.05 }}
					>
						<FileText className="h-3 w-3 text-gray-500 dark:text-gray-400" />
						<span className="font-medium text-gray-700 text-xs dark:text-gray-300">
							{theme.evidence_count ?? 0} Evidence
						</span>
					</motion.div>

					<motion.div
						className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 dark:bg-gray-800"
						whileHover={{ scale: 1.05 }}
					>
						<Lightbulb className="h-3 w-3 text-gray-500 dark:text-gray-400" />
						<span className="font-medium text-gray-700 text-xs dark:text-gray-300">
							{theme.insights_count ?? 0} Insights
						</span>
					</motion.div>
				</div>

				{/* Expanded Content */}
				<motion.div
					initial={false}
					animate={{
						height: isExpanded ? "auto" : 0,
						opacity: isExpanded ? 1 : 0,
					}}
					transition={{ duration: 0.3, ease: "easeOut" }}
					className="overflow-hidden"
				>
					<div className="space-y-4">
						{/* Evidence Preview */}
						{evidencePreview.length > 0 && (
							<div>
								<h4 className="mb-2 font-medium text-gray-900 text-sm dark:text-white">Recent Evidence</h4>
								<div className="space-y-2">
									{evidencePreview.map((e) => (
										<div key={e.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
											<Link
												to={`${projectPath || ""}/evidence/${e.id}`}
												className="block hover:text-indigo-600 dark:hover:text-indigo-400"
											>
												<p className="line-clamp-2 text-sm">"{e.verbatim}"</p>
												<div className="mt-1 flex items-center justify-between">
													<span className="text-gray-500 text-xs">{e.support}</span>
													{e.participants && e.participants.length > 0 && (
														<div className="-space-x-1 flex">
															{e.participants.slice(0, 2).map((p, idx) => {
																const initials = (p.person.name || "?")
																	.split(" ")
																	.map((w) => w[0])
																	.join("")
																	.toUpperCase()
																	.slice(0, 2)
																return (
																	<Avatar key={`${p.person.id}-${idx}`} className="h-5 w-5 border-2 border-white">
																		<AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
																	</Avatar>
																)
															})}
														</div>
													)}
												</div>
											</Link>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Insights Preview */}
						{insightsPreview.length > 0 && (
							<div>
								<h3 className="mb-4 font-semibold text-foreground">Insights</h3>
								{insights.length > 0 && (
									<div className="">
										{" "}
										{/* TODO: border bg-background p-6 */}
										<div className="space-y-3">
											{insights.map((insight) => (
												<div key={insight.id} className="max-w-xl rounded-lg border p-2">
													<div key={insight.id} className="border-green-500 border-l-4 pl-3">
														<Link
															to={routes.insights.detail(insight.id)}
															className="font-medium text-blue-600 hover:text-blue-800"
														>
															{insight.name}
														</Link>
														{insight.category && (
															<Badge variant="secondary" className="ml-2">
																{insight.category}
															</Badge>
														)}
														{insight.impact && (
															<div className="mt-1 text-foreground/50 text-sm">Impact: {insight.impact}</div>
														)}
													</div>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</motion.div>

				{/* Footer - Open Button */}
				{/*<div className="mt-4 flex items-center justify-between">

					<Button asChild variant="ghost" size="sm" className="text-xs">
            <Link to={routes.themes.detail(theme.id)}>Open Theme</Link>
          </Button>
					*/}

				{/* Subtle Hover Indicator */}
				{/*
					<motion.div
						className="h-2 w-2 rounded-full bg-indigo-500 transition-all duration-300"
						animate={{
							scale: isHovered ? 1.5 : 1,
							opacity: isHovered ? 1 : 0.5,
						}}
					/>

				</div>
			*/}
			</div>

			{/* Subtle Gradient Overlay on Hover */}
			<motion.div
				className="pointer-events-none absolute inset-0 rounded-2xl opacity-0"
				style={{
					background: "linear-gradient(135deg, #6366f108 0%, #6366f102 100%)",
				}}
				animate={{ opacity: isHovered ? 1 : 0 }}
				transition={{ duration: 0.3 }}
			/>
		</motion.div>
	)
}
