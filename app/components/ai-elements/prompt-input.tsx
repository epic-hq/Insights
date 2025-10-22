"use client"

import type { ChatStatus } from "ai"
import { Loader2Icon, SendIcon, SquareIcon, XIcon } from "lucide-react"
import type { ComponentProps, HTMLAttributes, KeyboardEventHandler } from "react"
import { Button } from "~/components/ui/button"
import { Textarea } from "~/components/ui/textarea"
import { cn } from "~/lib/utils"

type PromptInputProps = HTMLAttributes<HTMLFormElement>

export const PromptInput = ({ className, ...props }: PromptInputProps) => (
	<form
		className={cn("w-full divide-y overflow-hidden rounded-xl border bg-background shadow-sm", className)}
		{...props}
	/>
)

type PromptInputTextareaProps = ComponentProps<typeof Textarea> & {
	minHeight?: number
	maxHeight?: number
}

export const PromptInputTextarea = ({
	onChange,
	className,
	placeholder = "What would you like to know?",
	minHeight = 48,
	maxHeight = 164,
	...props
}: PromptInputTextareaProps) => {
	const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
		if (e.key === "Enter") {
			// Don't submit if IME composition is in progress
			if (e.nativeEvent.isComposing) {
				return
			}

			if (e.shiftKey) {
				// Allow newline
				return
			}

			// Submit on Enter (without Shift)
			e.preventDefault()
			const form = e.currentTarget.form
			if (form) {
				form.requestSubmit()
			}
		}
	}

	return (
		<Textarea
			className={cn(
				"w-full resize-none rounded-none border-none p-3 shadow-none outline-none ring-0",
				"field-sizing-content max-h-[6lh] bg-transparent dark:bg-transparent",
				"focus-visible:ring-0",
				className
			)}
			name="message"
			onChange={(e) => {
				onChange?.(e)
			}}
			onKeyDown={handleKeyDown}
			placeholder={placeholder}
			{...props}
		/>
	)
}

type PromptInputSubmitProps = ComponentProps<typeof Button> & {
	status?: ChatStatus
}

export const PromptInputSubmit = ({
	className,
	variant = "default",
	size = "icon",
	status,
	children,
	...props
}: PromptInputSubmitProps) => {
	let Icon = <SendIcon className="size-4" />

	if (status === "submitted") {
		Icon = <Loader2Icon className="size-4 animate-spin" />
	} else if (status === "streaming") {
		Icon = <SquareIcon className="size-4" />
	} else if (status === "error") {
		Icon = <XIcon className="size-4" />
	}

	return (
		<Button className={cn("gap-1.5 rounded-lg", className)} size={size} type="submit" variant={variant} {...props}>
			{children ?? Icon}
		</Button>
	)
}
