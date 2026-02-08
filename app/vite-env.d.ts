/// <reference types="vite/client" />

interface ImportMetaEnv {
	// PostHog environment variables
	readonly VITE_PUBLIC_POSTHOG_KEY: string;
	readonly VITE_PUBLIC_POSTHOG_HOST: string;

	// other environment variables
	readonly DEV_FAKE_AUTH?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
