"use client"

import { Slottable } from "@radix-ui/react-slot"
import { type ComponentPropsWithRef, forwardRef } from "react"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

export type TooltipIconButtonProps = ComponentPropsWithRef<typeof Button> & {
	tooltip: string
	side?: "top" | "bottom" | "left" | "right"
}

export const TooltipIconButton = forwardRef<HTMLButtonElement, TooltipIconButtonProps>(
	({ children, tooltip, side = "bottom", className, ...rest }, ref) => {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						{...rest}
						className={cn("aui-button-icon size-6 p-1", className)}
						ref={ref}
					>
						<Slottable>{children}</Slottable>
						<span className="aui-sr-only sr-only">{tooltip}</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent side={side}>{tooltip}</TooltipContent>
			</Tooltip>
		)
	}
)

TooltipIconButton.displayName = "TooltipIconButton"
