import type { LoaderFunctionArgs } from "react-router"

export async function loader({ request }: LoaderFunctionArgs) {
	// Optional tiny tarpit for obvious scripts:
	const ua = request.headers.get("user-agent") || ""
	if (!ua || /curl|wget|python|nikto|wpscan|bot|spider/i.test(ua)) {
		await new Promise((r) => setTimeout(r, 200))
	}

	return new Response("Not Found", {
		status: 404, // or 410
		headers: {
			"cache-control": "no-store",
			"x-content-type-options": "nosniff",
			"x-frame-options": "DENY",
		},
	})
}

// No UI needed; keeps SSR cheap.
export default function Probes() {
	return null
}
