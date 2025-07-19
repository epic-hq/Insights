// app/components/InsightCardV3.tsx

import consola from "consola"
import {
	AlertTriangle,
	Check,
	CheckSquare,
	Lightbulb,
	MessageCircle,
	Pencil,
	QuoteIcon,
	Send,
	Sparkles,
	ThumbsDown,
	ThumbsUp,
	TrendingUp,
	Users,
} from "lucide-react"
import { useState } from "react"

import EditableTextarea from "~/components/EditableTextarea"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "~/components/ui/card"
import InlineEdit from "~/components/ui/inline-edit"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import type { InsightView } from "~/types"

export interface Comment {
	id: string
	author: string
	text: string
	timestamp: string
}

export interface InsightCardV2Props {
	insight: InsightView
	onTagClick?: (tag: string) => void
	onUpvote?: () => void
	onDownvote?: () => void
	onConvertToOpportunity?: () => void
	onArchive?: () => void
	onDontShowMe?: () => void
}

// Mock API functions
const mockAPI = {
	updateInsight: async (id: string, field: string, value: string) => {
		consola.log(`Updating insight ${id}: ${field} = ${value}`)
		// Simulate API delay
		await new Promise((resolve) => setTimeout(resolve, 500))
		return { success: true }
	},

	vote: async (id: string, voteType: "up" | "down") => {
		consola.log(`Voting ${voteType} on insight ${id}`)
		await new Promise((resolve) => setTimeout(resolve, 300))
		return { success: true }
	},

	addComment: async (id: string, comment: string) => {
		consola.log(`Adding comment to insight ${id}: ${comment}`)
		await new Promise((resolve) => setTimeout(resolve, 500))
		return { success: true, id: Date.now().toString() }
	},

	hideInsight: async (id: string) => {
		consola.log(`Hiding insight ${id}`)
		await new Promise((resolve) => setTimeout(resolve, 300))
		return { success: true }
	},

	archiveInsight: async (id: string) => {
		consola.log(`Archiving insight ${id}`)
		await new Promise((resolve) => setTimeout(resolve, 300))
		return { success: true }
	},
}

const getCategoryColor = (category: string) => {
	const colors = {
		Onboarding: "bg-blue-100 text-blue-800 border-blue-200",
		"Mobile Experience": "bg-green-100 text-green-800 border-green-200",
		Dashboard: "bg-purple-100 text-purple-800 border-purple-200",
	}
	return colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200"
}

