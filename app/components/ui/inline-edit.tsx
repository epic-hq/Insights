// src/components/ui/inline-edit.tsx

"use client"

import { Pencil } from "lucide-react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Streamdown } from "streamdown"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { cn } from "~/lib/utils"

interface InlineEditProps {
	value: string
	onChange?: (value: string) => void
	onSubmit?: (value: string) => void
	multiline?: boolean
	textClassName?: string
	inputClassName?: string
	placeholder?: string
	markdown?: boolean
	textComponent?: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
	autoSize?: boolean
	autoFocus?: boolean
	submitOnBlur?: boolean
	initialIsEditing?: boolean
	closeOnBlur?: boolean
	showConfirmationButtons?: boolean
	showEditButton?: boolean
}

export default function InlineEdit({
	value: initialValue,
	onChange,
	onSubmit,
	textClassName,
	inputClassName,
	markdown = false,
	textComponent = "p",
	placeholder = "Click to edit",
	multiline = false,
	autoSize = true,
	autoFocus = false,
	submitOnBlur = true,
	initialIsEditing = false,
	closeOnBlur = true,
	showConfirmationButtons = false,
	showEditButton = false,
}: InlineEditProps) {
	const [isEditing, setIsEditing] = useState(initialIsEditing)
	const [value, setValue] = useState(initialValue)
	const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const [preservedWidth, setPreservedWidth] = useState<number | null>(null)

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
		}
	}, [isEditing])

	// Dynamically set the height of the textarea to scroll height, this is a trick to
	// get the textarea to show all of the content
	useEffect(() => {
		if (multiline && inputRef.current && autoSize) {
			inputRef.current.style.height = "auto"
			inputRef.current.style.height = `${inputRef.current.scrollHeight + 1}px`
		}
	}, [multiline, autoSize])

	const minRows = 3

	const handleClick = () => {
		// Preserve the width of the container before switching to edit mode
		// Add 20px buffer to account for font size differences and ensure all text is visible
		if (containerRef.current) {
			const width = containerRef.current.getBoundingClientRect().width
			setPreservedWidth(width + 20)
		}
		setIsEditing(true)
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
		setValue(e.target.value)
		onChange?.(e.target.value)
	}

	const handleBlur = () => {
		if (closeOnBlur) {
			setIsEditing(false)
			setPreservedWidth(null)
		}
		if (submitOnBlur) {
			onSubmit?.(value)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		// For multiline, Enter should insert a newline (no submit)
		if (e.key === "Enter") {
			if (multiline) {
				return
			}
			setIsEditing(false)
			setPreservedWidth(null)
			onSubmit?.(value)
			return
		}
		if (e.key === "Escape") {
			handleCancel()
		}
	}

	const handleCancel = () => {
		setIsEditing(false)
		setPreservedWidth(null)
		setValue(initialValue)
	}

	if (isEditing) {
		if (multiline) {
			return (
				<>
					<Textarea
						ref={inputRef as React.RefObject<HTMLTextAreaElement>}
						value={value}
						onChange={handleChange}
						onBlur={handleBlur}
						autoFocus={autoFocus}
						onKeyDown={handleKeyDown}
						rows={minRows}
						className={cn("scrollbar-none h-auto min-h-0 w-full resize-none", inputClassName)}
						style={preservedWidth ? { width: `${preservedWidth}px`, minWidth: `${preservedWidth}px` } : undefined}
					/>
					{showConfirmationButtons && (
						<div className="mt-1 flex justify-end gap-2">
							<Button variant="ghost" onClick={handleCancel}>
								Cancel
							</Button>
							<Button onClick={() => onSubmit?.(value)}>Save</Button>
						</div>
					)}
				</>
			)
		}
		return (
			<>
				<Input
					ref={inputRef as React.RefObject<HTMLInputElement>}
					value={value}
					onChange={handleChange}
					onBlur={handleBlur}
					autoFocus={autoFocus}
					onKeyDown={handleKeyDown}
					className={cn("h-8 w-full focus-visible:ring-black/40", inputClassName)}
					style={preservedWidth ? { width: `${preservedWidth}px`, minWidth: `${preservedWidth}px` } : undefined}
				/>
				{showConfirmationButtons && (
					<div className="mt-1 flex justify-end gap-2">
						<Button variant="ghost" onClick={handleCancel}>
							Cancel
						</Button>
						<Button onClick={() => onSubmit?.(value)}>Save</Button>
					</div>
				)}
			</>
		)
	}

	const TextComponent = textComponent

	return (
		<div
			ref={containerRef}
			onClick={handleClick}
			className={cn(
				"group cursor-pointer rounded transition-colors hover:bg-white/80",
				showEditButton ? "flex justify-between" : "block"
			)}
		>
			{markdown ? (
				<Streamdown className={cn("min-w-0 text-gray-800", showEditButton ? "flex-1" : "w-full", textClassName)}>
					{value || placeholder}
				</Streamdown>
			) : (
				<TextComponent className={cn("min-w-0 text-gray-800", showEditButton ? "flex-1" : "w-full", textClassName)}>
					{multiline ? (
						value ? (
							value.split("\n").map((line, i) => (
								<span key={`line-${i}-${line.slice(0, 10)}`}>
									{line}
									<br />
								</span>
							))
						) : (
							<span className="text-gray-400 text-xs italic">{placeholder}</span>
						)
					) : (
						value || <span className="text-gray-400 text-xs italic">{placeholder}</span>
					)}
				</TextComponent>
			)}
			{showEditButton && (
				<Button variant="ghost" size="icon" className="invisible h-6 w-6 group-hover:visible">
					<Pencil />
				</Button>
			)}
		</div>
	)
}
