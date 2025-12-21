import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "~/lib/utils"

const cardVariants = cva(
	"relative flex flex-col rounded-xl border py-2 text-card-foreground transition-all duration-200",
	{
		variants: {
			surface: {
				default: "border-border/60 bg-card shadow-sm",
				muted: "border-transparent bg-muted/70 shadow-none dark:bg-muted/40",
				elevated: "border-border/70 bg-card shadow-md shadow-black/5 dark:shadow-black/25",
				outline: "border-primary/25 bg-background/80 shadow-none",
				soft: "border-primary/15 bg-primary/5 text-foreground shadow-[0_20px_70px_-60px_rgba(59,130,246,0.55)] dark:border-primary/25 dark:bg-primary/10",
				glass: "border-white/30 bg-white/70 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-900/40",
				gradient:
					"border-transparent bg-gradient-to-br from-card via-card to-primary/15 text-foreground shadow-md dark:from-slate-950 dark:via-slate-900 dark:to-primary/20",
				glow:
					"border-primary/20 bg-card shadow-[0_12px_45px_-28px_rgba(59,130,246,0.65)] ring-1 ring-primary/10 dark:shadow-[0_12px_40px_-24px_rgba(59,130,246,0.55)]",
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