const getJourneyStageColor = (stage: string) => {
	const colors = {
		Activation: "bg-orange-100 text-orange-800 border-orange-200",
		Usage: "bg-teal-100 text-teal-800 border-teal-200",
		Optimization: "bg-indigo-100 text-indigo-800 border-indigo-200",
	}
	return colors[stage as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200"
}

export default function InsightCardV2({
	insight,
	onUpvote = () => {},
	onDownvote = () => {},
	onConvertToOpportunity = () => {},
	onArchive = () => {},
	onDontShowMe = () => {},
	onTagClick = () => {},
}: InsightCardV2Props) {
	const [editingField, setEditingField] = useState<string | null>(null)
	const [editingValue, setEditingValue] = useState<string>("")

	// Helper to handle save
	const [savingField, setSavingField] = useState<string | null>(null)

	const handleSaveField = async (field: string, value?: string) => {
		if (savingField === field) return // Prevent double-save
		setSavingField(field)
		try {
			const newValue = typeof value === "string" ? value : editingValue
			if (localInsight[field] !== newValue) {
				// Optimistically update local state
				setLocalInsight((prev) => ({ ...prev, [field]: newValue }))
				// Persist change to DB
				await fetch("/api/update-field", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						table: "insights",
						id: localInsight.id,
						field,
						value: newValue,
					}),
				})
			}
		} finally {
			setEditingField(null)
			setSavingField(null)
		}
	}

	// Helper to handle edit start
	const handleEditStart = (field: string) => {
		// If another field is being edited, save it first
		if (editingField && editingField !== field) {
			handleSaveField(editingField)
		}
		setEditingField(field)
		setEditingValue(localInsight[field] || "")
	}

	// Handler for inline text submit
	const _handleTextSubmit = (newText: string) => {
		if (newText !== localInsight[field] && onUpdate) {
			onUpdate({ ...localInsight, [field]: newText })
		}
	}

	// Reusable EditableField component
	const EditableField = ({
		field,
		className,
		placeholder,
		multiline = false,
	}: {
		field: string
		className?: string
		placeholder?: string
		multiline?: boolean
	}) => {
		const isEditing = editingField === field
		const isSaving = savingField === field
		const value = localInsight[field] || ""

		return (
			<div
				className="group relative flex min-h-[1.5rem] items-start"
				onMouseLeave={() => isEditing && handleSaveField(field)}
			>
				{isEditing ? (
					<>
						<div key="insight-field">
							{multiline ? (
								<textarea
									key="insight-field"
									defaultValue={editingValue}
									// value={editingValue}
									autoFocus
									rows={3}
									dir="ltr"
									onChange={(e) => setEditingValue(e.target.value)}
									onBlur={() => handleSaveField(field)}
									className={`w-full resize-none border-blue-200 border-b bg-white pr-8 focus:outline-none ${className || ""}`}
									placeholder={placeholder}
								/>
							) : (
								<input
									type="text"
									// value={editingValue}
									defaultValue={editingValue}
									autoFocus
									dir="ltr"
									onChange={(e) => setEditingValue(e.target.value)}
									onBlur={() => handleSaveField(field)}
									className={`w-full border-blue-200 border-b bg-white pr-8 focus:outline-none ${className || ""}`}
									placeholder={placeholder}
								/>
							)}
						</div>
						<button
							type="button"
							className="absolute top-1 right-0 z-10 p-1 opacity-100 transition-opacity"
							onMouseDown={(e) => {
								e.preventDefault()
								handleSaveField(field)
							}}
							aria-label={`Save ${field}`}
						>
							{isSaving ? (
								<CheckSquare className="h-4 w-4 animate-spin text-gray-400" />
							) : (
								<Check className="h-4 w-4 text-green-500 hover:text-green-700" />
							)}
						</button>
					</>
				) : (
					<>
						<div className={`w-full pr-8 ${className || ""}`}>
							{value || <span className="text-gray-400">{placeholder || "(No value)"}</span>}
						</div>
						<button
							type="button"
							className="absolute top-1 right-0 z-10 p-1 opacity-0 transition-opacity group-hover:opacity-100"
							onClick={() => handleEditStart(field)}
							aria-label={`Edit ${field}`}
						>
							<Pencil className="h-4 w-4 text-gray-400 hover:text-gray-700" />
						</button>
					</>
				)}
			</div>
		)
	}
	const [localInsight, setLocalInsight] = useState<InsightView>({
		...insight,
		comments: insight.comments || [],
		upvotes: insight.upvotes || 0,
		downvotes: insight.downvotes || 0,
		opportunityIdeas: insight.opportunityIdeas || [],
		interviews: insight.interviews || [],
		personas: insight.personas || [],
	})
	const [_showMore, _setShowMoree] = useState(false)

	// State for managing comments and votes
	const [votedInsights, setVotedInsights] = useState<{ [key: string]: "up" | "down" | null }>({})
	const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({})
	const [newComments, setNewComments] = useState<{ [key: string]: string }>({})

	const handleVote = async (voteType: "up" | "down") => {
		const currentVote = votedInsights[localInsight.id]
		const newVote = currentVote === voteType ? null : voteType

		setVotedInsights((prev) => ({
			...prev,
			[localInsight.id]: newVote,
		}))

		await mockAPI.vote(localInsight.id, voteType)
	}

	const handleAddComment = async () => {
		const commentText = newComments[localInsight.id]?.trim()
		if (!commentText) return

		const newComment: Comment = {
			id: Date.now().toString(),
			author: "You",
			text: commentText,
			timestamp: new Date().toISOString(),
		}

		setLocalInsight((prev) => ({
			...prev,
			comments: [...(prev.comments || []), newComment],
		}))

		setNewComments((prev) => ({ ...prev, [localInsight.id]: "" }))

		await mockAPI.addComment(localInsight.id, commentText)
	}

	const handleHide = async () => {
		onDontShowMe()
		await mockAPI.hideInsight(localInsight.id)
	}

	const handleArchive = async () => {
		onArchive()
		await mockAPI.archiveInsight(localInsight.id)
	}

	const toggleComments = () => {
		setShowComments((prev) => ({
			...prev,
			[localInsight.id]: !prev[localInsight.id],
		}))
	}

	return (
		<Card className="flex flex-col border-0 bg-white shadow-lg transition-all duration-300 hover:shadow-xl">
			<CardHeader className="pb-4">
				<div className="mb-3 flex items-start justify-between">
					<div className="flex-1" />
					<div className="flex flex-wrap gap-2">
						<div className="flex items-center gap-2 font-light text-xs uppercase">Stage: </div>
						<Badge
							variant="outline"
							className={getJourneyStageColor(localInsight.journeyStage || "")}
							onClick={() => onTagClick(localInsight.journeyStage || "")}
						>
							{localInsight.journeyStage || ""}
						</Badge>
						<div className="flex items-center gap-2 font-light text-xs uppercase">Category: </div>
						<Badge
							variant="outline"
							className={getCategoryColor(localInsight.category || "")}
							onClick={() => onTagClick(localInsight.category || "")}
						>
							{localInsight.category || ""}
						</Badge>
					</div>
				</div>

				{/* Name field with special styling */}
				<div className="mb-3">
					<EditableField field="name" className="font-bold text-2xl text-gray-900" placeholder="Enter insight name" />
				</div>

				<div className="rounded-r-md border-l-4 bg-slate-50 p-3">
					<div className="flex items-start gap-2">
						<CheckSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
						<div className="flex-1">
							<h4 className="mb-1 font-medium text-blue-700 text-xs">JTBD</h4>
							{/* <EditableField
								field="jtbd"
								className="font-medium text-blue-800 text-sm leading-relaxed"
								placeholder="What job is the user trying to do?"
								multiline
							/> */}
							{/* Testing Jett's InlineEdit */}
							<InlineEdit
								value={localInsight.jtbd || ""}
								onSubmit={async (newValue: string) => {
									// Optimistically update local state
									setLocalInsight((prev) => ({ ...prev, jtbd: newValue }))
									await handleSaveField("jtbd", newValue)
								}}
								textClassName="font-medium text-blue-800 text-sm leading-relaxed"
								inputClassName="text-sm"
								submitOnBlur
								autoFocus={false}
								showEditButton={false}
								multiline
							/>
						</div>
					</div>
				</div>

				<div className="rounded-r-md border-blue-400 bg-blue-50 p-3">
					<div className="flex items-start gap-2">
						<QuoteIcon className="mt-0.5 h-4 w-4 flex-shrink-0 " />
						<div className="flex-1">
							{/* <h4 className="mb-1 font-medium text-blue-700 text-xs">Quote</h4> */}
							<InlineEdit
								value={localInsight.evidence || ""}
								onSubmit={async (newValue: string) => {
									setLocalInsight((prev) => ({ ...prev, evidence: newValue }))
									await handleSaveField("evidence", newValue)
								}}
								textClassName="font-medium text-blue-800 text-sm leading-relaxed"
								inputClassName="text-sm"
								submitOnBlur
								autoFocus={false}
								showEditButton={false}
								multiline
								placeholder="Supporting quote or evidence"
							/>
						</div>
					</div>
				</div>
			</CardHeader>

			<CardContent className="flex-1 space-y-4">
				<div className="space-y-3">
					<div>
						<h4 className="mb-1 text-gray-500 text-xs uppercase">Pain Point</h4>
						<InlineEdit
							value={localInsight.pain || ""}
							onSubmit={async (newValue: string) => {
								setLocalInsight((prev) => ({ ...prev, pain: newValue }))
								await handleSaveField("pain", newValue)
							}}
							textClassName="text-gray-900 text-md"
							inputClassName="text-sm"
							submitOnBlur
							autoFocus={false}
							showEditButton={false}
							multiline
							placeholder="What pain or friction does the user experience?"
						/>
					</div>

					<div>
						<h4 className="mb-1 text-gray-500 text-xs uppercase">Desired Outcome</h4>
						<InlineEdit
							value={localInsight.desiredOutcome || ""}
							onSubmit={async (newValue: string) => {
								setLocalInsight((prev) => ({ ...prev, desiredOutcome: newValue }))
								await handleSaveField("desiredOutcome", newValue)
							}}
							textClassName="text-gray-900 text-md"
							inputClassName="text-sm"
							submitOnBlur
							autoFocus={false}
							showEditButton={false}
							multiline
							placeholder="What outcome does the user want to achieve?"
						/>
					</div>

					<div>
						<h4 className="mb-1 text-gray-500 text-xs uppercase">Context & Details</h4>
						<InlineEdit
							value={localInsight.details || ""}
							onSubmit={async (newValue: string) => {
								setLocalInsight((prev) => ({ ...prev, details: newValue }))
								await handleSaveField("details", newValue)
							}}
							textClassName="text-gray-900 text-md"
							inputClassName="text-sm"
							submitOnBlur
							autoFocus={false}
							showEditButton={false}
							multiline
							placeholder="Additional context and details"
						/>
					</div>

					<div className="flex items-center justify-between pt-2">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-1">
								<TrendingUp className="h-4 w-4 text-red-500" />
								<span className="font-medium text-sm">Impact</span>
								<div className="flex gap-1">
									{[1, 2, 3, 4, 5].map((i) => (
										<div
											key={i}
											className={`h-2 w-2 rounded-full ${
												i <= (typeof localInsight.impact === "number" ? localInsight.impact : 0)
													? "bg-red-500"
													: "bg-gray-200"
											}`}
										/>
									))}
								</div>
							</div>
							<div className="flex items-center gap-1">
								<Sparkles className="h-4 w-4 text-purple-500" />
								<span className="font-medium text-sm">Novelty</span>
								<div className="flex gap-1">
									{[1, 2, 3, 4, 5].map((i) => (
										<div
											key={i}
											className={`h-2 w-2 rounded-full ${
												i <= (localInsight.novelty || 0) ? "bg-purple-500" : "bg-gray-200"
											}`}
										/>
									))}
								</div>
							</div>
						</div>
					</div>

					{localInsight.contradictions && (
						<div className="rounded-md border border-amber-200 bg-amber-50 p-2">
							<div className="flex items-start gap-2">
								<AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
								<div className="flex-1">
									<h4 className="font-medium text-amber-800 text-sm">Contradictions</h4>
									<EditableTextarea
										table="insights"
										id={localInsight.id}
										field="contradictions"
										initialValue={localInsight.contradictions || ""}
										label=""
										className="text-amber-700 text-xs"
									/>
								</div>
							</div>
						</div>
					)}
				</div>

				<Separator />

				<div>
					<h4 className="mb-2 flex items-center gap-1 font-medium text-gray-700 text-sm">
						<Users className="h-4 w-4" />
						Source
					</h4>
					<div className="space-y-1">
						{localInsight.interviews?.map((interview, index) => (
							<div key={interview.id} className="flex justify-between text-gray-600 text-sm">
								<span>{localInsight.personas?.[index]?.name || "Unknown Persona"}</span>
								<span>{interview.participant}</span>
							</div>
						)) || "No interview data available"}
					</div>
				</div>

				{localInsight.opportunityIdeas && localInsight.opportunityIdeas.length > 0 && (
					<div className="rounded-lg border border-gray-200 bg-green-50 p-3">
						<h4 className="mb-2 flex items-center gap-1 font-medium text-gray-700 text-sm">
							<Lightbulb className="h-4 w-4" />
							Opportunity Ideas
						</h4>
						<div className="space-y-2">
							{localInsight.opportunityIdeas?.map((idea, index) => (
								<div
									key={index}
									className="flex items-center justify-between rounded-md border border-gray-100 bg-white p-2"
								>
									<span className="text-gray-700 text-sm">{idea}</span>
									<Button
										size="sm"
										variant="ghost"
										className="h-6 w-6 p-0 hover:bg-green-100"
										title="Create Opportunity"
									>
										<div className="relative">
											<Lightbulb className="h-3 w-3" />
											<div className="-top-0.5 -right-0.5 absolute flex h-2 w-2 items-center justify-center rounded-full bg-green-500">
												<span className="text-white text-xs leading-none">+</span>
											</div>
										</div>
									</Button>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Comments Section */}
				{showComments[localInsight.id] && (
					<div className="space-y-3 border-t pt-4">
						<h4 className="font-medium text-gray-700 text-sm">Comments</h4>
						<div className="max-h-40 space-y-2 overflow-y-auto">
							{localInsight.comments?.map((comment) => (
								<div key={comment.id} className="rounded-md bg-gray-50 p-2">
									<div className="mb-1 flex items-start justify-between">
										<span className="font-medium text-gray-700 text-xs">{comment.author}</span>
										<span className="text-gray-500 text-xs">{new Date(comment.timestamp).toLocaleDateString()}</span>
									</div>
									<p className="text-gray-600 text-sm">{comment.text}</p>
								</div>
							))}
						</div>
						<div className="flex gap-2">
							<Input
								placeholder="Add a comment..."
								value={newComments[localInsight.id] || ""}
								onChange={(e) => setNewComments((prev) => ({ ...prev, [localInsight.id]: e.target.value }))}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleAddComment()
									}
								}}
								className="flex-1"
							/>
							<Button size="sm" onClick={handleAddComment} disabled={!newComments[localInsight.id]?.trim()}>
								<Send className="h-4 w-4" />
							</Button>
						</div>
					</div>
				)}
			</CardContent>

			<CardFooter className="border-t bg-gray-50 pt-4">
				<div className="flex w-full items-center justify-between">
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							className={`h-8 px-2 ${
								votedInsights[localInsight.id] === "up" ? "bg-green-100 text-green-700" : "hover:bg-green-50"
							}`}
							onClick={() => handleVote("up")}
						>
							<ThumbsUp className="mr-1 h-4 w-4" />
							{localInsight.upvotes}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className={`h-8 px-2 ${
								votedInsights[localInsight.id] === "down" ? "bg-red-100 text-red-700" : "hover:bg-red-50"
							}`}
							onClick={() => handleVote("down")}
						>
							<ThumbsDown className="mr-1 h-4 w-4" />
							{localInsight.downvotes}
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className={`h-8 px-2 ${showComments[localInsight.id] ? "bg-blue-100 text-blue-700" : ""}`}
							onClick={toggleComments}
						>
							<MessageCircle className="mr-1 h-4 w-4" />
							{localInsight.comments?.length || 0}
						</Button>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 px-2 text-gray-500 hover:text-gray-700"
							onClick={handleHide}
						>
							Hide
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 px-2 text-gray-500 hover:text-gray-700"
							onClick={handleArchive}
						>
							Archive
						</Button>
					</div>
				</div>
			</CardFooter>
		</Card>
	)
}
