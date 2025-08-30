import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "~/lib/utils"

const badgeVariants = cva(
	"inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 font-medium text-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
	{
		variants: {
			variant: {
				default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
				secondary: "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
				destructive:
					"border-transparent bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
				outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
			},
			color: {
				blue: "border-blue-100 text-blue-800 dark:border-blue-900 dark:text-blue-200",
				green: "border-green-100 text-green-800 dark:border-green-900 dark:text-green-200",
				red: "border-red-100 text-red-800 dark:border-red-900 dark:text-red-200",
				purple: "border-purple-100 text-purple-800 dark:border-purple-900 dark:text-purple-200",
				yellow: "border-yellow-100 text-yellow-800 dark:border-yellow-900 dark:text-yellow-200",
				orange: "border-orange-100 text-orange-800 dark:border-orange-900 dark:text-orange-200",
				indigo: "border-indigo-100 text-indigo-800 dark:border-indigo-900 dark:text-indigo-200",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
)

function Badge({
	className,
	variant,
	color,
	asChild = false,
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "span"

	return <Comp data-slot="badge" className={cn(badgeVariants({ variant, color }), className)} {...props} />
}

export { Badge }
