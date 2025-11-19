import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import { Input } from "~/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select"
import { Badge } from "~/components/ui/badge"

export type NoteType = "meeting_notes" | "research_notes" | "call_notes" | "observation" | "idea" | "followup"

interface NoteAssociations {
	people?: string[]
	organizations?: string[]
	opportunities?: string[]
}

interface QuickNoteDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSave: (note: {
		title: string
		content: string
		noteType: NoteType
		associations: NoteAssociations
		tags: string[]
	}) => Promise<void>
	defaultAssociations?: NoteAssociations
	availablePeople?: Array<{ id: string; name: string }>
	availableOrgs?: Array<{ id: string; name: string }>
	availableOpportunities?: Array<{ id: string; name: string }>
}

export function QuickNoteDialog({
	open,
	onOpenChange,
	onSave,
	defaultAssociations = {},
	availablePeople = [],
	availableOrgs = [],
	availableOpportunities = [],
}: QuickNoteDialogProps) {
	const [title, setTitle] = useState("")
	const [content, setContent] = useState("")
	const [noteType, setNoteType] = useState<NoteType>("meeting_notes")
	const [associations, setAssociations] = useState<NoteAssociations>(defaultAssociations)
	const [tags, setTags] = useState<string[]>([])
	const [tagInput, setTagInput] = useState("")
	const [isSaving, setIsSaving] = useState(false)

	const handleSave = async () => {
		if (!content.trim()) return

		setIsSaving(true)
		try {
			await onSave({
				title: title || `${noteType.replace(/_/g, " ")} - ${new Date().toLocaleDateString()}`,
				content,
				noteType,
				associations,
				tags,
			})

			// Reset form
			setTitle("")
			setContent("")
			setNoteType("meeting_notes")
			setAssociations({})
			setTags([])
			setTagInput("")
			onOpenChange(false)
		} catch (error) {
			console.error("Failed to save note:", error)
		} finally {
			setIsSaving(false)
		}
	}

	const addTag = () => {
		const tag = tagInput.trim().toLowerCase()
		if (tag && !tags.includes(tag)) {
			setTags([...tags, tag])
			setTagInput("")
		}
	}

	const removeTag = (tag: string) => {
		setTags(tags.filter((t) => t !== tag))
	}

	const togglePerson = (personId: string) => {
		const current = associations.people || []
		setAssociations({
			...associations,
			people: current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId],
		})
	}

	const toggleOrg = (orgId: string) => {
		const current = associations.organizations || []
		setAssociations({
			...associations,
			organizations: current.includes(orgId) ? current.filter((id) => id !== orgId) : [...current, orgId],
		})
	}

	const toggleOpportunity = (oppId: string) => {
		const current = associations.opportunities || []
		setAssociations({
			...associations,
			opportunities: current.includes(oppId) ? current.filter((id) => id !== oppId) : [...current, oppId],
		})
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Quick Note</DialogTitle>
					<DialogDescription>
						Capture notes, observations, or ideas. Associate with people, organizations, or opportunities.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Title (optional) */}
					<div className="space-y-2">
						<Label htmlFor="title">Title (optional)</Label>
						<Input
							id="title"
							placeholder="Auto-generated if left blank"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
						/>
					</div>

					{/* Note Type */}
					<div className="space-y-2">
						<Label htmlFor="noteType">Note Type</Label>
						<Select value={noteType} onValueChange={(value) => setNoteType(value as NoteType)}>
							<SelectTrigger id="noteType">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="meeting_notes">Meeting Notes</SelectItem>
								<SelectItem value="call_notes">Call Notes</SelectItem>
								<SelectItem value="research_notes">Research Notes</SelectItem>
								<SelectItem value="observation">Observation</SelectItem>
								<SelectItem value="idea">Idea</SelectItem>
								<SelectItem value="followup">Follow-up</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{/* Content */}
					<div className="space-y-2">
						<Label htmlFor="content">Content (Markdown supported)</Label>
						<Textarea
							id="content"
							placeholder="Write your note here... You can use markdown formatting."
							value={content}
							onChange={(e) => setContent(e.target.value)}
							rows={10}
							className="font-mono text-sm"
						/>
					</div>

					{/* People Associations */}
					{availablePeople.length > 0 && (
						<div className="space-y-2">
							<Label>Associated People</Label>
							<div className="flex flex-wrap gap-2">
								{availablePeople.map((person) => (
									<Badge
										key={person.id}
										variant={associations.people?.includes(person.id) ? "default" : "outline"}
										className="cursor-pointer"
										onClick={() => togglePerson(person.id)}
									>
										{person.name}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Organization Associations */}
					{availableOrgs.length > 0 && (
						<div className="space-y-2">
							<Label>Associated Organizations</Label>
							<div className="flex flex-wrap gap-2">
								{availableOrgs.map((org) => (
									<Badge
										key={org.id}
										variant={associations.organizations?.includes(org.id) ? "default" : "outline"}
										className="cursor-pointer"
										onClick={() => toggleOrg(org.id)}
									>
										{org.name}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Opportunity Associations */}
					{availableOpportunities.length > 0 && (
						<div className="space-y-2">
							<Label>Associated Opportunities</Label>
							<div className="flex flex-wrap gap-2">
								{availableOpportunities.map((opp) => (
									<Badge
										key={opp.id}
										variant={associations.opportunities?.includes(opp.id) ? "default" : "outline"}
										className="cursor-pointer"
										onClick={() => toggleOpportunity(opp.id)}
									>
										{opp.name}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Tags */}
					<div className="space-y-2">
						<Label htmlFor="tags">Tags</Label>
						<div className="flex gap-2">
							<Input
								id="tags"
								placeholder="Add tag..."
								value={tagInput}
								onChange={(e) => setTagInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault()
										addTag()
									}
								}}
							/>
							<Button type="button" variant="outline" onClick={addTag}>
								Add
							</Button>
						</div>
						{tags.length > 0 && (
							<div className="flex flex-wrap gap-2 mt-2">
								{tags.map((tag) => (
									<Badge key={tag} variant="secondary" className="gap-1">
										{tag}
										<button
											type="button"
											onClick={() => removeTag(tag)}
											className="hover:text-destructive"
										>
											<X className="h-3 w-3" />
										</button>
									</Badge>
								))}
							</div>
						)}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={!content.trim() || isSaving}>
						{isSaving ? "Saving..." : "Save Note"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
