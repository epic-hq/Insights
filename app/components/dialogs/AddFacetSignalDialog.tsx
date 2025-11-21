import { Plus, Search, X } from "lucide-react"
import { useState } from "react"
import { useFetcher } from "react-router-dom"
import { Button } from "~/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"

interface Facet {
	id: number
	label: string
	slug: string
}

interface AddFacetSignalDialogProps {
	/** The person to add the facet to */
	personId: string
	/** The facet kind slug (e.g., "pain", "goal", "job_function") */
	kindSlug: string
	/** Display label for the facet kind (e.g., "Pain", "Goal", "Job Function") */
	kindLabel: string
	/** Available facets for this kind */
	availableFacets: Facet[]
	/** Optional custom trigger button */
	triggerButton?: React.ReactNode
	/** Callback after successful addition */
	onSuccess?: () => void
}

export function AddFacetSignalDialog({
	personId,
	kindSlug,
	kindLabel,
	availableFacets,
	triggerButton,
	onSuccess,
}: AddFacetSignalDialogProps) {
	const [open, setOpen] = useState(false)
	const [searchTerm, setSearchTerm] = useState("")
	const [selectedFacetId, setSelectedFacetId] = useState<number | null>(null)
	const [newFacetLabel, setNewFacetLabel] = useState("")
	const fetcher = useFetcher()

	const filteredFacets = availableFacets.filter((facet) =>
		facet.label.toLowerCase().includes(searchTerm.toLowerCase())
	)

	const handleSelectExisting = () => {
		if (!selectedFacetId) return

		fetcher.submit(
			{
				_action: "add-facet-signal",
				person_id: personId,
				facet_account_id: selectedFacetId.toString(),
			},
			{ method: "post" }
		)

		// Close dialog and reset
		setOpen(false)
		setSearchTerm("")
		setSelectedFacetId(null)
		onSuccess?.()
	}

	const handleCreateNew = () => {
		if (!newFacetLabel.trim()) return

		fetcher.submit(
			{
				_action: "create-and-add-facet-signal",
				person_id: personId,
				kind_slug: kindSlug,
				facet_label: newFacetLabel.trim(),
			},
			{ method: "post" }
		)

		// Close dialog and reset
		setOpen(false)
		setNewFacetLabel("")
		onSuccess?.()
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{triggerButton || (
					<Button variant="outline" size="sm">
						<Plus className="mr-1 h-3 w-3" />
						Add Signal
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Add {kindLabel} Signal</DialogTitle>
					<DialogDescription>Select an existing {kindLabel.toLowerCase()} or create a new one.</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="existing" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="existing">Select Existing</TabsTrigger>
						<TabsTrigger value="new">Create New</TabsTrigger>
					</TabsList>

					<TabsContent value="existing" className="space-y-4">
						<div className="relative">
							<Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder={`Search ${kindLabel.toLowerCase()}...`}
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-9"
							/>
						</div>

						<ScrollArea className="h-[300px] rounded-md border">
							{filteredFacets.length === 0 ? (
								<div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
									<p className="text-sm">No {kindLabel.toLowerCase()} found</p>
									<p className="text-xs">Try creating a new one</p>
								</div>
							) : (
								<div className="space-y-2 p-2">
									{filteredFacets.map((facet) => (
										<button
											key={facet.id}
											type="button"
											onClick={() => setSelectedFacetId(facet.id)}
											className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
												selectedFacetId === facet.id
													? "border-primary bg-primary/10"
													: "border-border hover:bg-muted"
											}`}
										>
											<span className="font-medium text-sm">{facet.label}</span>
										</button>
									))}
								</div>
							)}
						</ScrollArea>

						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleSelectExisting} disabled={!selectedFacetId}>
								Add Signal
							</Button>
						</div>
					</TabsContent>

					<TabsContent value="new" className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="new-facet-label">{kindLabel} *</Label>
							<Input
								id="new-facet-label"
								value={newFacetLabel}
								onChange={(e) => setNewFacetLabel(e.target.value)}
								placeholder={`e.g., ${kindLabel === "Pain" ? "Data integration challenges" : kindLabel === "Goal" ? "Reduce manual work" : "New " + kindLabel.toLowerCase()}`}
								onKeyDown={(e) => {
									if (e.key === "Enter" && newFacetLabel.trim()) {
										e.preventDefault()
										handleCreateNew()
									}
								}}
							/>
							<p className="text-muted-foreground text-xs">
								Enter a new {kindLabel.toLowerCase()} to add to your catalog and link to this person.
							</p>
						</div>

						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button onClick={handleCreateNew} disabled={!newFacetLabel.trim()}>
								<Plus className="mr-2 h-4 w-4" />
								Create & Add
							</Button>
						</div>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	)
}
