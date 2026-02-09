import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths()],
	optimizeDeps: {
		include: ["react/jsx-dev-runtime"],
		exclude: ["@boundaryml/baml", "@boundaryml/baml-darwin-arm64"],
	},
	server: {
		fs: {
			strict: false,
		},
	},
	test: {
		globals: true,
		css: true,
		includeTaskLocation: true,
		include: ["**/*.browser.test.{ts,tsx}"],
		exclude: ["app/test/integration/**", "tests/e2e/**"],
		setupFiles: ["./tests/setup.browser.tsx"],
		browser: {
			enabled: true,
			instances: [{ browser: "chromium" }],
			provider: "playwright",
		},
	},
});
