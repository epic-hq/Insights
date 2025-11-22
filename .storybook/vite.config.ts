import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
	plugins: [
		tsconfigPaths(),
	],
	resolve: {
		alias: {
			"~": "/app",
			"~/utils/r2.server": "/app/utils/r2.client.mock",
			"~/env.server": "/.storybook/mocks/env.server.mock.ts",
			"~/lib/supabase/client.server": "/.storybook/mocks/client.server.mock.ts",
			"node:buffer": "buffer",
			"node:crypto": "crypto-browserify",
			"node:stream": "stream-browserify",
			"process": "/.storybook/process-shim.js",
		},
	},
	define: {
		'process.env': {},
		'process.version': '"v16.0.0"',
		'process.versions': JSON.stringify({ node: '16.0.0' }),
		'process.platform': '"browser"',
		'process.env.NODE_DEBUG': 'false',
		"import.meta.env.SUPABASE_URL": JSON.stringify("https://mock.supabase.co"),
		"import.meta.env.SUPABASE_ANON_KEY": JSON.stringify("mock-anon-key"),
	},
	optimizeDeps: {
		include: ["buffer", "crypto-browserify", "stream-browserify"],
		exclude: ["~/utils/r2.server"],
	},
	css: {
		postcss: {
			plugins: [],
		},
	},
})
