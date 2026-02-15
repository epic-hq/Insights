import consola from "consola";
import { PostHogProvider } from "posthog-js/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs } from "react-router";
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
} from "react-router";
import { useChangeLanguage } from "remix-i18next/react";
import { Toaster } from "sonner";
import ErrorBoundaryComponent from "~/components/ErrorBoundary";
import { NotificationProvider } from "~/contexts/NotificationContext";
import { ThemeProvider } from "~/contexts/ThemeContext";
import { ValidationViewProvider } from "~/contexts/ValidationViewContext";
import { getClientEnv } from "~/env.server";
import { loadContext } from "~/server/load-context";
import { loader as authCallbackLoader } from "./routes/auth.callback";
import { ClientHintCheck, getHints } from "./services/client-hints";
import tailwindcss from "./tailwind.css?url";

export async function loader({ context, request }: LoaderFunctionArgs) {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname === "/" && requestUrl.searchParams.has("code")) {
    return authCallbackLoader({ request, params: {} });
  }

  let lang = "en";
  let clientEnv: Record<string, unknown> | undefined;

  try {
    const loadCtx = context.get(loadContext) as {
      lang?: string;
      clientEnv?: Record<string, unknown>;
      env?: { APP_ENV: string };
      isProductionDeployment?: boolean;
      t?: (key: string) => string;
    };

    if (loadCtx?.lang) {
      lang = loadCtx.lang;
    }

    if (loadCtx?.clientEnv) {
      clientEnv = loadCtx.clientEnv;
    }
  } catch (error) {
    consola.warn(
      "[root.loader] Missing loadContext; falling back to defaults",
      error,
    );
  }

  const hints = getHints(request);

  return {
    lang,
    clientEnv: clientEnv ?? getClientEnv(),
    hints,
  };
}

// Define the links for the application
export const links: LinksFunction = () => [
  // Stylesheet
  { rel: "stylesheet", href: tailwindcss },
  // Favicon
  { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
  // Apple touch icon
  {
    rel: "apple-touch-icon",
    sizes: "180x180",
    href: "/icons/apple-touch-icon.png",
  },
  // Web app manifest
  { rel: "manifest", href: "/manifest.json" },
  // Additional icon sizes for various platforms
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "/icons/icon-32x32.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "/icons/icon-16x16.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "192x192",
    href: "/icons/icon-192x192.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "512x512",
    href: "/icons/icon-512x512.png",
  },
];

// Define meta tags for the application
export const meta: MetaFunction = () => {
  return [
    { name: "viewport", content: "width=device-width,initial-scale=1" },
    { name: "theme-color", content: "#2563eb" },
    { name: "msapplication-config", content: "/browserconfig.xml" },
    { name: "msapplication-TileColor", content: "#2563eb" },
    { name: "msapplication-TileImage", content: "/icons/icon-144x144.png" },
  ];
};

export const handle = {
  i18n: "common",
};

export default function App({ loaderData }: Route.ComponentProps) {
  const { lang, clientEnv } = loaderData;
  useChangeLanguage(lang);

  // Minimal PostHog host normalization: add https:// if missing and trim trailing slash
  const apiHost = clientEnv.POSTHOG_HOST
    ? (
        (clientEnv.POSTHOG_HOST.startsWith("http")
          ? clientEnv.POSTHOG_HOST
          : `https://${clientEnv.POSTHOG_HOST}`) as string
      ).replace(/\/+$/, "")
    : undefined;

  // Make clientEnv available globally on window.env for polyEnv pattern
  if (typeof window !== "undefined") {
    window.env = clientEnv;
  }

  return (
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
          <ValidationViewProvider>
            <Outlet />
            <Toaster />
          </ValidationViewProvider>
        </NotificationProvider>
      </PostHogProvider>
    </ThemeProvider>
  );
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { i18n } = useTranslation();
  return (
    <html
      className="overflow-y-auto overflow-x-hidden"
      lang={i18n.language}
      dir={i18n.dir()}
    >
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
  );
};

