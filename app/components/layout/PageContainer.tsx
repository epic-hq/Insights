import type { PropsWithChildren } from "react";
import { cn } from "~/lib/utils";

type PageContainerProps = PropsWithChildren<{
	className?: string;
	/**
	 * Size presets control the max width of the page content.
	 * - sm: narrow forms/detail pages
	 * - md: docs/content
	 * - lg: default app pages
	 * - xl: very wide dashboards
	 */
	size?: "sm" | "md" | "lg" | "xl";
	/** Apply default padding (px/py). Useful to disable when nesting. */
	padded?: boolean;
}>;

const sizeToMaxWidth: Record<NonNullable<PageContainerProps["size"]>, string> = {
	sm: "max-w-3xl",
	md: "max-w-5xl",
	lg: "max-w-7xl",
	xl: "max-w-screen-2xl",
};

export function PageContainer({ children, className, size = "lg", padded = true }: PageContainerProps) {
	return (
		<div className={cn("mx-auto w-full", sizeToMaxWidth[size], padded && "px-4 py-6 sm:px-6 sm:py-8", className)}>
			{children}
		</div>
	);
}
