import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    css: true,
    env: {
      // Load test environment variables from .env file
      // Vitest doesn't automatically load .env files, so we need to ensure
      // integration tests have access to TEST_SUPABASE_URL, etc.
    },
    coverage: {
      all: false,
      include: ["app/**"],
      reporter: ["text", "json-summary", "json", "html"],
      reportOnFailure: true,
    },
  },
});
