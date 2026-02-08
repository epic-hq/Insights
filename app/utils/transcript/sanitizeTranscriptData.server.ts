import consola from "consola";

const DEFAULT_MAX_TOPIC_RESULTS = 200;
const DEFAULT_MAX_LABELS_PER_RESULT = 5;

interface SanitizedSpeakerUtterance {
	speaker: string;
	text: string;
	start: number | null;
	end: number | null;
	confidence: number | null;
}

interface SanitizedTopicLabel {
	label: string;
	relevance: number;
}

interface SanitizedTopicResult {
	text: string;
	labels: SanitizedTopicLabel[];
	start_time: number | null;
	end_time: number | null;
}

interface SanitizedTopicDetection {
	status?: string;
	summary?: Record<string, number>;
	results?: SanitizedTopicResult[];
}

interface SanitizedSentimentResult {
	sentiment: string;
	speaker?: string;
	text: string;
	start: number | null;
	end: number | null;
	confidence: number | null;
}

interface SanitizedChapter {
	start_ms: number;
	end_ms?: number;
	summary?: string;
	title?: string;
}

interface SanitizedWord {
	text: string;
	start: number;
	end: number;
	confidence: number | null;
}

interface SanitizeOptions {
	maxTopicResults?: number;
	maxLabelsPerResult?: number;
	omitFullTranscript?: boolean;
}

interface SanitizedTranscriptPayload {
	full_transcript?: string;
	confidence?: number | null;
	audio_duration?: number | null;
	processing_duration?: number | null;
	file_type?: string | null;
	assembly_id?: string | null;
	language?: string | null;
	language_code?: string | null;
	word_count?: number | null;
	speaker_count?: number | null;
	original_filename?: string | null;
	is_processed?: boolean | null;
	processed_at?: string | null;
	speaker_transcripts: SanitizedSpeakerUtterance[];
	words?: SanitizedWord[];
	topic_detection?: SanitizedTopicDetection | null;
	sentiment_analysis_results?: SanitizedSentimentResult[];
	chapters?: SanitizedChapter[];
}

const coerceNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number.parseFloat(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

const sanitizeSpeakers = (value: unknown): SanitizedSpeakerUtterance[] => {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (typeof item !== "object" || !item) return null;
			const record = item as Record<string, unknown>;
			const speakerRaw = record.speaker ?? record.speaker_label ?? record.channel ?? "";
			const speaker = typeof speakerRaw === "string" && speakerRaw.trim().length ? speakerRaw.trim() : "";
			const text = typeof record.text === "string" ? record.text : "";
			const start = coerceNumber(record.start ?? record.start_time ?? record.begin);
			const end = coerceNumber(record.end ?? record.end_time ?? record.finish ?? record.stop);
			const confidence = coerceNumber(record.confidence ?? record.confidence_score);
			return { speaker, text, start, end, confidence };
		})
		.filter((item): item is SanitizedSpeakerUtterance => item !== null);
};

const sanitizeWords = (value: unknown): SanitizedWord[] => {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (typeof item !== "object" || !item) return null;
			const record = item as Record<string, unknown>;
			const text = typeof record.text === "string" ? record.text : "";
			if (!text) return null;
			const start = coerceNumber(record.start ?? record.start_time);
			const end = coerceNumber(record.end ?? record.end_time);
			if (start === null || end === null) return null;
			const confidence = coerceNumber(record.confidence ?? record.confidence_score);
			return { text, start, end, confidence };
		})
		.filter((item): item is SanitizedWord => item !== null);
};

/**
 * Find the best matching speaker utterance for a given text snippet
 * Returns the start/end times from the utterance that contains or best matches the text
 */