// Animated 404 experience adapted from https://codepen.io/jkantner/pen/YPwZWoy
const NotFoundFace = () => {
  const faceStyles = `
[data-404-page] *,
[data-404-page] *::before,
[data-404-page] *::after {
	border: 0;
	box-sizing: border-box;
	margin: 0;
	padding: 0;
}

[data-404-page] {
	--hue: 223;
	--sat: 10%;
	--light: hsl(var(--hue), var(--sat), 95%);
	--dark: hsl(var(--hue), var(--sat), 5%);
	--trans-dur: 0.3s;
	color-scheme: light dark;
	background-color: light-dark(var(--light), var(--dark));
	color: light-dark(var(--dark), var(--light));
	display: grid;
	font: 1em/1.5 sans-serif;
	min-height: 100vh;
	place-items: center;
	padding: clamp(1.5rem, 1rem + 2vw, 3rem);
	transition: background-color var(--trans-dur), color var(--trans-dur);
}

[data-404-page] main {
	align-items: center;
	display: grid;
	gap: clamp(1.5rem, 1.25rem + 0.75vw, 2.25rem);
	justify-items: center;
	max-inline-size: clamp(22.5rem, 65vw, 45rem);
	text-align: center;
}

[data-404-page] .face {
	display: block;
	height: auto;
	width: clamp(12rem, 40vw, 16rem);
}

[data-404-page] .face__eyes,
[data-404-page] .face__eye-lid,
[data-404-page] .face__mouth-left,
[data-404-page] .face__mouth-right,
[data-404-page] .face__nose,
[data-404-page] .face__pupil {
	animation: eyes 1s 0.3s cubic-bezier(0.65, 0, 0.35, 1) forwards;
}

[data-404-page] .face__eye-lid,
[data-404-page] .face__pupil {
	animation-duration: 4s;
	animation-delay: 1.3s;
	animation-iteration-count: infinite;
}

[data-404-page] .face__eye-lid {
	animation-name: eye-lid;
}

[data-404-page] .face__mouth-left,
[data-404-page] .face__mouth-right {
	animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
}

[data-404-page] .face__mouth-left {
	animation-name: mouth-left;
}

[data-404-page] .face__mouth-right {
	animation-name: mouth-right;
}

[data-404-page] .face__nose {
	animation-name: nose;
}

[data-404-page] .face__pupil {
	animation-name: pupil;
}

[data-404-page] h1 {
	font-size: clamp(2.5rem, 2rem + 2vw, 3.25rem);
	font-weight: 600;
	letter-spacing: clamp(0.05rem, 0.04rem + 0.06vw, 0.1rem);
	text-transform: uppercase;
}

[data-404-page] p {
	color: color-mix(in srgb, currentColor 70%, transparent);
	font-size: clamp(1rem, 0.9rem + 0.3vw, 1.15rem);
	max-width: 32ch;
}

[data-404-page] .not-found__actions {
	display: flex;
	flex-wrap: wrap;
	gap: clamp(0.75rem, 0.5rem + 1vw, 1.25rem);
	justify-content: center;
}

[data-404-page] .not-found__cta {
	appearance: none;
	background: color-mix(in srgb, currentColor 14%, transparent);
	border-radius: 999px;
	box-shadow: 0 1.25rem 1.75rem -1rem color-mix(in srgb, currentColor 35%, transparent);
	color: inherit;
	cursor: pointer;
	display: inline-flex;
	font: inherit;
	font-weight: 600;
	gap: 0.5rem;
	padding: 0.75rem 1.75rem;
	text-decoration: none;
	transition: transform var(--trans-dur), background-color var(--trans-dur), box-shadow var(--trans-dur);
}

[data-404-page] .not-found__cta:hover {
	background: color-mix(in srgb, currentColor 20%, transparent);
	box-shadow: 0 1.5rem 2rem -1rem color-mix(in srgb, currentColor 45%, transparent);
	transform: translateY(-4px);
}

[data-404-page] .not-found__cta:focus-visible {
	outline: 2px solid color-mix(in srgb, currentColor 65%, transparent);
	outline-offset: 4px;
}

[data-404-page] .not-found__cta--ghost {
	background: transparent;
	border: 2px solid color-mix(in srgb, currentColor 35%, transparent);
	box-shadow: none;
}

[data-404-page] .not-found__cta--ghost:hover {
	background: color-mix(in srgb, currentColor 12%, transparent);
	box-shadow: none;
}

@media (prefers-reduced-motion: reduce) {
	[data-404-page] *,
	[data-404-page] *::before,
	[data-404-page] *::after {
		animation-duration: 0.01ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: 0.01ms !important;
		scroll-behavior: auto !important;
	}
}

@keyframes eye-lid {
	from,
	40%,
	45%,
	to {
		transform: translateY(0);
	}
	42.5% {
		transform: translateY(17.5px);
	}
}

@keyframes eyes {
	from {
		transform: translateY(112.5px);
	}
	to {
		transform: translateY(15px);
	}
}

@keyframes pupil {
	from,
	37.5%,
	40%,
	45%,
	87.5%,
	to {
		stroke-dashoffset: 0;
		transform: translate(0, 0);
	}
	12.5%,
	25%,
	62.5%,
	75% {
		stroke-dashoffset: 0;
		transform: translate(-35px, 0);
	}
	42.5% {
		stroke-dashoffset: 35;
		transform: translate(0, 17.5px);
	}
}

@keyframes mouth-left {
	from,
	50% {
		stroke-dashoffset: -102;
	}
	to {
		stroke-dashoffset: 0;
	}
}

@keyframes mouth-right {
	from,
	50% {
		stroke-dashoffset: 102;
	}
	to {
		stroke-dashoffset: 0;
	}
}

@keyframes nose {
	from {
		transform: translate(0, 0);
	}
	to {
		transform: translate(0, 22.5px);
	}
}
`;

  return (
    <div data-404-page>
      <style>{faceStyles}</style>
      <main>
        <svg
          className="face"
          viewBox="0 0 320 380"
          width="320"
          height="380"
          aria-label="A 404 becomes a face, looks to the sides, and blinks. The 4s slide up, the 0 slides down, and then a mouth appears."
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={25}
          >
            <g className="face__eyes" transform="translate(0, 112.5)">
              <g transform="translate(15, 0)">
                <polyline
                  className="face__eye-lid"
                  points="37,0 0,120 75,120"
                />
                <polyline
                  className="face__pupil"
                  points="55,120 55,155"
                  strokeDasharray="35 35"
                />
              </g>
              <g transform="translate(230, 0)">
                <polyline
                  className="face__eye-lid"
                  points="37,0 0,120 75,120"
                />
                <polyline
                  className="face__pupil"
                  points="55,120 55,155"
                  strokeDasharray="35 35"
                />
              </g>
            </g>
            <rect
              className="face__nose"
              rx={4}
              ry={4}
              x={132.5}
              y={112.5}
              width={55}
              height={155}
            />
            <g strokeDasharray="102 102" transform="translate(65, 334)">
              <path
                className="face__mouth-left"
                d="M 0 30 C 0 30 40 0 95 0"
                strokeDashoffset={-102}
              />
              <path
                className="face__mouth-right"
                d="M 95 0 C 150 0 190 30 190 30"
                strokeDashoffset={102}
              />
            </g>
          </g>
        </svg>
        <h1>404 — Page Not Found</h1>
        <p>
          We looked everywhere but couldn&apos;t find the page you requested.
        </p>
        <div className="not-found__actions">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="not-found__cta not-found__cta--ghost"
          >
            ← Go Back
          </button>
          <a href="/home" className="not-found__cta">
            Head Home
          </a>
        </div>
      </main>
    </div>
  );
};

