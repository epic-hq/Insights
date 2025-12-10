/**
 * Index Note Task
 *
 * Extracts evidence from notes/documents and generates embeddings
 * for semantic search. Used for web research notes, meeting notes,
 * market reports, and other unstructured documents.
 */

import { schemaTask } from "@trigger.dev/sdk"
import consola from "consola"
import { z } from "zod"
import { b } from "~/../baml_client"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

const OPENAI_API_URL = "https://api.openai.com/v1/embeddings"

/**
 * Generate OpenAI embedding for text
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
	const apiKey = process.env.OPENAI_API_KEY
	if (!apiKey) {
		consola.warn("[indexNote] OPENAI_API_KEY not set, skipping embedding")
		return null
	}

	try {
		const response = await fetch(OPENAI_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: "text-embedding-3-small",
				input: text.slice(0, 8000),
				dimensions: 1536,
			}),
		})

		if (!response.ok) {
			const error = await response.text()
			consola.error("[indexNote] OpenAI embedding error:", error)
			return null
		}

		const data = await response.json()
		return data.data[0].embedding
	} catch (error) {
		consola.error("[indexNote] Embedding generation failed:", error)
		return null
	}
}

export const indexNoteTask = schemaTask({
	id: "note.index",
	schema: z.object({
		interviewId: z.string().uuid(),
		maxEvidence: z.number().min(1).max(50).default(15),
	}),
	retry: {
		maxAttempts: 3,
		factor: 2,
		minTimeoutInMs: 1000,
		maxTimeoutInMs: 30000,
	},
	run: async (payload) => {
		const { interviewId, maxEvidence } = payload
		const db = createSupabaseAdminClient()

		consola.info(`[indexNote] Starting indexing for note: ${interviewId}`)

		// 1. Load the note/interview
		const { data: interview, error: interviewError } = await db
			.from("interviews")
			.select("*")
			.eq("id", interviewId)
			.single()

		if (interviewError || !interview) {
			throw new Error(`Note not found: ${interviewId}`)
		}

		// Get document text from observations_and_notes or transcript
		const documentText =
			interview.observations_and_notes ||
			(interview.transcript_formatted as any)?.full_transcript ||
			""

		if (!documentText || documentText.length < 50) {
			consola.warn(`[indexNote] Note ${interviewId} has insufficient text`)
			return {
				success: false,
				error: "Insufficient text content",
				evidenceCount: 0,
			}
		}

		// Determine document type from media_type
		const documentType = interview.media_type || "note"

		consola.info(`[indexNote] Extracting evidence from ${documentType}, text length: ${documentText.length}`)

		// 2. Extract evidence using BAML
		let extraction
		try {
			extraction = await b.ExtractEvidenceFromDocument(
				documentText,
				interview.title || undefined,
				documentType,
				maxEvidence
			)
		} catch (bamlError) {
			consola.error("[indexNote] BAML extraction failed:", bamlError)
			throw new Error(`Evidence extraction failed: ${bamlError}`)
		}

		consola.info(`[indexNote] Extracted ${extraction.evidence.length} evidence units`)

		// 3. Delete existing evidence for idempotency
		const { error: deleteError } = await db
			.from("evidence")
			.delete()
			.eq("interview_id", interviewId)

		if (deleteError) {
			consola.warn(`[indexNote] Failed to delete existing evidence:`, deleteError)
		}

		// 4. Create evidence records with embeddings
		let evidenceCount = 0
		for (const ev of extraction.evidence) {
			try {
				// Generate embedding for the evidence
				const textToEmbed = `${ev.gist}: ${ev.verbatim}`
				const embedding = await generateEmbedding(textToEmbed)

				const evidenceRecord = {
					account_id: interview.account_id,
					project_id: interview.project_id,
					interview_id: interviewId,
					verbatim: ev.verbatim,
					gist: ev.gist,
					context_summary: ev.context_summary,
					method: documentType === "web_research" ? "market_report" : "other",
					source_type: "secondary" as const,
					modality: "qual" as const,
					confidence: "medium" as const,
					pains: ev.pains || [],
					gains: ev.gains || [],
					thinks: ev.thinks || [],
					feels: ev.feels || [],
					...(embedding && {
						embedding: embedding,
						embedding_model: "text-embedding-3-small",
						embedding_generated_at: new Date().toISOString(),
					}),
				}

				const { error: evidenceError } = await db
					.from("evidence")
					.insert(evidenceRecord as any)

				if (evidenceError) {
					consola.error("[indexNote] Failed to save evidence:", evidenceError)
				} else {
					evidenceCount++
				}
			} catch (evErr) {
				consola.error("[indexNote] Error creating evidence:", evErr)
			}
		}

		// 5. Update interview with summary and topics
		await db
			.from("interviews")
			.update({
				conversation_analysis: {
					...(interview.conversation_analysis as object || {}),
					indexed_at: new Date().toISOString(),
					evidence_count: evidenceCount,
					summary: extraction.summary,
					topics: extraction.topics,
				},
				status: "ready",
			})
			.eq("id", interviewId)

		consola.success(`[indexNote] Indexed note ${interviewId}: ${evidenceCount} evidence records`)

		return {
			success: true,
			evidenceCount,
			summary: extraction.summary,
			topics: extraction.topics,
		}
	},
})
