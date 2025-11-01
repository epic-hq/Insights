/**
 * Pure functions for generating person names from interview data
 * No external dependencies - easy to test
 */

interface InterviewData {
	id: string
	title?: string | null
	participant_pseudonym?: string | null
	interview_date?: string | null
	created_at?: string
	fileName?: string
}

/**
 * Generate a person name from AI-extracted participant data
 */
export function buildPersonNameFromAI(participant: {
	name?: string | null
	age?: number | null
	occupation?: string | null
}): string | null {
	return participant?.name?.trim() || null
}

/**
 * Generate a smart fallback name from filename
 */
export function buildPersonNameFromFilename(fileName: string): string | null {
	if (!fileName || fileName.length <= 4) return null

	const nameFromFile = fileName
		.replace(/\.[^/.]+$/, "") // Remove extension
		.replace(/[_-]/g, " ") // Replace underscores and hyphens with spaces
		.replace(/\b\w/g, (l) => l.toUpperCase()) // Title case
		.trim()

	// Skip generic filenames
	if (!nameFromFile || nameFromFile.toLowerCase().match(/^(rec|recording|audio|video|file)$/)) {
		return null
	}

	return `Participant (${nameFromFile})`
}

/**
 * Generate a person name from interview title
 */
export function buildPersonNameFromTitle(title: string): string | null {
	if (!title || title.includes("Interview -")) return null

	const cleanTitle = title
		.replace(/^Interview\s*-?\s*/i, "") // Remove "Interview -" prefix
		.replace(/\d{4}-\d{2}-\d{2}/, "") // Remove dates
		.trim()

	return cleanTitle.length > 0 ? `Participant (${cleanTitle})` : null
}

/**
 * Generate a person name from date
 */
export function buildPersonNameFromDate(date: string): string | null {
	return date?.trim() ? `Participant (${date.trim()})` : null
}

/**
 * Generate a person name from interview ID
 */
export function buildPersonNameFromId(id: string): string {
	const shortId = id.slice(-8) // Last 8 characters
	return `Participant (${shortId})`
}

/**
 * Main function to build a person name with smart fallback strategy
 */
export function buildPersonName(data: InterviewData, aiExtractedName?: string | null): string {
	// 1. Try AI-extracted name
	if (aiExtractedName?.trim()) {
		return aiExtractedName.trim()
	}

	// 2. Try participant pseudonym
	if (data.participant_pseudonym?.trim()) {
		return data.participant_pseudonym.trim()
	}

	// 3. Try filename
	if (data.fileName) {
		const nameFromFile = buildPersonNameFromFilename(data.fileName)
		if (nameFromFile) return nameFromFile
	}

	// 4. Try interview title
	if (data.title) {
		const nameFromTitle = buildPersonNameFromTitle(data.title)
		if (nameFromTitle) return nameFromTitle
	}

	// 5. Try interview date
	const date = data.interview_date || data.created_at?.split("T")[0]
	if (date) {
		const nameFromDate = buildPersonNameFromDate(date)
		if (nameFromDate) return nameFromDate
	}

	// 6. Final fallback: interview ID
	return buildPersonNameFromId(data.id)
}

/**
 * Determine if two person names likely refer to the same person
 * Useful for deduplication logic
 */
export function areNamesLikelySamePerson(name1: string, name2: string): boolean {
	const normalize = (name: string) =>
		name
			.toLowerCase()
			.replace(/[^\w\s]/g, "")
			.trim()
	const n1 = normalize(name1)
	const n2 = normalize(name2)

	// Exact match
	if (n1 === n2) return true

	// Check if one is a substring of the other (e.g., "John" vs "John Doe")
	if (n1.includes(n2) || n2.includes(n1)) return true

	// Check for common participant patterns
	const participantPattern = /^participant\s*\(/i
	if (participantPattern.test(name1) && participantPattern.test(name2)) {
		const content1 = name1.replace(participantPattern, "").replace(/\)$/, "").trim()
		const content2 = name2.replace(participantPattern, "").replace(/\)$/, "").trim()
		return content1 === content2
	}

	return false
}
