import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "~/lib/utils"

const cardVariants = cva(
	"relative flex flex-col rounded-xl border py-2 text-card-foreground transition-all duration-200",
	{
		variants: {
			surface: {
				default: "border-border bg-card shadow-sm",
				muted: "border-border/30 bg-muted/80 shadow-none dark:bg-muted/50",
				elevated: "border-border bg-card shadow-lg shadow-black/10 dark:shadow-black/40",
				outline: "border-primary/50 bg-background/70 shadow-none ring-1 ring-primary/10",
				soft: "border-primary/25 bg-primary/10 text-foreground shadow-[0_20px_70px_-45px_rgba(59,130,246,0.65)] dark:border-primary/35 dark:bg-primary/15",
				glass: "border-white/40 bg-white/75 shadow-xl backdrop-blur-xl ring-1 ring-white/40 dark:border-white/15 dark:bg-slate-900/50 dark:ring-white/10",
				gradient:
					"border-transparent bg-gradient-to-br from-primary/18 via-card to-indigo-200/35 text-foreground shadow-lg dark:from-primary/25 dark:via-slate-900 dark:to-indigo-500/15",
				glow:
					"border-primary/30 bg-card shadow-[0_18px_55px_-25px_rgba(59,130,246,0.75)] ring-2 ring-primary/15 dark:shadow-[0_16px_50px_-24px_rgba(59,130,246,0.65)]",
			},
		},
		defaultVariants: {
			surface: "default",
		},
	}
)

function Card({
	className,
	surface,
	asChild = false,
	...props
}: React.ComponentProps<"div"> &
	VariantProps<typeof cardVariants> & {
		asChild?: boolean
	}) {
	const Comp = asChild ? Slot : "div"

	return <Comp data-slot="card" className={cn(cardVariants({ surface, className }))} {...props} />
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				"@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-3",
				className
			)}
			{...props}
		/>
	)
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="card-title" className={cn("font-semibold leading-none", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="card-description" className={cn("text-muted-foreground text-sm", className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-action"
			className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
			{...props}
		/>
	)
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="card-content" className={cn("px-4", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="card-footer" className={cn("flex items-center px-4 [.border-t]:pt-6", className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter, cardVariants }
