/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly DEV_FAKE_AUTH?: string
	// add other env vars here as needed
}
interface ImportMeta {
	readonly env: ImportMetaEnv
}