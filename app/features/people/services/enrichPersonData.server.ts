/**
 * People Data Enrichment Service
 *
 * Uses Exa.ai semantic search to research people and fill missing
 * professional fields (title, company, role, industry, company size).
 *
 * Guardrails:
 * - Never overwrites existing non-null fields
 * - Returns structured enrichment data for the caller to persist
 * - Stores source metadata to distinguish AI-enriched vs user-entered
 */

import consola from "consola";

const EXA_API_URL = "https://api.exa.ai";

export interface EnrichPersonInput {
	personId: string;
	accountId: string;
	knownName?: string | null;
	knownEmail?: string | null;
	knownCompany?: string | null;
	knownTitle?: string | null;
	knownLinkedIn?: string | null;
}

export interface EnrichPersonResult {
	enriched: boolean;
	fieldsUpdated: string[];
	source: string;
	confidence: number;
	data: {
		title?: string;
		role?: string;
		company?: string;
		industry?: string;
		companySize?: string;
		linkedinUrl?: string;
	};
	error?: string;
}

interface ExaSearchResult {
	title: string;
	url: string;
	text?: string;
	highlights?: string[];
	score: number;
}

interface ExaSearchResponse {
	results: ExaSearchResult[];
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build search query from known person data
 */
function buildSearchQuery(input: EnrichPersonInput): string {
	const parts: string[] = [];

	if (input.knownName) parts.push(input.knownName);
	if (input.knownTitle) parts.push(input.knownTitle);
	if (input.knownCompany) parts.push(`at ${input.knownCompany}`);
	if (input.knownEmail) {
		// Extract domain for company hint
		const domain = input.knownEmail.split("@")[1];
		if (domain && !domain.match(/gmail|yahoo|hotmail|outlook/i)) {
			parts.push(domain);
		}
	}

	if (parts.length === 0) return "";

	return parts.join(" ") + " professional profile";
}

/**
 * Parse Exa search results to extract structured person data
 */
function parseSearchResults(results: ExaSearchResult[]): EnrichPersonResult["data"] {
	const data: EnrichPersonResult["data"] = {};
	let bestConfidence = 0;

	for (const result of results) {
		const text = (result.text || "") + " " + (result.highlights?.join(" ") || "");
		const isLinkedIn = result.url.includes("linkedin.com");

		// LinkedIn profiles are highest confidence
		if (isLinkedIn) {
			data.linkedinUrl = result.url;

			// Extract title from LinkedIn profile text
			const titleMatch = text.match(/(?:^|\n)\s*([A-Z][^|·\n]{3,60})\s*(?:\||·|at\s)/);
			if (titleMatch && !data.title) {
				data.title = titleMatch[1].trim();
			}
		}

		// Extract company from "at Company" patterns
		const atCompanyMatch = text.match(/\bat\s+([A-Z][A-Za-z0-9\s&.,']+?)(?:\s*[|·\n]|\.\s)/);
		if (atCompanyMatch && !data.company) {
			data.company = atCompanyMatch[1].trim();
		}

		// Extract role/title from common patterns
		if (!data.title) {
			const rolePatterns = [
				/(?:Title|Role|Position):\s*([^\n|·]{3,60})/i,
				/(?:^|\n)\s*([A-Z][^|\n·]{3,40}(?:Manager|Director|VP|CEO|CTO|CFO|COO|Founder|Engineer|Designer|Lead|Head|Chief|Officer|Analyst|Consultant|Specialist))\b/,
			];
			for (const pattern of rolePatterns) {
				const match = text.match(pattern);
				if (match) {
					data.title = match[1].trim();
					break;
				}
			}
		}

		// Extract industry hints
		if (!data.industry) {
			const industryPatterns = [
				/(?:Industry|Sector):\s*([^\n|·]{3,40})/i,
				/(?:in the\s+)([\w\s&]+(?:industry|sector|space|market))/i,
			];
			for (const pattern of industryPatterns) {
				const match = text.match(pattern);
				if (match) {
					data.industry = match[1].trim();
					break;
				}
			}
		}

		// Track best confidence based on source quality
		if (isLinkedIn && result.score > bestConfidence) {
			bestConfidence = Math.min(result.score, 0.9);
		}
	}

	return data;
}

/**
 * Research a person via web search and return enrichment data.
 * Does NOT write to the database - the caller is responsible for persisting.
 */
export async function enrichPersonData(input: EnrichPersonInput): Promise<EnrichPersonResult> {
	const apiKey = process.env.EXA_API_KEY;
	if (!apiKey) {
		return {
			enriched: false,
			fieldsUpdated: [],
			source: "none",
			confidence: 0,
			data: {},
			error: "EXA_API_KEY not configured",
		};
	}

	const query = buildSearchQuery(input);
	if (!query) {
		return {
			enriched: false,
			fieldsUpdated: [],
			source: "none",
			confidence: 0,
			data: {},
			error: "Insufficient data to search (no name, email, or company)",
		};
	}

	consola.info("[enrichPersonData] Searching for:", {
		personId: input.personId,
		query,
	});

	try {
		// Search with LinkedIn preference first
		let response: Response | null = null;
		for (let attempt = 0; attempt < 3; attempt++) {
			if (attempt > 0) {
				await delay(1000 * (attempt + 1));
			}

			response = await fetch(`${EXA_API_URL}/search`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
				},
				body: JSON.stringify({
					query,
					numResults: 5,
					type: "auto",
					useAutoprompt: true,
					category: "linkedin profile",
					contents: {
						text: { maxCharacters: 800 },
						highlights: { numSentences: 3 },
					},
				}),
			});

			if (response.ok) break;
			if (response.status !== 429) break;
		}

		// Fallback: general search if LinkedIn returned nothing
		let data: ExaSearchResponse | null = null;

		if (response?.ok) {
			data = (await response.json()) as ExaSearchResponse;
		}

		if (!data?.results?.length) {
			// Retry without category filter
			for (let attempt = 0; attempt < 3; attempt++) {
				if (attempt > 0) await delay(1000 * (attempt + 1));

				response = await fetch(`${EXA_API_URL}/search`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": apiKey,
					},
					body: JSON.stringify({
						query,
						numResults: 5,
						type: "auto",
						useAutoprompt: true,
						contents: {
							text: { maxCharacters: 800 },
							highlights: { numSentences: 3 },
						},
					}),
				});

				if (response?.ok) break;
				if (response?.status !== 429) break;
			}

			if (response?.ok) {
				data = (await response.json()) as ExaSearchResponse;
			}
		}

		if (!data?.results?.length) {
			return {
				enriched: false,
				fieldsUpdated: [],
				source: "web_search",
				confidence: 0,
				data: {},
				error: "No results found",
			};
		}

		const parsedData = parseSearchResults(data.results);

		// Determine which fields were found
		const fieldsUpdated: string[] = [];
		if (parsedData.title) fieldsUpdated.push("title");
		if (parsedData.role) fieldsUpdated.push("role");
		if (parsedData.company) fieldsUpdated.push("company");
		if (parsedData.industry) fieldsUpdated.push("industry");
		if (parsedData.companySize) fieldsUpdated.push("companySize");
		if (parsedData.linkedinUrl) fieldsUpdated.push("linkedinUrl");

		const enriched = fieldsUpdated.length > 0;
		const hasLinkedIn = data.results.some((r) => r.url.includes("linkedin.com"));
		const source = hasLinkedIn ? "linkedin" : "web_search";
		const confidence = hasLinkedIn
			? Math.min(0.85, 0.5 + fieldsUpdated.length * 0.1)
			: Math.min(0.6, 0.3 + fieldsUpdated.length * 0.1);

		consola.info("[enrichPersonData] Result:", {
			personId: input.personId,
			enriched,
			fieldsUpdated,
			source,
			confidence,
		});

		return {
			enriched,
			fieldsUpdated,
			source,
			confidence,
			data: parsedData,
		};
	} catch (error) {
		consola.error("[enrichPersonData] Error:", error);
		return {
			enriched: false,
			fieldsUpdated: [],
			source: "web_search",
			confidence: 0,
			data: {},
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
