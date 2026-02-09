import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		globals: true,
		css: true,
		environment: "node",
		fileParallelism: false,
		testTimeout: 30000, // Longer timeout for DB operations
		setupFiles: ["./app/test/setup/integration.setup.ts"],
		include: ["app/test/integration/**/*.test.ts"],
		coverage: {
			all: false,
			include: ["app/**"],
			exclude: ["app/test/**", "app/**/*.test.ts", "app/**/*.d.ts"],
			reporter: ["text", "json-summary", "json", "html"],
			reportOnFailure: true,
		},
	},
})