const findTimingForText = (
	text: string,
	utterances: SanitizedSpeakerUtterance[]
): { start: number | null; end: number | null } => {
	if (!text || !utterances.length) return { start: null, end: null };

	// Normalize text for comparison (lowercase, trim, remove extra whitespace)
	const normalizedSearchText = text.toLowerCase().trim().replace(/\s+/g, " ");

	// Try to find an utterance that contains this text
	for (const utterance of utterances) {
		const normalizedUtteranceText = utterance.text.toLowerCase().trim().replace(/\s+/g, " ");
		if (normalizedUtteranceText.includes(normalizedSearchText)) {
			return { start: utterance.start, end: utterance.end };
		}
	}

	// If no exact match, find the utterance with the most word overlap
	const searchWords = new Set(normalizedSearchText.split(" ").filter((w) => w.length > 3));
	if (searchWords.size === 0) return { start: null, end: null };

	let bestMatch: SanitizedSpeakerUtterance | null = null;
	let bestOverlap = 0;

	for (const utterance of utterances) {
		const utteranceWords = utterance.text
			.toLowerCase()
			.split(" ")
			.filter((w) => w.length > 3);
		const overlap = utteranceWords.filter((w) => searchWords.has(w)).length;
		if (overlap > bestOverlap) {
			bestOverlap = overlap;
			bestMatch = utterance;
		}
	}

	// Return timing if we found a reasonable match (at least 2 words overlap)
	if (bestMatch && bestOverlap >= 2) {
		return { start: bestMatch.start, end: bestMatch.end };
	}

	return { start: null, end: null };
};

const sanitizeTopicDetection = (
	value: unknown,
	options: Required<Pick<SanitizeOptions, "maxTopicResults" | "maxLabelsPerResult">>,
	utterances: SanitizedSpeakerUtterance[] = []
): SanitizedTopicDetection | null => {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	const rawResults = Array.isArray(record.results) ? record.results : [];
	const sanitizedResults = rawResults
		.slice(0, options.maxTopicResults)
		.map((item) => {
			if (typeof item !== "object" || !item) return null;
			const row = item as Record<string, unknown>;
			const text = typeof row.text === "string" ? row.text : "";
			const labels = Array.isArray(row.labels)
				? row.labels
						.map((label) => {
							if (typeof label !== "object" || !label) return null;
							const payload = label as Record<string, unknown>;
							const name = typeof payload.label === "string" ? payload.label : "";
							if (!name) return null;
							const relevance = coerceNumber(payload.relevance) ?? 0;
							return { label: name, relevance };
						})
						.filter((label): label is SanitizedTopicLabel => label !== null)
						.slice(0, options.maxLabelsPerResult)
				: [];

			// Try to get timing from the raw data first
			let start = coerceNumber(row.start ?? row.start_time);
			let end = coerceNumber(row.end ?? row.end_time);

			// If no timing in raw data, try to infer from speaker utterances
			if ((start === null || start === undefined) && utterances.length > 0 && text) {
				const timing = findTimingForText(text, utterances);
				start = timing.start;
				end = timing.end;
			}

			return { text, labels, start_time: start ?? null, end_time: end ?? null };
		})
		.filter((item): item is SanitizedTopicResult => item !== null);

	const status = typeof record.status === "string" ? record.status : undefined;
	const summary =
		record.summary && typeof record.summary === "object" ? (record.summary as Record<string, number>) : undefined;

	return {
		status,
		summary,
		results: sanitizedResults,
	};
};

const sanitizeSentiment = (value: unknown): SanitizedSentimentResult[] => {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (typeof item !== "object" || !item) return null;
			const row = item as Record<string, unknown>;
			const sentiment = typeof row.sentiment === "string" ? row.sentiment : "neutral";
			const text = typeof row.text === "string" ? row.text : "";
			const speaker = typeof row.speaker === "string" ? row.speaker : undefined;
			const start = coerceNumber(row.start);
			const end = coerceNumber(row.end);
			const confidence = coerceNumber(row.confidence);
			return { sentiment, text, speaker, start, end, confidence };
		})
		.filter((item): item is SanitizedSentimentResult => item !== null);
};

