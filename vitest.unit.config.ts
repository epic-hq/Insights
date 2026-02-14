import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		globals: true,
		css: true,
		environment: "node",
		include: ["app/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
		exclude: ["app/test/integration/**", "tests/e2e/**", "**/*.browser.test.{ts,tsx}"],
		coverage: {
			all: false,
			include: ["app/**"],
			reporter: ["text", "json-summary", "json", "html"],
			reportOnFailure: true,
		},
	},
});
