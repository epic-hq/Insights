/**
 * TTS API Route — Streams OpenAI TTS audio for a given text input.
 *
 * POST /api/tts
 * Body: { text: string, voice?: string }
 * Returns: audio/mpeg stream
 */
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const DEFAULT_VOICE = "nova";
const DEFAULT_MODEL = "tts-1";
const MAX_TEXT_LENGTH = 4096;

interface TTSRequestBody {
	text: string;
	voice?: string;
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		consola.error("TTS: OPENAI_API_KEY not configured");
		return new Response("TTS not configured", { status: 500 });
	}

	let body: TTSRequestBody;
	try {
		body = (await request.json()) as TTSRequestBody;
	} catch {
		return new Response("Invalid JSON body", { status: 400 });
	}

	const { text, voice } = body;
	if (!text || typeof text !== "string" || text.trim().length === 0) {
		return new Response("Missing or empty text", { status: 400 });
	}

	if (text.length > MAX_TEXT_LENGTH) {
		return new Response(`Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`, { status: 400 });
	}

	const selectedVoice = voice || DEFAULT_VOICE;

	try {
		const response = await fetch(OPENAI_TTS_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: DEFAULT_MODEL,
				input: text.trim(),
				voice: selectedVoice,
				response_format: "mp3",
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			consola.error("TTS: OpenAI API error", { status: response.status, error: errorText });
			return new Response("TTS generation failed", { status: response.status });
		}

		// Stream the audio response directly through
		return new Response(response.body, {
			status: 200,
			headers: {
				"Content-Type": "audio/mpeg",
				"Cache-Control": "no-cache",
				"Transfer-Encoding": "chunked",
			},
		});
	} catch (error) {
		consola.error("TTS: Request failed", error);
		return new Response("TTS request failed", { status: 500 });
	}
}
