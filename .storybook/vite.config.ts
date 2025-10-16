import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
	plugins: [
		tsconfigPaths(),
	],
	resolve: {
		alias: {
			"~": "/app",
		},
	},
	define: {
		"import.meta.env.SUPABASE_URL": JSON.stringify("https://mock.supabase.co"),
		"import.meta.env.SUPABASE_ANON_KEY": JSON.stringify("mock-anon-key"),
	},
	css: {
		postcss: {
			plugins: [],
		},
	},
})
