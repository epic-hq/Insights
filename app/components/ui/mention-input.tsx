/**
 * MentionInput Component
 * A textarea that supports @mentions with a searchable popover
 */
import { User, Users } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Popover, PopoverAnchor, PopoverContent } from "~/components/ui/popover"
import { Textarea } from "~/components/ui/textarea"
import { cn } from "~/lib/utils"
import type { MentionableUser } from "~/routes/api/mentionable-users"

export interface Mention {
	id: string
	name: string
	type: "user" | "person"
	startIndex: number
	endIndex: number
}

interface MentionInputProps {
	value: string
	onChange: (value: string) => void
	onMentionsChange?: (mentions: Mention[]) => void
	mentionableUsers: MentionableUser[]
	placeholder?: string
	className?: string
	disabled?: boolean
}

export function MentionInput({
	value,
	onChange,
	onMentionsChange,
	mentionableUsers,
	placeholder = "Add a comment...",
	className,
	disabled,
}: MentionInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const [showMentions, setShowMentions] = useState(false)
	const [mentionSearch, setMentionSearch] = useState("")
	const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null)
	const [selectedIndex, setSelectedIndex] = useState(0)
	const [mentions, setMentions] = useState<Mention[]>([])

	// Filter mentionable users based on search
	const filteredUsers = mentionableUsers
		.filter((user) => {
			if (!mentionSearch) return true
			const searchLower = mentionSearch.toLowerCase()
			return user.name.toLowerCase().includes(searchLower) || user.subtitle?.toLowerCase().includes(searchLower)
		})
		.slice(0, 8) // Limit to 8 results

	// Handle text change and detect @ mentions
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			const newValue = e.target.value
			const cursorPos = e.target.selectionStart

			onChange(newValue)

			// Check if we should show mention popup
			const textBeforeCursor = newValue.slice(0, cursorPos)
			const lastAtIndex = textBeforeCursor.lastIndexOf("@")

			if (lastAtIndex !== -1) {
				const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
				// Show popup if @ is at start or preceded by whitespace, and no space after @
				const charBeforeAt = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : " "
				if ((charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0) && !textAfterAt.includes(" ")) {
					setShowMentions(true)
					setMentionSearch(textAfterAt)
					setMentionStartIndex(lastAtIndex)
					setSelectedIndex(0)
					return
				}
			}

			setShowMentions(false)
			setMentionSearch("")
			setMentionStartIndex(null)
		},
		[onChange]
	)

	// Handle keyboard navigation in mention popup
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (!showMentions || filteredUsers.length === 0) return

			if (e.key === "ArrowDown") {
				e.preventDefault()
				setSelectedIndex((prev) => (prev + 1) % filteredUsers.length)
			} else if (e.key === "ArrowUp") {
				e.preventDefault()
				setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length)
			} else if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault()
				selectMention(filteredUsers[selectedIndex])
			} else if (e.key === "Escape") {
				setShowMentions(false)
			}
		},
		[showMentions, filteredUsers, selectedIndex]
	)

	// Select a mention and insert it into the text
	const selectMention = useCallback(
		(user: MentionableUser) => {
			if (mentionStartIndex === null) return

			const beforeMention = value.slice(0, mentionStartIndex)
			const afterMention = value.slice(mentionStartIndex + mentionSearch.length + 1) // +1 for @
			const mentionText = `@${user.name}`
			const newValue = beforeMention + mentionText + " " + afterMention

			// Track the mention
			const newMention: Mention = {
				id: user.id,
				name: user.name,
				type: user.type,
				startIndex: mentionStartIndex,
				endIndex: mentionStartIndex + mentionText.length,
			}

			const updatedMentions = [...mentions, newMention]
			setMentions(updatedMentions)
			onMentionsChange?.(updatedMentions)

			onChange(newValue)
			setShowMentions(false)
			setMentionSearch("")
			setMentionStartIndex(null)

			// Focus and set cursor position after mention
			setTimeout(() => {
				if (textareaRef.current) {
					const newCursorPos = mentionStartIndex + mentionText.length + 1
					textareaRef.current.focus()
					textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
				}
			}, 0)
		},
		[value, mentionStartIndex, mentionSearch, mentions, onChange, onMentionsChange]
	)

	// Reset mentions when value is cleared
	useEffect(() => {
		if (!value) {
			setMentions([])
			onMentionsChange?.([])
		}
	}, [value, onMentionsChange])

	// Show popover if we're in mention mode (even if no results yet)
	const shouldShowPopover = showMentions && mentionableUsers.length > 0

	return (
		<div className="relative w-full">
			<Popover open={shouldShowPopover}>
				<PopoverAnchor asChild>
					<Textarea
						ref={textareaRef}
						value={value}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						className={cn("min-h-[60px]", className)}
						disabled={disabled}
					/>
				</PopoverAnchor>
				<PopoverContent
					className="w-64 p-1"
					align="start"
					side="top"
					sideOffset={4}
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<div className="max-h-48 overflow-y-auto">
						{filteredUsers.length === 0 ? (
							<div className="px-2 py-3 text-center text-muted-foreground text-sm">No matches found</div>
						) : (
							filteredUsers.map((user, index) => (
								<button
									key={`${user.type}-${user.id}`}
									type="button"
									className={cn(
										"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
										index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
									)}
									onClick={() => selectMention(user)}
									onMouseEnter={() => setSelectedIndex(index)}
								>
									{user.avatar_url ? (
										<img src={user.avatar_url} alt={user.name} className="h-6 w-6 rounded-full object-cover" />
									) : (
										<div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
											{user.type === "user" ? (
												<User className="h-3 w-3 text-muted-foreground" />
											) : (
												<Users className="h-3 w-3 text-muted-foreground" />
											)}
										</div>
									)}
									<div className="min-w-0 flex-1">
										<div className="truncate font-medium">{user.name}</div>
										{user.subtitle && <div className="truncate text-muted-foreground text-xs">{user.subtitle}</div>}
									</div>
									<span className="flex-shrink-0 text-muted-foreground text-xs">
										{user.type === "user" ? "Team" : "Person"}
									</span>
								</button>
							))
						)}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	)
}

/**
 * Renders text with mentions highlighted as badges
 */
export function renderTextWithMentions(text: string, mentions?: Mention[]): React.ReactNode {
	if (!mentions || mentions.length === 0) {
		return text
	}

	const parts: React.ReactNode[] = []
	let lastIndex = 0

	// Sort mentions by start index
	const sortedMentions = [...mentions].sort((a, b) => a.startIndex - b.startIndex)

	for (const mention of sortedMentions) {
		// Add text before mention
		if (mention.startIndex > lastIndex) {
			parts.push(text.slice(lastIndex, mention.startIndex))
		}

		// Add mention badge
		parts.push(
			<span
				key={`${mention.id}-${mention.startIndex}`}
				className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary text-xs"
			>
				@{mention.name}
			</span>
		)

		lastIndex = mention.endIndex
	}

	// Add remaining text
	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex))
	}

	return parts
}
