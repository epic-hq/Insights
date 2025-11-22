import type { StorybookConfig } from "@storybook/react-vite"
import { mergeConfig } from "vite"

const config: StorybookConfig = {
	stories: ["../app/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
	addons: [
		// Removed incompatible addon: storybook-addon-remix-react-router
		// It requires Storybook 9.x but we're using 10.x
	],
	env: (config) => ({
		...config,
		NODE_ENV: 'development'
	}),
	framework: {
		name: "@storybook/react-vite",
		options: {
			builder: {
				viteConfigPath: ".storybook/vite.config.ts",
			},
		},
	},
	docs: {},
	typescript: {
		reactDocgen: "react-docgen-typescript",
	},
	async viteFinal(config) {
		// Remove React Router plugin which requires a config file
		if (config.plugins) {
			config.plugins = config.plugins.filter((plugin) => {
				if (plugin && typeof plugin === "object" && "name" in plugin) {
					return !plugin.name?.includes("react-router")
				}
				return true
			})
		}

		return mergeConfig(config, {
			resolve: {
				alias: {
					"~": "/app",
				},
			},
		})
	},
}

export default config;