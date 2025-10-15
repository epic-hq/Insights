import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { reactRouterDevTools } from "react-router-devtools"
import { reactRouterHonoServer } from "react-router-hono-server/dev"
import { defineConfig } from "vite"
import babel from "vite-plugin-babel"
import devtoolsJson from "vite-plugin-devtools-json"
import { iconsSpritesheet } from "vite-plugin-icons-spritesheet"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
	base: "/",
	resolve: { alias: { "@": "/src" } },
	// Externalize BAML native modules and AWS SDK to prevent bundling issues
	optimizeDeps: {
		exclude: [
			"@boundaryml/baml",
			"@boundaryml/baml-darwin-arm64",
		],
	},
	ssr: {
		noExternal: ["katex", "streamdown"],
		external: [
			"@boundaryml/baml",
			"@boundaryml/baml-darwin-arm64",
			"@aws-sdk/credential-provider-sso",
			"@aws-sdk/token-providers",
			"@langchain/aws",
			// Ensure unused heavy libs are not bundled into SSR
			"mermaid",
			"@mermaid-js/parser",
			"react-syntax-highlighter",
		],
	},
	plugins: [
		tailwindcss(),
		devtoolsJson(),
		// React Compiler disabled - uncomment and install babel-plugin-react-compiler if needed
		// {
		// 	...babel({
		// 		filter: /\.tsx?$/,
		// 		babelConfig: {
		// 			presets: ["@babel/preset-typescript"],
		// 			plugins: ["babel-plugin-react-compiler"],
		// 		},
		// 	}),
		// 	apply: "build",
		// },
		reactRouterDevTools(),
		reactRouter(),
		// reactRouterHonoServer({
		// 	dev: {
		// 		exclude: [/^\/(resources)\/.+/],
		// 	},
		// }),
		tsconfigPaths(),
		iconsSpritesheet({
			inputDir: "./resources/icons",
			outputDir: "./app/library/icon/icons",
			fileName: "icon.svg",
			withTypes: true,
			formatter: "biome",
		}),
		devtoolsJson(),
	],
	build: {
		minify: false,
		sourcemap: false,
		chunkSizeWarningLimit: 1500,
		rollupOptions: {
			output: {
				// manualChunks(id) {
				// 	if (!id.includes("node_modules")) return
				// 	// React core
				// 	if (/node_modules\/(react|react-dom)\//.test(id)) return "react"
				// 	// Router
				// 	if (/node_modules\/(@react-router|react-router|react-router-dom)\//.test(id)) return "router"
				// 	// UI libs
				// 	if (/node_modules\/(@radix-ui)\//.test(id)) return "radix"
				// 	// Charts and vis
				// 	if (/node_modules\/(recharts|cytoscape|mermaid)\//.test(id)) return "viz"
				// 	// Editors/syntax highlighting
				// 	if (/node_modules\/(remark-gfm)\//.test(id)) return "md"
				// 	// Data/services
				// 	if (/node_modules\/(@supabase)\//.test(id)) return "supabase"
				// 	if (/node_modules\/(openai|@ai-sdk|ai\/)\//.test(id)) return "ai-sdk"
				// 	if (/node_modules\/(@boundaryml)\//.test(id)) return "baml"
				// 	if (/node_modules\/(langfuse)\//.test(id)) return "langfuse"
				// 	// Mastra and friends
				// 	if (/node_modules\/(mastra|@mastra)\//.test(id)) return "mastra"
				// 	return "vendor"
				// },
			},
		},
	},
	server: {
		open: true,
		port: Number(process.env.PORT || 4280),
		allowedHosts: [
			/\.fly\.dev$/, // any *.fly.dev
			/\.ngrok-free\.app$/, // any *.ngrok-free.app
			"getupsight.com",
			"cowbird-still-routinely.ngrok-free.app",
			"localhost",
			"127.0.0.1",
			"0.0.0.0",
		],
	},
})
