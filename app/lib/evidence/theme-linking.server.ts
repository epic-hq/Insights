export interface ThemeLinkCandidate {
	id: string;
	verbatim?: string | null;
	gist?: string | null;
	chunk?: string | null;
	kind_tags?: string[] | null;
}

export interface LocalThemeEvidenceMatch {
	id: string;
	confidence: number;
	rationale: string;
}

function stripTimestampSuffix(value: string): string {
	return value.replace(/\s*(?:\(|\[)\d{1,2}:\d{2}(?::\d{2})?(?:\)|\])\s*$/g, "").trim();
}

function normalizeText(value: string | null | undefined): string {
	if (!value) return "";
	return stripTimestampSuffix(value)
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function tokenize(value: string | null | undefined): Set<string> {
	return new Set(
		normalizeText(value)
			.split(/\s+/)
			.map((token) => {
				if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
				if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
				if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
				if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
				return token;
			})
			.filter((token) => token.length >= 3)
	);
}

function tokenOverlapScore(a: string | null | undefined, b: string | null | undefined): number {
	const tokensA = tokenize(a);
	const tokensB = tokenize(b);
	if (tokensA.size === 0 || tokensB.size === 0) return 0;
	let intersection = 0;
	for (const token of tokensA) {
		if (tokensB.has(token)) intersection++;
	}
	const union = new Set([...tokensA, ...tokensB]).size;
	return union === 0 ? 0 : intersection / union;
}

function tokenIntersectionCount(a: string | null | undefined, b: string | null | undefined): number {
	const tokensA = tokenize(a);
	const tokensB = tokenize(b);
	if (tokensA.size === 0 || tokensB.size === 0) return 0;
	let intersection = 0;
	for (const token of tokensA) {
		if (tokensB.has(token)) intersection++;
	}
	return intersection;
}

function clampScore(value: number): number {
	return Math.max(0, Math.min(0.99, Number(value.toFixed(4))));
}

function getCandidateTexts(candidate: ThemeLinkCandidate): string[] {
	return [candidate.verbatim ?? "", candidate.gist ?? "", candidate.chunk ?? "", ...(candidate.kind_tags ?? [])].filter(
		(value) => typeof value === "string" && value.trim().length > 0
	);
}

function scoreEvidenceQuoteMatch(evidenceQuote: string, candidate: ThemeLinkCandidate): LocalThemeEvidenceMatch | null {
	const normalizedQuote = normalizeText(evidenceQuote);
	if (normalizedQuote.length < 8) return null;

	let bestConfidence = 0;
	let rationale = "";

	for (const text of getCandidateTexts(candidate)) {
		const normalizedText = normalizeText(text);
		if (!normalizedText) continue;

		if (normalizedText.includes(normalizedQuote)) {
			const confidence = text === candidate.verbatim ? 0.98 : 0.95;
			if (confidence > bestConfidence) {
				bestConfidence = confidence;
				rationale = confidence >= 0.98 ? "Direct quote match" : "Quote matched evidence context";
			}
			continue;
		}

		if (normalizedQuote.includes(normalizedText) && normalizedText.length >= 12) {
			const confidence = text === candidate.verbatim ? 0.94 : 0.9;
			if (confidence > bestConfidence) {
				bestConfidence = confidence;
				rationale = "Evidence quote contains stored snippet";
			}
			continue;
		}

		const overlap = tokenOverlapScore(normalizedQuote, normalizedText);
		if (overlap >= 0.45) {
			const confidence = 0.72 + overlap * 0.2;
			if (confidence > bestConfidence) {
				bestConfidence = confidence;
				rationale = "Quote token overlap match";
			}
		}
	}

	if (!bestConfidence) return null;
	return {
		id: candidate.id,
		confidence: clampScore(bestConfidence),
		rationale,
	};
}

function scoreThemeTextMatch(themeTexts: string[], candidate: ThemeLinkCandidate): LocalThemeEvidenceMatch | null {
	const textCandidates = getCandidateTexts(candidate);
	let bestOverlap = 0;
	let bestIntersection = 0;
	for (const themeText of themeTexts) {
		const normalizedThemeText = normalizeText(themeText);
		if (normalizedThemeText.length < 8) continue;
		for (const text of textCandidates) {
			const overlap = tokenOverlapScore(normalizedThemeText, text);
			const intersection = tokenIntersectionCount(normalizedThemeText, text);
			if (overlap > bestOverlap || (overlap === bestOverlap && intersection > bestIntersection)) {
				bestOverlap = overlap;
				bestIntersection = intersection;
			}
		}
	}

	if (bestIntersection < 2 || bestOverlap < 0.12) return null;

	return {
		id: candidate.id,
		confidence: clampScore(0.58 + bestOverlap * 0.22 + Math.min(0.08, bestIntersection * 0.02)),
		rationale: "Theme text overlap match",
	};
}

export function findLocalEvidenceMatchesForTheme(params: {
	candidates: ThemeLinkCandidate[];
	themeName: string;
	statement?: string | null;
	inclusionCriteria?: string | null;
	synonyms?: string[] | null;
	evidenceQuote?: string | null;
	limit?: number;
}): LocalThemeEvidenceMatch[] {
	const { candidates, themeName, statement, inclusionCriteria, synonyms = [], evidenceQuote, limit = 8 } = params;

	const themeTexts = [themeName, statement, inclusionCriteria, ...(synonyms ?? [])].filter(
		(value): value is string => typeof value === "string" && value.trim().length > 0
	);
	const matches = new Map<string, LocalThemeEvidenceMatch>();

	for (const candidate of candidates) {
		const quoteMatch = evidenceQuote ? scoreEvidenceQuoteMatch(evidenceQuote, candidate) : null;
		const themeMatch = scoreThemeTextMatch(themeTexts, candidate);
		const bestMatch = [quoteMatch, themeMatch]
			.filter((match): match is LocalThemeEvidenceMatch => Boolean(match))
			.sort((a, b) => b.confidence - a.confidence)[0];

		if (!bestMatch) continue;
		const existing = matches.get(candidate.id);
		if (!existing || bestMatch.confidence > existing.confidence) {
			matches.set(candidate.id, bestMatch);
		}
	}

	return Array.from(matches.values())
		.sort((a, b) => b.confidence - a.confidence)
		.slice(0, limit);
}

export function mergeThemeEvidenceMatches(
	localMatches: LocalThemeEvidenceMatch[],
	semanticMatches: Array<{ id: string; similarity: number }>
): LocalThemeEvidenceMatch[] {
	const merged = new Map<string, LocalThemeEvidenceMatch>();

	for (const match of localMatches) {
		merged.set(match.id, match);
	}

	for (const match of semanticMatches) {
		const semanticEntry: LocalThemeEvidenceMatch = {
			id: match.id,
			confidence: clampScore(match.similarity),
			rationale: `Semantic match (${Math.round(match.similarity * 100)}%)`,
		};
		const existing = merged.get(match.id);
		if (!existing || semanticEntry.confidence > existing.confidence) {
			merged.set(match.id, semanticEntry);
		}
	}

	return Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence);
}