const sanitizeChapters = (value: unknown): SanitizedChapter[] => {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (typeof item !== "object" || !item) return null;
			const row = item as Record<string, unknown>;
			const start = coerceNumber(row.start_ms ?? row.start);
			if (start === null) return null;
			const end = coerceNumber(row.end_ms ?? row.end ?? undefined) ?? undefined;
			const summary =
				typeof row.summary === "string" ? row.summary : typeof row.gist === "string" ? row.gist : undefined;
			const title = typeof row.title === "string" ? row.title : undefined;
			return { start_ms: start, end_ms: end ?? undefined, summary, title };
		})
		.filter((item): item is SanitizedChapter => item !== null);
};

const stripUndefined = (record: Record<string, unknown>) => {
	return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
};

function sanitizeTranscriptPayload(payload: unknown, options: SanitizeOptions = {}): SanitizedTranscriptPayload {
	if (!payload || typeof payload !== "object") {
		return { speaker_transcripts: [], topic_detection: null, sentiment_analysis_results: [], chapters: [] };
	}

	const config = {
		maxTopicResults: options.maxTopicResults ?? DEFAULT_MAX_TOPIC_RESULTS,
		maxLabelsPerResult: options.maxLabelsPerResult ?? DEFAULT_MAX_LABELS_PER_RESULT,
	};

	const raw = payload as Record<string, unknown>;

	const transcript =
		typeof raw.full_transcript === "string" ? raw.full_transcript : typeof raw.text === "string" ? raw.text : undefined;
	const confidence = coerceNumber(raw.confidence);
	const audioDuration = coerceNumber(raw.audio_duration);
	const processingDuration = coerceNumber(raw.processing_duration);
	const fileType = typeof raw.file_type === "string" ? raw.file_type : undefined;
	const assemblyId = typeof raw.assembly_id === "string" ? raw.assembly_id : undefined;
	const originalFilename = typeof raw.original_filename === "string" ? raw.original_filename : undefined;
	const wordCount = coerceNumber(raw.word_count);
	const speakerCount = coerceNumber(raw.speaker_count);
	const languageCode = typeof raw.language_code === "string" ? raw.language_code : undefined;
	const language = typeof raw.language === "string" ? raw.language : (languageCode ?? undefined);
	const processedFlag = typeof raw.is_processed === "boolean" ? raw.is_processed : undefined;
	const processedAt = typeof raw.processed_at === "string" ? raw.processed_at : undefined;

	const speakerTranscripts = sanitizeSpeakers(raw.speaker_transcripts ?? raw.utterances);
	const words = sanitizeWords(raw.words);

	const topicDetection = sanitizeTopicDetection(
		raw.topic_detection ?? raw.iab_categories_result,
		config,
		speakerTranscripts
	);
	const sentiment = sanitizeSentiment(raw.sentiment_analysis_results ?? raw.sentiment_analysis);

	const chapters = sanitizeChapters(raw.chapters ?? raw.auto_chapters ?? raw.segments);

	const sanitized = stripUndefined({
		full_transcript: options.omitFullTranscript ? undefined : transcript,
		confidence,
		audio_duration: audioDuration,
		processing_duration: processingDuration,
		file_type: fileType ?? null,
		assembly_id: assemblyId ?? null,
		language: language ?? null,
		language_code: languageCode ?? null,
		word_count: wordCount,
		speaker_count: speakerCount,
		original_filename: originalFilename ?? null,
		is_processed: processedFlag ?? null,
		processed_at: processedAt ?? null,
		chapters: chapters.length ? chapters : undefined,
	});

	return {
		...sanitized,
		speaker_transcripts: speakerTranscripts,
		words: words.length ? words : undefined,
		topic_detection: topicDetection,
		sentiment_analysis_results: sentiment,
	};
}

export function safeSanitizeTranscriptPayload(payload: unknown, options?: SanitizeOptions): SanitizedTranscriptPayload {
	try {
		return sanitizeTranscriptPayload(payload, options);
	} catch (error) {
		consola.warn("sanitizeTranscriptPayload failed", error);
		return {
			speaker_transcripts: [],
			topic_detection: null,
			sentiment_analysis_results: [],
		};
	}
}
