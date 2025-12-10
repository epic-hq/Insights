/**
 * Extract suggested next steps from assistant responses.
 * Parses common patterns like "Would you like me to:", numbered lists, etc.
 */

export interface ExtractSuggestionsOptions {
	/** The assistant's last message content */
	assistantMessage: string
	/** Max suggestions to return (default: 3) */
	maxSuggestions?: number
}

/**
 * Extract contextual suggestions from the assistant's response text.
 * Looks for patterns like:
 * - "Would you like me to:" followed by options
 * - "Recommended next steps:" sections
 * - Numbered lists (1. 2. 3.)
 * - Bullet points with action items
 * - Questions at the end of responses
 */
export function extractSuggestions({ assistantMessage, maxSuggestions = 3 }: ExtractSuggestionsOptions): string[] {
	if (!assistantMessage?.trim()) {
		return []
	}

	const suggestions: string[] = []
	const text = assistantMessage.trim()

	// Pattern 1: "Would you like me to:" or "Want me to:" followed by numbered/bulleted items
	const wouldYouLikeMatch = text.match(
		/(?:would you like (?:me )?to|want me to|shall i|should i|i can|options?:?)[\s\S]*?(?:\n|$)([\s\S]*?)(?:\n\n|$)/i
	)
	if (wouldYouLikeMatch) {
		const optionsText = wouldYouLikeMatch[1] || wouldYouLikeMatch[0]
		const items = extractListItems(optionsText)
		suggestions.push(...items)
	}

	// Pattern 2: Numbered lists (1. 2. 3.) or (1) 2) 3))
	const numberedPattern = /(?:^|\n)\s*(?:\d+[.)]\s*\**)(.*?)(?:\**\s*(?:\n|$))/gm
	const numberedMatches = text.matchAll(numberedPattern)
	for (const match of numberedMatches) {
		const item = cleanSuggestion(match[1])
		if (item && !suggestions.includes(item)) {
			suggestions.push(item)
		}
	}

	// Pattern 3: Bullet points with actionable items
	const bulletPattern = /(?:^|\n)\s*[-•*]\s*\**([^*\n]+)\**(?:\n|$)/gm
	const bulletMatches = text.matchAll(bulletPattern)
	for (const match of bulletMatches) {
		const item = cleanSuggestion(match[1])
		if (item && isActionable(item) && !suggestions.includes(item)) {
			suggestions.push(item)
		}
	}

	// Pattern 4: "I can [verb]" statements -> convert to imperative
	const iCanPattern = /(?:^|\n)\s*(?:I can|I'm able to|I will)\s+([^.\n]+)(?:\.|\n|$)/gi
	const iCanMatches = text.matchAll(iCanPattern)
	for (const match of iCanMatches) {
		const action = cleanSuggestion(match[1])
		if (action && isActionable(action) && !suggestions.includes(action)) {
			suggestions.push(capitalizeFirst(action))
		}
	}

	// Pattern 5: Questions at the end (last 200 chars)
	const endText = text.slice(-300)
	const questionMatch = endText.match(/([^.!?\n]+\?)\s*$/g)
	if (questionMatch) {
		for (const q of questionMatch) {
			const cleaned = cleanSuggestion(q)
			// Convert question to affirmative suggestion
			const affirmative = questionToAffirmative(cleaned)
			if (affirmative && !suggestions.includes(affirmative)) {
				suggestions.push(affirmative)
			}
		}
	}

	// Pattern 5: "or" alternatives inline
	const orMatch = text.match(/(?:would you like|want) (?:me )?to ([^,?]+),?\s*or\s*([^?]+)\?/i)
	if (orMatch) {
		const opt1 = cleanSuggestion(orMatch[1])
		const opt2 = cleanSuggestion(orMatch[2])
		if (opt1 && !suggestions.includes(opt1)) suggestions.push(capitalizeFirst(opt1))
		if (opt2 && !suggestions.includes(opt2)) suggestions.push(capitalizeFirst(opt2))
	}

	return suggestions.slice(0, maxSuggestions)
}

function extractListItems(text: string): string[] {
	const items: string[] = []
	// Match numbered or bulleted items
	const pattern = /(?:^|\n)\s*(?:\d+[.)]|[-•*])\s*\**([^*\n]+)\**/gm
	const matches = text.matchAll(pattern)
	for (const match of matches) {
		const item = cleanSuggestion(match[1])
		if (item) items.push(item)
	}
	return items
}

function cleanSuggestion(text: string): string {
	// Remove common prefixes first
	let clean = text
		.replace(/\*\*/g, "")
		.replace(/\*/g, "")
		.replace(/`/g, "")
		.replace(/^\s*[-•*]\s*/, "")
		.replace(/^\s*\d+[.)]\s*/, "")
		.replace(/[,;:]$/, "")
		.replace(/\s+/g, " ")
		.trim()

	// Convert "I can [verb]" -> "[Verb]"
	const iCanMatch = clean.match(/^(?:I can|I'm able to|I will)\s+(.*)/i)
	if (iCanMatch) {
		clean = iCanMatch[1]
	}

	// Reject if still too long (likely a full sentence/paragraph)
	if (clean.length > 50) {
		return ""
	}

	// Reject if it looks like a question but not actionable
	if (clean.includes("?") && !clean.toLowerCase().startsWith("would")) {
		// Keep short clarifying questions, but reject long ones
		if (clean.length > 40) return ""
	}

	// Reject if ends with common stop words (indicating cut-off)
	if (clean.match(/\s(?:and|or|but|the|a|an|in|on|at|to|for|with|by|of|into)$/i)) {
		return ""
	}

	return capitalizeFirst(clean)
}

function isActionable(text: string): boolean {
	const actionWords = [
		"search",
		"find",
		"show",
		"fetch",
		"get",
		"run",
		"analyze",
		"compare",
		"list",
		"tell",
		"explain",
		"summarize",
		"create",
		"generate",
		"check",
		"look",
		"dive",
		"explore",
	]
	const lower = text.toLowerCase()
	return actionWords.some((word) => lower.includes(word)) || lower.includes("?")
}

function questionToAffirmative(question: string): string {
	// "Want me to run that search?" -> "Run that search"
	const match = question.match(/(?:want|would you like)(?: me)? to ([^?]+)\?/i)
	if (match) {
		return capitalizeFirst(match[1].trim())
	}
	// Keep as-is if it's a clarifying question
	if (question.length < 50) {
		return question
	}
	return ""
}

function capitalizeFirst(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1)
}
