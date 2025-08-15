import * as React from "react"
import type { LoaderFunctionArgs } from "react-router-dom"
import { type MetaFunction, useLoaderData } from "react-router-dom"

// IMPORTANT: this import should point to the file where you exported the demo/container.
// From your canvas: it looks like you exported default PersonaSpectrumV2Demo.
import PersonaSpectrumV2Demo from "~/features/personas/components/persona_visualization_mockup4" // adjust path if needed

// --- Loader: expose env safely to client (optional, but recommended for Supabase) ---
export async function loader(_args: LoaderFunctionArgs) {
	const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env
	return {
		ENV: {
			SUPABASE_URL: SUPABASE_URL ?? "",
			SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ?? "",
		},
	}
}

export const meta: MetaFunction = () => [
	{ title: "Persona Spectrum Visualization" },
	{ name: "viewport", content: "width=device-width, initial-scale=1" },
]

// --- ClientOnly wrapper so Recharts mounts only on the client ---
function ClientOnly(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
	const [ready, setReady] = React.useState(false)
	React.useEffect(() => setReady(true), [])
	if (!ready) return <>{props.fallback ?? null}</>
	return <>{props.children}</>
}

export default function PersonasSpectrumRoute() {
	const { ENV } = useLoaderData<typeof loader>()

	// Make ENV available to the chart code that looks for window.ENV
	React.useEffect(() => {
		if (typeof window !== "undefined") {
			;(window as any).ENV = {
				...(window as any).ENV,
				...ENV,
			}
		}
	}, [ENV])

	return (
		<div className="min-h-screen bg-[#0b0b0c] text-zinc-100">
			<div className="mx-auto max-w-6xl px-6 py-8">
				<header className="mb-6 border-zinc-800 border-b pb-4">
					<h1 className="font-semibold text-2xl tracking-tight">Persona Spectrum Visualization</h1>
					<p className="mt-1 text-sm text-zinc-400">
						Compare personas on key spectrums using Supabase data or demo mode.
					</p>
				</header>

				<ClientOnly
					fallback={
						<div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-400">
							Loading visualization…
						</div>
					}
				>
					<PersonaSpectrumV2Demo />
				</ClientOnly>
			</div>
		</div>
	)
}
