/**
 * Merge Person Dialog
 *
 * UI for merging a placeholder/duplicate person into another person record.
 * Shows preview of what will be transferred and confirms the merge operation.
 */

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

export interface MergePersonDialogProps {
	/** Person being merged away (source) */
	sourcePerson: {
		id: string;
		name: string | null;
		evidenceCount: number;
		interviewCount: number;
		facetCount: number;
	};
	/** Available people to merge into (targets) */
	availablePeople: Array<{
		id: string;
		name: string | null;
		person_type?: string | null;
	}>;
	/** Callback after successful merge */
	onMergeComplete?: () => void;
}

export function MergePersonDialog({ sourcePerson, availablePeople, onMergeComplete }: MergePersonDialogProps) {
	const [open, setOpen] = useState(false);
	const [targetPersonId, setTargetPersonId] = useState<string | null>(null);
	const [reason, setReason] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const fetcher = useFetcher();

	const isSubmitting = fetcher.state !== "idle";

	const targetPerson = availablePeople.find((p) => p.id === targetPersonId);

	const handleMerge = async () => {
		if (!targetPersonId) {
			toast.error("Please select a person to merge into");
			return;
		}

		fetcher.submit(
			{
				sourcePersonId: sourcePerson.id,
				targetPersonId,
				reason: reason.trim() || undefined,
			},
			{
				method: "post",
				action: "/api/merge-people",
				encType: "application/json",
			}
		);
	};

	// Handle fetcher response
	if (fetcher.state === "idle" && fetcher.data) {
		const result = fetcher.data as {
			ok: boolean;
			error?: string;
			message?: string;
		};

		if (result.ok) {
			toast.success("People merged successfully");
			setOpen(false);
			setTargetPersonId(null);
			setReason("");
			onMergeComplete?.();
		} else {
			toast.error(result.error || "Failed to merge people");
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="gap-2">
					<UserPlus className="h-4 w-4" />
					Merge into another person
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Merge Person Record</DialogTitle>
					<DialogDescription>
						Merge "{sourcePerson.name || "Unnamed Person"}" into another person. All evidence, interviews, and
						attributes will be transferred.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Source person summary */}
					<div className="rounded-lg border bg-muted/30 p-4">
						<p className="mb-2 font-medium text-sm">Merging away:</p>
						<p className="mb-1 font-semibold">{sourcePerson.name || "Unnamed Person"}</p>
						<div className="flex gap-4 text-muted-foreground text-xs">
							<span>{sourcePerson.evidenceCount} evidence items</span>
							<span>{sourcePerson.interviewCount} interviews</span>
							<span>{sourcePerson.facetCount} attributes</span>
						</div>
					</div>

					{/* Target person selection */}
					<div className="space-y-2">
						<Label>Merge into (target person)</Label>
						<Command className="rounded-lg border">
							<CommandInput placeholder="Search people..." value={searchInput} onValueChange={setSearchInput} />
							<CommandList className="max-h-[200px]">
								<CommandEmpty>
									<p className="py-2 text-center text-muted-foreground text-sm">No people found</p>
								</CommandEmpty>
								<CommandGroup>
									{availablePeople
										.filter((p) => {
											if (p.id === sourcePerson.id) return false; // Exclude source person
											if (!searchInput.trim()) return true;
											return p.name?.toLowerCase().includes(searchInput.toLowerCase());
										})
										.map((person) => (
											<CommandItem
												key={person.id}
												value={person.name || person.id}
												onSelect={() => setTargetPersonId(person.id)}
												className={targetPersonId === person.id ? "bg-accent" : ""}
											>
												<div className="flex items-center gap-2">
													<span>{person.name || "Unnamed Person"}</span>
													{person.person_type === "internal" && (
														<span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-[10px] text-blue-800 uppercase tracking-wide">
															Team
														</span>
													)}
												</div>
											</CommandItem>
										))}
								</CommandGroup>
							</CommandList>
						</Command>
					</div>

					{/* Selected target preview */}
					{targetPerson && (
						<div className="rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-800/50 dark:bg-green-950/20">
							<p className="mb-1 font-medium text-green-800 text-sm dark:text-green-300">Merging into:</p>
							<p className="font-semibold text-green-900 dark:text-green-100">
								{targetPerson.name || "Unnamed Person"}
							</p>
							<p className="mt-2 text-green-700 text-xs dark:text-green-400">
								All data from "{sourcePerson.name || "Unnamed Person"}" will be transferred to this person.
							</p>
						</div>
					)}

					{/* Optional reason */}
					<div className="space-y-2">
						<Label htmlFor="merge-reason">Reason (optional)</Label>
						<Textarea
							id="merge-reason"
							placeholder="e.g., Duplicate created during import, placeholder from interview..."
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							rows={2}
						/>
					</div>

					{/* Warning */}
					<div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3 dark:border-yellow-800/50 dark:bg-yellow-950/20">
						<p className="font-medium text-xs text-yellow-800 dark:text-yellow-300">
							⚠️ This action can be reversed within 30 days
						</p>
						<p className="mt-1 text-xs text-yellow-700 dark:text-yellow-400">
							The source person record will be soft-deleted and can be restored from the merge history if needed.
						</p>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						onClick={handleMerge}
						disabled={!targetPersonId || isSubmitting}
						className="bg-green-600 hover:bg-green-700"
					>
						{isSubmitting ? "Merging..." : "Merge People"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
