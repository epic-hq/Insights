/**
 * QuickActionsBar - Primary action buttons for dashboard
 *
 * Context-aware action bar that shows the most relevant actions
 * based on project state. Mobile-first with large touch targets.
 */

import { Glasses, Plus, Target, Upload } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export interface QuickActionsBarProps {
	/** Link to upload content */
	uploadHref: string;
	/** Link to project goals/setup */
	goalsHref: string;
	/** Link to lens library */
	lensLibraryHref: string;
	/** Current project state affects which action is emphasized */
	projectState?: "empty" | "processing" | "hasData";
	/** Additional CSS classes */
	className?: string;
}

export function QuickActionsBar({
	uploadHref,
	goalsHref,
	lensLibraryHref,
	projectState = "hasData",
	className,
}: QuickActionsBarProps) {
	// Determine which action should be primary based on state
	const isPrimaryUpload = projectState === "empty" || projectState === "hasData";
	const isPrimaryGoals = projectState === "empty";

	return (
		<div className={cn("flex flex-wrap gap-2", className)}>
			{/* Add Content Action */}
			<Button
				asChild
				variant={isPrimaryUpload ? "default" : "outline"}
				size="default"
				className="min-h-[44px] flex-1 sm:flex-none"
			>
				<Link to={uploadHref}>
					<Upload className="mr-2 h-4 w-4" />
					Add
				</Link>
			</Button>

			{/* Goals Action */}
			<Button
				asChild
				variant={isPrimaryGoals && !isPrimaryUpload ? "default" : "outline"}
				size="default"
				className="min-h-[44px] flex-1 sm:flex-none"
			>
				<Link to={goalsHref}>
					<Target className="mr-2 h-4 w-4" />
					Goals
				</Link>
			</Button>

			{/* Lens Library Action */}
			<Button asChild variant="outline" size="default" className="min-h-[44px] flex-1 sm:flex-none">
				<Link to={lensLibraryHref}>
					<Glasses className="mr-2 h-4 w-4" />
					Lenses
				</Link>
			</Button>
		</div>
	);
}

/**
 * Compact version for inline use
 */
export function QuickActionsCompact({
	uploadHref,
	goalsHref,
	lensLibraryHref,
	className,
}: Omit<QuickActionsBarProps, "projectState">) {
	return (
		<div className={cn("flex items-center gap-1", className)}>
			<Button asChild variant="ghost" size="sm">
				<Link to={uploadHref}>
					<Plus className="h-4 w-4" />
				</Link>
			</Button>
			<Button asChild variant="ghost" size="sm">
				<Link to={goalsHref}>
					<Target className="h-4 w-4" />
				</Link>
			</Button>
			<Button asChild variant="ghost" size="sm">
				<Link to={lensLibraryHref}>
					<Glasses className="h-4 w-4" />
				</Link>
			</Button>
		</div>
	);
}

export default QuickActionsBar;
