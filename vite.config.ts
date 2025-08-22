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
			"@aws-sdk/credential-provider-sso",
			"@aws-sdk/token-providers",
			"@langchain/aws",
			"ws",
		],
	},
	ssr: {
		noExternal: [],
		external: [
			"@boundaryml/baml",
			"@boundaryml/baml-darwin-arm64",
			"@aws-sdk/credential-provider-sso",
			"@aws-sdk/token-providers",
			"@langchain/aws",
			"ws",
		],
	},
	plugins: [
		tailwindcss(),
		devtoolsJson(),
		// Run the react-compiler on .tsx files only when bundling
		{
			...babel({
				filter: /\.tsx?$/,
				babelConfig: {
					presets: ["@babel/preset-typescript"],
					plugins: ["babel-plugin-react-compiler"],
				},
			}),
			apply: "build",
		},
		reactRouterDevTools(),
		reactRouter(),
		reactRouterHonoServer({
			dev: {
				exclude: [/^\/(resources)\/.+/],
			},
		}),
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
	server: {
		open: true,
		port: Number(process.env.PORT || 4280),
	},
})