const ServerErrorGears = ({
  status = 500,
  headline = "Unexpected Error",
  message,
}: {
  status?: number;
  headline?: string;
  message?: string;
}) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsLoading(false), 1000);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const gearStyles = `
[data-500-page],
[data-500-page] * {
	box-sizing: border-box;
}

[data-500-page] {
	--bg-light: #eaeaea;
	--bg-dark: #0f172a;
	--stroke-light: #111111;
	--stroke-dark: #e2e8f0;
	--transition-duration: 0.6s;
	color-scheme: light dark;
	background: light-dark(var(--bg-light), var(--bg-dark));
	color: light-dark(var(--stroke-light), var(--stroke-dark));
	display: grid;
	min-height: 100vh;
	place-items: center;
	padding: clamp(1.5rem, 1rem + 2vw, 3rem);
}

[data-500-page] main {
	align-items: center;
	display: grid;
	gap: clamp(1rem, 0.75rem + 1vw, 2rem);
	justify-items: center;
	max-inline-size: clamp(22.5rem, 65vw, 44rem);
	text-align: center;
}

[data-500-page] h1 {
	font-family: "Encode Sans Semi Condensed", "Segoe UI", sans-serif;
	font-size: clamp(5rem, 4.5rem + 4vw, 9.5rem);
	font-weight: 200;
	letter-spacing: clamp(0.25rem, 0.2rem + 0.2vw, 0.5rem);
	line-height: 1;
	margin: 0 auto;
	transition: opacity var(--transition-duration) ease, transform var(--transition-duration) ease;
}

[data-500-page] h2 {
	font-family: "Encode Sans Semi Condensed", "Segoe UI", sans-serif;
	font-size: clamp(1.25rem, 1.1rem + 0.5vw, 1.75rem);
	font-weight: 300;
	margin: 0 auto;
	transition: opacity var(--transition-duration) ease, transform var(--transition-duration) ease;
}

[data-500-page] p {
	color: color-mix(in srgb, currentColor 75%, transparent);
	font-size: clamp(1rem, 0.95rem + 0.3vw, 1.15rem);
	line-height: 1.6;
	max-width: 36ch;
	transition: opacity var(--transition-duration) ease, transform var(--transition-duration) ease;
}

[data-500-page] .gears {
	position: relative;
	margin: 0 auto;
	width: 100%;
	height: 140px;
	transition: opacity var(--transition-duration) ease, transform var(--transition-duration) ease;
}

[data-500-page] .gear {
	background: light-dark(var(--stroke-light), var(--stroke-dark));
	border-radius: 50%;
	height: 120px;
	margin: 0 auto;
	position: absolute;
	top: 0;
	width: 120px;
}

[data-500-page] .gear::before {
	content: "";
	position: absolute;
	inset: 5px;
	border-radius: 50%;
	background: light-dark(var(--bg-light), var(--bg-dark));
}

[data-500-page] .gear::after {
	background: light-dark(var(--bg-light), var(--bg-dark));
	border: 5px solid light-dark(var(--stroke-light), var(--stroke-dark));
	border-radius: 50%;
	box-sizing: border-box;
	content: "";
	height: 70px;
	left: 25px;
	position: absolute;
	top: 25px;
	width: 70px;
}

[data-500-page] .gear.one {
	left: calc(50% - 190px);
	animation: gear-anticlockwise-error-stop 2s linear infinite;
}

[data-500-page] .gear.two {
	left: calc(50% - 60px);
	animation: gear-anticlockwise-error 2s linear infinite;
}

[data-500-page] .gear.three {
	left: calc(50% + 70px);
	animation: gear-clockwise-error 2s linear infinite;
}

[data-500-page] .gear .bar {
	background: light-dark(var(--stroke-light), var(--stroke-dark));
	border-radius: 6px;
	height: 30px;
	left: -15px;
	margin-top: -15px;
	position: absolute;
	top: 50%;
	width: 150px;
}

[data-500-page] .gear .bar::before {
	background: light-dark(var(--bg-light), var(--bg-dark));
	border-radius: 3px;
	content: "";
	inset: 5px;
	position: absolute;
}

[data-500-page] .gear .bar:nth-child(2) {
	transform: rotate(60deg);
}

[data-500-page] .gear .bar:nth-child(3) {
	transform: rotate(120deg);
}

[data-500-page] .server-error__actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.75rem;
	justify-content: center;
}

[data-500-page] .server-error__cta {
	align-items: center;
	appearance: none;
	background: color-mix(in srgb, currentColor 12%, transparent);
	border: 2px solid transparent;
	border-radius: 999px;
	box-shadow: 0 1.25rem 1.75rem -1rem color-mix(in srgb, currentColor 40%, transparent);
	color: inherit;
	cursor: pointer;
	display: inline-flex;
	font: inherit;
	font-weight: 600;
	gap: 0.5rem;
	padding: 0.75rem 1.75rem;
	text-decoration: none;
	transition: transform var(--transition-duration) ease, background-color var(--transition-duration) ease,
		box-shadow var(--transition-duration) ease, border-color var(--transition-duration) ease;
}

[data-500-page] .server-error__cta:hover {
	background: color-mix(in srgb, currentColor 18%, transparent);
	box-shadow: 0 1.5rem 2rem -1rem color-mix(in srgb, currentColor 50%, transparent);
	transform: translateY(-3px);
}

[data-500-page] .server-error__cta:focus-visible {
	border-color: color-mix(in srgb, currentColor 60%, transparent);
	outline: none;
}

[data-500-page] .server-error__cta--ghost {
	background: transparent;
	border-color: color-mix(in srgb, currentColor 40%, transparent);
	box-shadow: none;
}

[data-500-page] .server-error__cta--ghost:hover {
	background: color-mix(in srgb, currentColor 10%, transparent);
	box-shadow: none;
}

[data-500-page] .server-error__sr-only {
	border: 0 !important;
	clip: rect(1px, 1px, 1px, 1px);
	clip-path: inset(50%);
	height: 1px;
	margin: -1px;
	overflow: hidden;
	padding: 0;
	position: absolute !important;
	width: 1px;
	white-space: nowrap;
}

[data-500-page].loading h1,
[data-500-page].loading h2,
[data-500-page].loading p,
[data-500-page].loading .gears,
[data-500-page].loading .server-error__actions {
	opacity: 0;
	transform: translateY(-1rem);
}

[data-500-page] h1,
[data-500-page] h2,
[data-500-page] p,
[data-500-page] .gears,
[data-500-page] .server-error__actions {
	opacity: 1;
	transform: translateY(0);
}

[data-500-page].loading .gear.one,
[data-500-page].loading .gear.three {
	animation: gear-clockwise 3s linear infinite;
}

[data-500-page].loading .gear.two {
	animation: gear-anticlockwise 3s linear infinite;
}

@keyframes gear-clockwise {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

@keyframes gear-anticlockwise {
	from {
		transform: rotate(360deg);
	}
	to {
		transform: rotate(0deg);
	}
}

@keyframes gear-clockwise-error {
	0% {
		transform: rotate(0deg);
	}
	20% {
		transform: rotate(30deg);
	}
	40% {
		transform: rotate(25deg);
	}
	60% {
		transform: rotate(30deg);
	}
	100% {
		transform: rotate(0deg);
	}
}

@keyframes gear-anticlockwise-error-stop {
	0% {
		transform: rotate(0deg);
	}
	20% {
		transform: rotate(-30deg);
	}
	60% {
		transform: rotate(-30deg);
	}
	100% {
		transform: rotate(0deg);
	}
}

@keyframes gear-anticlockwise-error {
	0% {
		transform: rotate(0deg);
	}
	20% {
		transform: rotate(-30deg);
	}
	40% {
		transform: rotate(-25deg);
	}
	60% {
		transform: rotate(-30deg);
	}
	100% {
		transform: rotate(0deg);
	}
}

@media (prefers-reduced-motion: reduce) {
	[data-500-page] *,
	[data-500-page] *::before,
	[data-500-page] *::after {
		animation-duration: 0.01ms !important;
		animation-iteration-count: 1 !important;
		transform: none !important;
		transition-duration: 0.01ms !important;
	}
}
`;

  const resolvedMessage =
    message ??
    "We ran into a problem while processing your request. Please try again in a moment.";

  return (
    <div data-500-page className={isLoading ? "loading" : undefined}>
      <style>{gearStyles}</style>
      <main>
        <h1>{status}</h1>
        <h2>
          {headline} <span aria-hidden="true">:(</span>
          <span className="server-error__sr-only">Sad face</span>
        </h2>
        <p>{resolvedMessage}</p>
        <div className="gears" aria-hidden="true">
          <div className="gear one">
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
          </div>
          <div className="gear two">
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
          </div>
          <div className="gear three">
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
          </div>
        </div>
        <div className="server-error__actions">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="server-error__cta server-error__cta--ghost"
          >
            Try Again
          </button>
          <a href="/home" className="server-error__cta">
            Head Home
          </a>
        </div>
      </main>
    </div>
  );
};

export const ErrorBoundary = () => {
  const error = useRouteError();

  // For 404 errors, show the splat route style (keeping existing behavior)
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundFace />;
  }

  if (isRouteErrorResponse(error) && error.status >= 500) {
    const headline = error.statusText || "Unexpected Error";
    const errorMessage =
      typeof error.data === "string"
        ? error.data
        : "Something went wrong on our end.";
    return (
      <ServerErrorGears
        status={error.status}
        headline={headline}
        message={errorMessage}
      />
    );
  }

  // For everything else, fall back to our standard error boundary
  if (error instanceof Error) {
    return (
      <ServerErrorGears
        headline={error.name || "Unexpected Error"}
        message={error.message}
      />
    );
  }

  return (
    <ErrorBoundaryComponent
      error={error instanceof Error ? error : undefined}
    />
  );
};
