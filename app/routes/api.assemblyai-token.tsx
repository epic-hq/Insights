import type { LoaderFunctionArgs } from "react-router";

export async function loader(_args: LoaderFunctionArgs) {
	const apiKey = process.env.ASSEMBLYAI_API_KEY;
	if (!apiKey) {
		return new Response(JSON.stringify({ error: "Missing ASSEMBLYAI_API_KEY" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const ttlSeconds = Number(process.env.ASSEMBLYAI_STREAMING_TOKEN_TTL ?? 300);
		const url = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=${encodeURIComponent(
			Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.min(ttlSeconds, 3600) : 300
		)}`;
		const res = await fetch(url, {
			method: "GET",
			headers: { Authorization: apiKey },
		});

		const text = await res.text();
		if (!res.ok) {
			return new Response(JSON.stringify({ error: `Token request failed: ${text}` }), {
				status: 502,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response(text, { headers: { "Content-Type": "application/json" } });
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e?.message || "Token request failed" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
