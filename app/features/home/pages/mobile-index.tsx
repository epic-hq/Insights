import {
	ArrowLeft,
	Bell,
	Bot,
	FolderOpen,
	Lightbulb,
	MessageSquare,
	Plus,
	Search,
	Send,
	Settings,
	Sparkles,
	Users,
	X,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { MetaFunction } from "react-router"
import { useRouteLoaderData } from "react-router"
import { useNavigate } from "react-router-dom"
import { Logo } from "~/components/branding"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"

// Hooks for current project routing
import { useCurrentProject } from "~/contexts/current-project-context"
// Add Interview
import AddInterviewButton from "~/features/upload/components/AddInterviewButton"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

// --- DB types ---------------------------------------------------------------
import type { Insight, Interview, Person, Persona, Project } from "~/types"
import type { loader } from "."

// // type Persona = Database["public"]["Tables"]["personas"]["Row"];
// type InsightsRow = Database["public"]["Tables"]["insights"]["Row"];
// // UI label "Encounters" maps to the `interviews` table
// // eslint-disable-next-line @typescript-eslint/ban-ts-comment
// // @ts-expect-error optional if you haven't generated the table yet
// type InterviewsRow = Database["public"]["Tables"]["interviews"]["Row"];
// // People participants table
// // eslint-disable-next-line @typescript-eslint/ban-ts-comment
// // @ts-expect-error optional if you haven't generated the table yet
// type PeopleRow = Database["public"]["Tables"]["people"]["Row"];
// // Projects
// // eslint-disable-next-line @typescript-eslint/ban-ts-comment
// // @ts-expect-error optional if you haven't generated the table yet
// type ProjectsRow = Database["public"]["Tables"]["projects"]["Row"];

export const meta: MetaFunction = () => [{ title: "Insights • Metro" }]

// This route is display-only. Your app already wires loaders via utilities.
// Expected loader data shape from parent/util: { personas, insights, interviews, projects, people }

type LoaderData = {
	personas?: Persona[]
	insights?: Insight[]
	interviews?: Interview[] // shown as Encounters
	projects?: Project[]
	people?: Person[]
	project?: Project
}

const mainSections = [
	{
		id: "personas",
		title: "Personas",
		subtitle: "User groups & their needs",
		icon: Users,
		color: "bg-blue-600",
		size: "large" as const,
	},
	{
		id: "insights",
		title: "Insights",
		subtitle: "Friction points & problems",
		icon: Lightbulb,
		color: "bg-green-600",
		size: "large" as const,
	},
	{
		id: "encounters",
		title: "Encounters",
		subtitle: "Research conversations",
		icon: MessageSquare,
		color: "bg-red-600",
		size: "medium" as const,
	},
	{
		id: "projects",
		title: "Projects",
		subtitle: "Active initiatives",
		icon: FolderOpen,
		color: "bg-purple-600",
		size: "medium" as const,
	},
	{ id: "people", title: "People", subtitle: "Participants", icon: Users, color: "bg-gray-600", size: "full" as const },
]

export default function MetroInsightsRoute() {
	const { project } = useRouteLoaderData<typeof loader>("routes/_protected/projects")
	const {
		personas = [],
		insights = [],
		interviews = [],
		projects = [],
		people = [],
	} = useRouteLoaderData<typeof loader>("routes/_ProtectedLayout")
	const navigate = useNavigate()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const sectionData: Record<string, any[]> = useMemo(
		() => ({
			personas,
			insights,
			encounters: interviews, // UI name → DB table
			projects,
			people,
		}),
		[personas, insights, interviews, projects, people]
	)

	const [expandedSection, setExpandedSection] = useState<string | null>(null)
	const [fullScreenContent, _setFullScreenContent] = useState<any>(null)
	const [showSearch, setShowSearch] = useState(false)
	const [showChat, setShowChat] = useState(false)
	const [chatContext, setChatContext] = useState<string>("")
	const [chatMessage, setChatMessage] = useState("")
	const [selectedItem, setSelectedItem] = useState<any>(null)

	const getMainTileClasses = (size: "large" | "medium" | "full", color: string) => {
		const sizeClasses: Record<typeof size, string> = {
			large: "col-span-2 row-span-3 h-72",
			medium: "col-span-1 row-span-3 h-72",
			full: "col-span-2 row-span-3 h-72",
		} as const
		return `${sizeClasses[size]} ${color} text-white rounded-none relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-200 shadow-xl`
	}

	const toggleSection = (sectionId: string) => setExpandedSection(expandedSection === sectionId ? null : sectionId)
	const getSectionColor = (sectionId: string) => mainSections.find((s) => s.id === sectionId)?.color || "bg-gray-800"
	const toggleChat = (context = "") => {
		setChatContext(context)
		setShowChat(!showChat)
	}
	const sendMessage = () => {
		if (chatMessage.trim()) setChatMessage("")
	}

	return (
		<div className="relative min-h-screen bg-black text-white">
			{/* Header */}
			<div className="border-gray-800 border-b bg-black p-3">
				<div className="mb-3 flex flex-row items-center justify-between">
					<div className="flex items-center gap-2 font-light text-2xl text-white">
						<Logo />
						UpSight
						<div className="font-semibold text-lg text-white">{project?.name}</div>
					</div>

					<div className="flex gap-1">
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-white hover:bg-gray-800"
							title="Search everything"
							onClick={() => setShowSearch(!showSearch)}
						>
							<Search className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-gray-800" title="Notifications">
							<Bell className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-gray-800" title="Settings">
							<Settings className="h-4 w-4" />
						</Button>
					</div>
				</div>
				{showSearch && (
					<div className="relative">
						<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
						<Input
							placeholder="Search insights, personas, encounters..."
							className="h-9 border-gray-700 bg-gray-900 pl-10 text-white placeholder-gray-400"
						/>
					</div>
				)}
			</div>

			<div className="p-3 pb-24">
				{/* Expanded List */}
				{expandedSection && !fullScreenContent && (
					<div className="space-y-3">
						<div className={`-mx-4 mb-4 flex items-center justify-between p-3 ${getSectionColor(expandedSection)}`}>
							<div>
								<h2 className="font-bold text-white text-xl capitalize">{expandedSection}</h2>
								<p className="text-gray-200 text-sm">{sectionData[expandedSection]?.length ?? 0} items</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="text-white hover:bg-black hover:bg-opacity-20"
								onClick={() => setExpandedSection(null)}
								title="Back to main view"
							>
								<ArrowLeft className="h-5 w-5" />
							</Button>
						</div>

						<div className="grid grid-cols-1 gap-2">
							{(sectionData[expandedSection] || []).map((item: any) => (
								<div
									key={item.id}
									className="flex cursor-pointer items-start gap-3 border border-gray-700 bg-gray-800 p-4 transition-colors duration-200 hover:bg-gray-700"
									onClick={() => setSelectedItem({ ...item, section: expandedSection })}
								>
									{item.image_url && (
										<div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-gray-900">
											{/* eslint-disable-next-line jsx-a11y/alt-text */}
											<img src={item.image_url} className="h-full w-full object-cover" />
										</div>
									)}
									<div className="min-w-0 flex-1">
										<h3 className="mb-1 line-clamp-2 font-medium text-sm text-white">
											{item.title || item.name || item.display_name || item.participant_name}
										</h3>
										<p className="line-clamp-2 text-gray-300 text-xs">
											{item.description || item.evidence || item.status}
										</p>
										{Array.isArray(item.tags) && item.tags.length > 0 && (
											<div className="mt-2 flex flex-wrap gap-1">
												{(item.tags as string[]).slice(0, 3).map((tag, i) => (
													<span
														key={`${item.id}-tag-${i}`}
														className="rounded bg-gray-700 px-2 py-1 text-gray-200 text-xs"
													>
														{tag}
													</span>
												))}
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Main tiles */}
				{!expandedSection && !fullScreenContent && (
					<div className="mb-4 grid grid-cols-2 gap-1">
						{mainSections.slice(0, 4).map((section) => (
							<div
								key={section.id}
								className={getMainTileClasses(section.size, section.color)}
								onClick={() => toggleSection(section.id)}
							>
								<div className="relative flex h-full p-4">
									<div className="relative z-10 flex flex-1 flex-col justify-between">
										<div>
											<section.icon className="mb-4 h-10 w-10 opacity-90" />
											<h2 className="mb-2 font-bold text-3xl">{section.title}</h2>
											<p className="text-base leading-tight opacity-80">{section.subtitle}</p>
											<div className="mt-3 rounded-lg bg-black/20 p-2 backdrop-blur-sm">
												<div className="flex items-start justify-between gap-2">
													<div className="flex flex-1 items-start gap-2">
														<Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 opacity-80" />
														<p className="flex-1 text-white/90 text-xs leading-relaxed">Tap to explore</p>
													</div>
												</div>
											</div>
										</div>
										<div className="flex justify-end">
											<div className="font-medium text-sm opacity-75">{sectionData[section.id]?.length ?? 0} items</div>
										</div>
									</div>
								</div>
							</div>
						))}
						<div className="col-span-2">
							{mainSections.slice(4).map((section) => (
								<div
									key={section.id}
									className={getMainTileClasses(section.size, section.color)}
									onClick={() => toggleSection(section.id)}
								>
									<div className="relative flex h-full p-4">
										<div className="relative z-10 flex flex-1 flex-col justify-between">
											<div>
												<section.icon className="mb-4 h-10 w-10 opacity-90" />
												<h2 className="mb-2 font-bold text-3xl">{section.title}</h2>
												<p className="text-base leading-tight opacity-80">{section.subtitle}</p>
												<div className="mt-3 rounded-lg bg-black/20 p-2 backdrop-blur-sm">
													<div className="flex items-start justify-between gap-2">
														<div className="flex flex-1 items-start gap-2">
															<Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 opacity-80" />
															<p className="flex-1 text-white/90 text-xs leading-relaxed">Tap to explore</p>
														</div>
													</div>
												</div>
											</div>
											<div className="flex justify-end">
												<div className="font-medium text-sm opacity-75">
													{sectionData[section.id]?.length ?? 0} items
												</div>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{/* Bottom action bar */}
			<div className="fixed right-0 bottom-0 left-0 border-gray-800 border-t bg-black p-3">
				<div className="grid grid-cols-3 gap-2">
					{/* Add Encounter → AddInterview */}
					<div className="flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg bg-emerald-600 text-white transition-all duration-200 hover:scale-[1.02]">
						<AddInterviewButton />
						<span className="mt-1 font-medium text-xs">Add Encounter</span>
					</div>

					{/* New Project → navigate to routes.projects.new() */}
					<button
						className="flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg bg-purple-600 text-white transition-all duration-200 hover:scale-[1.02]"
						onClick={() => navigate(routes.projects.new())}
					>
						<Plus className="mb-1 h-5 w-5" />
						<span className="font-medium text-xs">New Project</span>
					</button>

					<button
						className="flex h-16 cursor-pointer flex-col items-center justify-center rounded-lg bg-indigo-600 text-white transition-all duration-200 hover:scale-[1.02]"
						onClick={() => toggleChat(expandedSection || "general")}
					>
						<Bot className="mb-1 h-5 w-5" />
						<span className="font-medium text-xs">AI Chat</span>
					</button>
				</div>
			</div>

			{/* Selected item drawer */}
			{selectedItem && (
				<div className="fixed inset-0 z-40 bg-black">
					<div className={`h-16 ${getSectionColor(selectedItem.section)} flex items-center justify-between px-4`}>
						<div className="flex items-center gap-3">
							<h2 className="font-bold text-lg text-white">
								{selectedItem.section?.[0]?.toUpperCase() + selectedItem.section?.slice(1)}:{" "}
								{selectedItem.title || selectedItem.name}
							</h2>
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setSelectedItem(null)}
							className="text-white hover:bg-white hover:bg-opacity-20"
						>
							<X className="h-6 w-6" />
						</Button>
					</div>

					<div className="h-[calc(100vh-8rem)] overflow-y-auto p-4 pb-20">
						<div className="space-y-6">
							{selectedItem.image_url && (
								<div className="h-48 w-full overflow-hidden rounded-lg bg-gray-800">
									{/* eslint-disable-next-line jsx-a11y/alt-text */}
									<img src={selectedItem.image_url} className="h-full w-full object-cover" />
								</div>
							)}
							<div className="space-y-4">
								<p className="text-gray-300 leading-relaxed">{selectedItem.description || selectedItem.evidence}</p>
								{Array.isArray(selectedItem.tags) && (
									<div className="flex flex-wrap gap-2">
										{selectedItem.tags.map((tag: string, idx: number) => (
											<Badge key={`tag-${idx}`} variant="secondary" className="bg-gray-800 text-gray-300">
												{tag}
											</Badge>
										))}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Chat sheet */}
			{showChat && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/50" onClick={() => setShowChat(false)} />
					<div
						className={`absolute right-0 bottom-0 left-0 h-1/2 border-t-2 bg-gray-900 ${expandedSection ? getSectionColor(expandedSection).replace("bg-", "border-") : "border-gray-700"} md:right-0 md:left-auto md:h-full md:w-96 md:border-t-0 md:border-l-2`}
					>
						<div
							className={`flex items-center justify-between border-gray-700 border-b p-4 ${expandedSection ? `${getSectionColor(expandedSection)} bg-opacity-20` : ""}`}
						>
							<div>
								<h3 className="font-semibold text-white">AI Assistant</h3>
								<p className="text-gray-300 text-xs">
									Context: {expandedSection ? expandedSection[0].toUpperCase() + expandedSection.slice(1) : "General"}
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setShowChat(false)}
								className="text-gray-400 hover:text-white"
							>
								<ArrowLeft className="h-7 w-7 font-semibold" />
							</Button>
						</div>
						<div className="h-full flex-1 overflow-y-auto p-4 pb-20">
							<div className="space-y-3">
								<div className="rounded-lg bg-gray-800 p-3">
									<p className="text-sm">
										Hi! I'm here to help you analyze your {chatContext} data. What would you like to know?
									</p>
								</div>
							</div>
						</div>
						<div className="absolute right-0 bottom-0 left-0 border-gray-700 border-t bg-gray-900 p-4">
							<div className="flex gap-2">
								<Input
									value={chatMessage}
									onChange={(e) => setChatMessage(e.target.value)}
									placeholder="Ask about your research..."
									className="flex-1 border-gray-600 bg-gray-800 text-white"
									onKeyDown={(e) => e.key === "Enter" && sendMessage()}
								/>
								<Button onClick={sendMessage} size="icon" className="bg-indigo-600 hover:bg-indigo-700">
									<Send className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
