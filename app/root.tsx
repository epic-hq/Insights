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
import { ClientOnly } from "~/components/ClientOnly"
import { NotificationProvider } from "~/contexts/NotificationContext"
import type { Route } from "./+types/root"
import { ClientHintCheck, getHints } from "./services/client-hints"
import tailwindcss from "./tailwind.css?url"

export async function loader({ context, request }: Route.LoaderArgs) {
	const { lang, clientEnv } = context
	const hints = getHints(request)

	return {
		lang,
		clientEnv,
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
	return (
		<ClientOnly fallback={<div className="flex h-screen w-screen items-center justify-center">Loading...</div>}>
			{/* <AuthProvider initialAuth={auth}> */}
			<NotificationProvider>
				<Outlet />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: We set the window.env variable to the client env */}
				<script dangerouslySetInnerHTML={{ __html: `window.env = ${JSON.stringify(clientEnv)}` }} />
			</NotificationProvider>
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
			<body className="h-full w-full">
				{/* <LanguageSwitcher /> */}
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export const ErrorBoundary = () => {
	const error = useRouteError()
	const { t } = useTranslation()
	// Constrain the generic type so we don't provide a non-existent key
	const statusCode = () => {
		if (!isRouteErrorResponse(error)) {
			return "500"
		}
		// Supported error code messages
		switch (error.status) {
			case 200:
				return "200"
			case 403:
				return "403"
			case 404:
				return "404"
			default:
				return "500"
		}
	}
	const errorStatusCode = statusCode()

	return (
		<div className="relative flex h-full min-h-screen w-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 placeholder-index sm:pt-8 sm:pb-16 dark:bg-white dark:from-blue-950 dark:to-blue-900">
			<div className="relative mx-auto max-w-[90rem] sm:px-6 lg:px-8">
				<div className="relative flex min-h-72 flex-col justify-center p-1 sm:overflow-hidden sm:rounded-2xl md:p-4 lg:p-6">
					<h1 className="w-full pb-2 text-center text-2xl text-red-600">{t(`error.${errorStatusCode}.title`)}</h1>
					<p className="w-full text-center text-lg dark:text-white">{t(`error.${errorStatusCode}.description`)}</p>
				</div>
			</div>
		</div>
	)
}
