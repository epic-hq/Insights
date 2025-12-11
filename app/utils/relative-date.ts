/**
 * Format a date as a relative time string (e.g., "2 hours ago", "3 days ago")
 * Falls back to absolute date for older dates
 */
export function formatRelativeDate(date: Date | string | null | undefined): string {
	if (!date) return ""

	const d = typeof date === "string" ? new Date(date) : date
	if (Number.isNaN(d.getTime())) return ""

	const now = new Date()
	const diffMs = now.getTime() - d.getTime()
	const diffSec = Math.floor(diffMs / 1000)
	const diffMin = Math.floor(diffSec / 60)
	const diffHour = Math.floor(diffMin / 60)
	const diffDay = Math.floor(diffHour / 24)
	const diffWeek = Math.floor(diffDay / 7)
	const diffMonth = Math.floor(diffDay / 30)

	// Future dates
	if (diffMs < 0) {
		return d.toLocaleDateString()
	}

	// Just now (< 1 minute)
	if (diffSec < 60) {
		return "just now"
	}

	// Minutes ago
	if (diffMin < 60) {
		return diffMin === 1 ? "1 minute ago" : `${diffMin} minutes ago`
	}

	// Hours ago
	if (diffHour < 24) {
		return diffHour === 1 ? "1 hour ago" : `${diffHour} hours ago`
	}

	// Days ago (up to 7 days)
	if (diffDay < 7) {
		return diffDay === 1 ? "yesterday" : `${diffDay} days ago`
	}

	// Weeks ago (up to 4 weeks)
	if (diffWeek < 4) {
		return diffWeek === 1 ? "1 week ago" : `${diffWeek} weeks ago`
	}

	// Months ago (up to 12 months)
	if (diffMonth < 12) {
		return diffMonth === 1 ? "1 month ago" : `${diffMonth} months ago`
	}

	// Older than a year - show absolute date
	return d.toLocaleDateString()
}

/**
 * Format a date as a short relative string (e.g., "2h", "3d")
 * Useful for compact UI elements
 */
export function formatRelativeDateShort(date: Date | string | null | undefined): string {
	if (!date) return ""

	const d = typeof date === "string" ? new Date(date) : date
	if (Number.isNaN(d.getTime())) return ""

	const now = new Date()
	const diffMs = now.getTime() - d.getTime()
	const diffSec = Math.floor(diffMs / 1000)
	const diffMin = Math.floor(diffSec / 60)
	const diffHour = Math.floor(diffMin / 60)
	const diffDay = Math.floor(diffHour / 24)
	const diffWeek = Math.floor(diffDay / 7)

	if (diffMs < 0) return d.toLocaleDateString()
	if (diffSec < 60) return "now"
	if (diffMin < 60) return `${diffMin}m`
	if (diffHour < 24) return `${diffHour}h`
	if (diffDay < 7) return `${diffDay}d`
	if (diffWeek < 52) return `${diffWeek}w`

	return d.toLocaleDateString()
}
