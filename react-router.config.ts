import type { Config } from "@react-router/dev/config"

export default {
	future: {
		// DISABLED: These unstable flags may cause React hook errors during lazy route loading
		// unstable_viteEnvironmentApi: true,
		// unstable_splitRouteModules: true,
		// Disable aggressive dep optimization to avoid rare TDZ issues in minified chunks
		unstable_optimizeDeps: false,
		v8_middleware: true,
	},
} satisfies Config
