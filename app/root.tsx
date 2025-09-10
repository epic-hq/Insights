import { PostHogProvider } from "posthog-js/react"
import { useTranslation } from "react-i18next"
import {
	isRouteErrorResponse,
	Links,
	type LinksFunction,
	Meta,
	type MetaFunction,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteError,
} from "react-router"
import { useChangeLanguage } from "remix-i18next/react"
import { Toaster } from "sonner"
import { ClientOnly } from "~/components/ClientOnly"
import ErrorBoundaryComponent from "~/components/ErrorBoundary"
import { NotificationProvider } from "~/contexts/NotificationContext"
import { ThemeProvider } from "~/contexts/ThemeContext"
import { loadContext } from "~/server/load-context"
import type { Route } from "./+types/root"
import { ClientHintCheck, getHints } from "./services/client-hints"
import tailwindcss from "./tailwind.css?url"

export async function loader({ context, request }: Route.LoaderArgs) {
	const loadCtx = context.get(loadContext)
	const hints = getHints(request)

	return {
		lang: loadCtx.lang,
		clientEnv: loadCtx.clientEnv,
		hints,
	}
}

// Define the links for the application
export const links: LinksFunction = () => [
	// Stylesheet
	{ rel: "stylesheet", href: tailwindcss },
	// Favicon
	{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
	// Apple touch icon
	{ rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png" },
	// Web app manifest
	{ rel: "manifest", href: "/manifest.json" },
	// Additional icon sizes for various platforms
	{ rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/icon-32x32.png" },
	{ rel: "icon", type: "image/png", sizes: "16x16", href: "/icons/icon-16x16.png" },
	{ rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192x192.png" },
	{ rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512x512.png" },
]

// Define meta tags for the application
export const meta: MetaFunction = () => {
	return [
		{ name: "viewport", content: "width=device-width,initial-scale=1" },
		{ name: "theme-color", content: "#2563eb" },
		{ name: "msapplication-config", content: "/browserconfig.xml" },
		{ name: "msapplication-TileColor", content: "#2563eb" },
		{ name: "msapplication-TileImage", content: "/icons/icon-144x144.png" },
	]
}

export const handle = {
	i18n: "common",
}

export default function App({ loaderData }: Route.ComponentProps) {
	const { lang, clientEnv } = loaderData
	useChangeLanguage(lang)

    // Minimal PostHog host normalization: add https:// if missing and trim trailing slash
    const apiHost = clientEnv.POSTHOG_HOST
        ? ((clientEnv.POSTHOG_HOST.startsWith("http") ? clientEnv.POSTHOG_HOST : `https://${clientEnv.POSTHOG_HOST}`) as string).replace(/\/+$/, "")
        : undefined

	// Make clientEnv available globally on window.env for polyEnv pattern
	if (typeof window !== "undefined") {
		window.env = clientEnv
	}

	return (
		<ClientOnly fallback={<div className="flex h-screen w-screen items-center justify-center">Loading...</div>}>
			{/* <AuthProvider initialAuth={auth}> */}
			<ThemeProvider defaultTheme="light">
                <PostHogProvider
                    apiKey={clientEnv.POSTHOG_KEY}
                    options={{
                        api_host: apiHost,
                        ui_host: "https://us.posthog.com",
                        defaults: "2025-05-24",
                        capture_exceptions: true,
                        debug: false, // import.meta.env.MODE === "development",
                    }}
                >
					<NotificationProvider>
						<Outlet />
						<Toaster />
					</NotificationProvider>
				</PostHogProvider>
			</ThemeProvider>
			{/* </AuthProvider> */}
		</ClientOnly>
	)
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
	const { i18n } = useTranslation()
	return (
		<html className="overflow-y-auto overflow-x-hidden" lang={i18n.language} dir={i18n.dir()}>
			<head>
				<ClientHintCheck />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="h-full w-full bg-background text-foreground">
				{/* <LanguageSwitcher /> */}
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

// Cute low-fidelity SVG illustration for 404
const LostIllustration = () => (
	<svg viewBox="0 0 400 300" className="mx-auto h-48 w-64">
		{/* Background elements */}
		<circle cx="80" cy="60" r="25" fill="#FFE4B5" opacity="0.6" />
		<circle cx="320" cy="80" r="20" fill="#E6E6FA" opacity="0.6" />
		<circle cx="350" cy="220" r="15" fill="#FFB6C1" opacity="0.6" />

		{/* Ground line */}
		<line x1="0" y1="250" x2="400" y2="250" stroke="#DDD" strokeWidth="2" strokeDasharray="5,5" />

		{/* Lost character */}
		<g transform="translate(200, 150)">
			{/* Body */}
			<ellipse cx="0" cy="40" rx="35" ry="45" fill="#4F46E5" />

			{/* Head */}
			<circle cx="0" cy="-10" r="25" fill="#FFE4C7" />

			{/* Eyes */}
			<circle cx="-8" cy="-15" r="3" fill="#2D1B69" />
			<circle cx="8" cy="-15" r="3" fill="#2D1B69" />
			<circle cx="-7" cy="-16" r="1" fill="white" />
			<circle cx="9" cy="-16" r="1" fill="white" />

			{/* Confused eyebrows */}
			<line x1="-12" y1="-22" x2="-4" y2="-20" stroke="#2D1B69" strokeWidth="2" strokeLinecap="round" />
			<line x1="4" y1="-20" x2="12" y2="-22" stroke="#2D1B69" strokeWidth="2" strokeLinecap="round" />

			{/* Small mouth */}
			<ellipse cx="0" cy="-2" rx="4" ry="2" fill="#2D1B69" />

			{/* Arms */}
			<line x1="-25" y1="25" x2="-40" y2="15" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
			<line x1="25" y1="25" x2="40" y2="35" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />

			{/* Legs */}
			<line x1="-15" y1="80" x2="-20" y2="100" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
			<line x1="15" y1="80" x2="20" y2="100" stroke="#4F46E5" strokeWidth="8" strokeLinecap="round" />
		</g>

		{/* Question marks floating around */}
		<text x="120" y="80" fontSize="24" fill="#6366F1" opacity="0.7">
			?
		</text>
		<text x="290" y="130" fontSize="18" fill="#6366F1" opacity="0.5">
			?
		</text>
		<text x="100" y="180" fontSize="20" fill="#6366F1" opacity="0.6">
			?
		</text>

		{/* Map pieces scattered */}
		<rect x="60" y="200" width="20" height="15" fill="#34D399" opacity="0.7" rx="2" />
		<rect x="90" y="210" width="15" height="20" fill="#F59E0B" opacity="0.7" rx="2" />
		<rect x="320" y="190" width="18" height="12" fill="#EF4444" opacity="0.7" rx="2" />
	</svg>
)

export const ErrorBoundary = () => {
	const error = useRouteError()

	// For 404 errors, show the splat route style (keeping existing behavior)
	if (isRouteErrorResponse(error) && error.status === 404) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900">
				<div className="w-full max-w-2xl text-center">
					{/* Cute illustration */}
					<div className="mb-8 flex justify-center">
						<LostIllustration />
					</div>

					{/* Error message with personality */}
					<div className="mb-10 space-y-4">
						<h1 className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text font-bold text-7xl text-transparent">
							404
						</h1>
						<h2 className="font-semibold text-3xl text-gray-800 dark:text-gray-100">Oops! We're a bit lost too</h2>
						<p className="mx-auto max-w-md text-gray-600 text-lg leading-relaxed dark:text-gray-300">
							The page you're looking for seems to have wandered off. Don't worry though, we can help you find your way
							back!
						</p>
					</div>

					{/* Action buttons */}
					<div className="flex flex-col justify-center gap-4 sm:flex-row">
						<button
							type="button"
							onClick={() => window.history.back()}
							className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-transparent bg-gradient-to-r from-gray-100 to-gray-200 px-8 py-4 font-medium text-base text-gray-700 shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg dark:from-gray-700 dark:to-gray-600 dark:text-gray-100"
						>
							← Go Back
						</button>
						<a
							href="/home"
							className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-transparent bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-4 font-medium text-base text-white shadow-md transition-all duration-300 hover:scale-105 hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg"
						>
							🏠 Take Me Home
						</a>
					</div>

					{/* Optional helpful links */}
					<div className="mt-12 border-gray-200 border-t pt-8 dark:border-gray-700">
						<p className="mb-4 text-gray-500 text-sm dark:text-gray-400">Or try one of these popular sections:</p>
						<div className="flex flex-wrap justify-center gap-3">
							<a
								href="/home"
								className="rounded-md px-3 py-1 text-indigo-600 text-sm transition-colors hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"
							>
								Dashboard
							</a>
							<a
								href="/login"
								className="rounded-md px-3 py-1 text-indigo-600 text-sm transition-colors hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300"
							>
								Login
							</a>
						</div>
					</div>
				</div>
			</div>
		)
	}

	// For all other errors (500, etc.), use our beautiful error boundary
	return <ErrorBoundaryComponent error={error instanceof Error ? error : undefined} />
}
