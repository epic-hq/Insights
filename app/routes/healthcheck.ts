import type { LoaderFunctionArgs } from 'react-router';

export async function loader({ request }: LoaderFunctionArgs) {
	// Simple health check that returns 200 when the server is running
	return new Response('OK', {
		status: 200,
		headers: {
			'Content-Type': 'text/plain',
			'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
			'X-Content-Type-Options': 'nosniff',
		},
	});
}

// No component needed for this route
export default function HealthCheck() {
	return null;
}
