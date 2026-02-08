/**
 * EmptyStateBox - Reusable placeholder for empty sections
 *
 * Displays a "Do X to see Y" message with optional CTA.
 * Uses dashed border and muted styling to indicate placeholder state.
 */

import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export interface EmptyStateBoxProps {
	/** Icon to display */
	icon: LucideIcon;
	/** Section title */
	title: string;
	/** Message explaining what action will populate this section */
	message: string;
	/** Optional CTA button text */
	ctaText?: string;
	/** Optional CTA button href */
	ctaHref?: string;
	/** Visual variant */
	variant?: "default" | "subtle" | "highlighted";
	/** Additional CSS classes */
	className?: string;
}

export function EmptyStateBox({
	icon: Icon,
	title,
	message,
	ctaText,
	ctaHref,
	variant = "default",
	className,
}: EmptyStateBoxProps) {
	const variantStyles = {
		default: "border-2 border-dashed border-muted-foreground/20 bg-muted/30",
		subtle: "border border-dashed border-muted-foreground/10 bg-muted/20",
		highlighted: "border-2 border-dashed border-primary/30 bg-primary/5",
	};

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center rounded-xl p-8 text-center",
				variantStyles[variant],
				className
			)}
		>
			<div className="mb-4 rounded-full bg-muted p-3">
				<Icon className="h-6 w-6 text-muted-foreground" />
			</div>

			<h3 className="mb-1 font-medium text-foreground text-sm">{title}</h3>

			<p className="mb-4 max-w-[280px] text-muted-foreground text-sm leading-relaxed">{message}</p>

			{ctaText && ctaHref && (
				<Button asChild variant="outline" size="sm">
					<Link to={ctaHref}>{ctaText}</Link>
				</Button>
			)}
		</div>
	);
}

export default EmptyStateBox;
