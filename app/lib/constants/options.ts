/**
 * Centralized application-wide select options and field values
 *
 * Use these for dropdowns, filters, and data normalization across the app.
 * Having a single source of truth ensures consistency in UI and data.
 */

export interface SelectOption {
	value: string
	label: string
	description?: string
}

// ========================================
// ORGANIZATION OPTIONS
// ========================================

export const COMPANY_SIZE_RANGES: SelectOption[] = [
	{ value: "1-10", label: "1-10" },
	{ value: "11-50", label: "11-50" },
	{ value: "51-200", label: "51-200" },
	{ value: "201-500", label: "201-500" },
	{ value: "501-1000", label: "501-1,000" },
	{ value: "1001-5000", label: "1,001-5,000" },
	{ value: "5001-10000", label: "5,001-10,000" },
	{ value: "10000+", label: "10,000+" },
]

export const FUNDING_STAGES: SelectOption[] = [
	{ value: "bootstrapped", label: "Bootstrapped" },
	{ value: "pre-seed", label: "Pre-Seed" },
	{ value: "seed", label: "Seed" },
	{ value: "series-a", label: "Series A" },
	{ value: "series-b", label: "Series B" },
	{ value: "series-c", label: "Series C" },
	{ value: "series-d+", label: "Series D+" },
	{ value: "public", label: "Public" },
	{ value: "acquired", label: "Acquired" },
]

export const COMPANY_TYPES: SelectOption[] = [
	{ value: "B2B", label: "B2B" },
	{ value: "B2C", label: "B2C" },
	{ value: "B2B2C", label: "B2B2C" },
	{ value: "D2C", label: "D2C" },
	{ value: "Marketplace", label: "Marketplace" },
	{ value: "Enterprise", label: "Enterprise" },
	{ value: "SMB", label: "SMB" },
	{ value: "Startup", label: "Startup" },
]

// ========================================
// PEOPLE / PERSON OPTIONS
// ========================================

export const SENIORITY_LEVELS: SelectOption[] = [
	{ value: "intern", label: "Intern" },
	{ value: "junior", label: "Junior IC" },
	{ value: "mid", label: "IC" },
	{ value: "senior", label: "Senior IC" },
	{ value: "staff", label: "Staff/Principal" },
	{ value: "manager", label: "Manager" },
	{ value: "director", label: "Director" },
	{ value: "vp", label: "VP" },
	{ value: "c-level", label: "C-Level" },
]

export const JOB_FUNCTIONS: SelectOption[] = [
	{ value: "engineering", label: "Engineering" },
	{ value: "product", label: "Product" },
	{ value: "design", label: "Design" },
	{ value: "marketing", label: "Marketing" },
	{ value: "sales", label: "Sales" },
	{ value: "customer-success", label: "Customer Success" },
	{ value: "operations", label: "Operations" },
	{ value: "finance", label: "Finance" },
	{ value: "hr", label: "HR / People" },
	{ value: "legal", label: "Legal" },
	{ value: "data", label: "Data & Analytics" },
	{ value: "research", label: "Research" },
	{ value: "executive", label: "Executive" },
]

export const PERSON_TYPES: SelectOption[] = [
	{
		value: "external",
		label: "External",
		description: "Customer, prospect, or partner",
	},
	{ value: "internal", label: "Internal", description: "Team member" },
]

// ========================================
// RELATIONSHIP OPTIONS
// ========================================

export const RELATIONSHIP_STATUSES: SelectOption[] = [
	{ value: "active", label: "Active" },
	{ value: "churned", label: "Churned" },
	{ value: "prospect", label: "Prospect" },
	{ value: "partner", label: "Partner" },
	{ value: "former", label: "Former" },
]

// ========================================
// OPPORTUNITY / SALES OPTIONS
// ========================================

export const OPPORTUNITY_STAGES: SelectOption[] = [
	{ value: "prospect", label: "Prospect" },
	{ value: "discovery", label: "Discovery" },
	{ value: "evaluation", label: "Evaluation" },
	{ value: "proposal", label: "Proposal" },
	{ value: "negotiation", label: "Negotiation" },
	{ value: "commit", label: "Commit" },
	{ value: "closed-won", label: "Closed Won" },
	{ value: "closed-lost", label: "Closed Lost" },
]

export const CONFIDENCE_LEVELS: SelectOption[] = [
	{ value: "low", label: "Low", description: "< 30%" },
	{ value: "medium", label: "Medium", description: "30-70%" },
	{ value: "high", label: "High", description: "> 70%" },
]

// ========================================
// INDUSTRIES
// ========================================

export const INDUSTRIES: SelectOption[] = [
	{ value: "saas", label: "SaaS / Software" },
	{ value: "fintech", label: "Fintech" },
	{ value: "healthcare", label: "Healthcare" },
	{ value: "healthtech", label: "Healthcare Technology" },
	{ value: "edtech", label: "Education Technology" },
	{ value: "ecommerce", label: "E-commerce" },
	{ value: "retail", label: "Retail" },
	{ value: "manufacturing", label: "Manufacturing" },
	{ value: "logistics", label: "Logistics" },
	{ value: "real-estate", label: "Real Estate" },
	{ value: "proptech", label: "Real Estate Technology" },
	{ value: "insurtech", label: "Insurance Technology" },
	{ value: "cybersecurity", label: "Cybersecurity" },
	{ value: "ai-ml", label: "AI / Machine Learning" },
	{ value: "biotech", label: "Biotechnology" },
	{ value: "cleantech", label: "Clean Technology" },
	{ value: "agtech", label: "Agriculture Technology" },
	{ value: "martech", label: "Marketing Technology" },
	{ value: "hrtech", label: "HR Technology" },
	{ value: "legaltech", label: "Legal Technology" },
	{ value: "media", label: "Media & Entertainment" },
	{ value: "gaming", label: "Gaming" },
	{ value: "travel", label: "Travel & Hospitality" },
	{ value: "automotive", label: "Automotive" },
	{ value: "energy", label: "Energy" },
	{ value: "telecom", label: "Telecommunications" },
	{ value: "consulting", label: "Consulting" },
	{ value: "other", label: "Other" },
]

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get the label for an option value
 */
export function getOptionLabel(options: SelectOption[], value: string | null | undefined): string | null {
	if (!value) return null
	const option = options.find((o) => o.value === value)
	return option?.label ?? value
}

/**
 * Map an employee count to a size range
 */
export function employeeCountToSizeRange(count: number): string {
	if (count <= 10) return "1-10"
	if (count <= 50) return "11-50"
	if (count <= 200) return "51-200"
	if (count <= 500) return "201-500"
	if (count <= 1000) return "501-1000"
	if (count <= 5000) return "1001-5000"
	if (count <= 10000) return "5001-10000"
	return "10000+"
}
