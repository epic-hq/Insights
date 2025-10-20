#!/usr/bin/env tsx
/**
 * Single Story Generator Script
 *
 * Generates a Storybook story for a single component via command line.
 *
 * Usage:
 *   npx tsx scripts/generate-story.ts <component-path> [options]
 *
 * Examples:
 *   npx tsx scripts/generate-story.ts ./app/components/ui/Button.tsx
 *   npx tsx scripts/generate-story.ts ./app/components/ui/Button.tsx --title "Components/UI/Button"
 *   npx tsx scripts/generate-story.ts ./app/features/interviews/components/InterviewCard.tsx --router
 *   npx tsx scripts/generate-story.ts ./app/components/Card.tsx --layout padded --force
 *
 * Options:
 *   --title <string>       Story title (default: auto-generated from path)
 *   --router              Component uses React Router hooks
 *   --layout <type>       Layout: centered, padded, or fullscreen (default: centered)
 *   --force               Overwrite existing story file
 *   --help                Show this help message
 */

import fs from "node:fs"
import path from "node:path"

interface StoryConfig {
	componentPath: string
	componentName: string
	title: string
	hasRouter: boolean
	layout: "centered" | "padded" | "fullscreen"
}

function generateStory(config: StoryConfig): string {
	const { componentName, title, hasRouter, layout } = config

	const imports = `import type { Meta, StoryObj } from "@storybook/react"
${hasRouter ? 'import { reactRouterParameters, withRouter } from "storybook-addon-remix-react-router"' : ""}
import { ${componentName} } from "./${componentName}"`

	const meta = `
const meta = {
	title: "${title}",
	component: ${componentName},${hasRouter ? "\n\tdecorators: [withRouter]," : ""}
	parameters: {
		layout: "${layout}",
	},
	tags: ["autodocs"],
	argTypes: {
		// Add controls here
	},
} satisfies Meta<typeof ${componentName}>

export default meta
type Story = StoryObj<typeof meta>`

	const defaultStory = hasRouter
		? `

export const Default: Story = {
	parameters: {
		reactRouter: reactRouterParameters({
			location: {
				pathParams: {},
			},
			routing: {
				path: "/",
				loader: () => ({
					// Add mock data here
				}),
			},
		}),
	},
}`
		: `

export const Default: Story = {
	args: {
		// Add default props here
	},
}`

	return `${imports}\n${meta}\n${defaultStory}\n`
}

function extractComponentName(filePath: string): string {
	const basename = path.basename(filePath, path.extname(filePath))
	return basename
}

function generateTitleFromPath(filePath: string): string {
	const parts = filePath.split(path.sep).filter((p) => p && p !== "." && p !== "app")

	// Remove filename
	parts.pop()

	// Capitalize each part
	const titleParts = parts.map((part) => {
		return part
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join("")
	})

	// Add component name at the end
	const componentName = extractComponentName(filePath)
	titleParts.push(componentName)

	return titleParts.join("/")
}

function showHelp() {
	console.log(`
📖 Storybook Story Generator

Usage:
  npx tsx scripts/generate-story.ts <component-path> [options]

Examples:
  npx tsx scripts/generate-story.ts ./app/components/ui/Button.tsx
  npx tsx scripts/generate-story.ts ./app/components/ui/Button.tsx --title "Components/UI/Button"
  npx tsx scripts/generate-story.ts ./app/features/interviews/components/InterviewCard.tsx --router
  npx tsx scripts/generate-story.ts ./app/components/Card.tsx --layout padded --force

Options:
  --title <string>       Story title (default: auto-generated from path)
  --router              Component uses React Router hooks
  --layout <type>       Layout: centered, padded, or fullscreen (default: centered)
  --force               Overwrite existing story file
  --help                Show this help message

`)
}

function parseArgs() {
	const args = process.argv.slice(2)

	if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
		showHelp()
		process.exit(0)
	}

	const componentPath = args[0]
	const options = {
		title: "",
		hasRouter: false,
		layout: "centered" as "centered" | "padded" | "fullscreen",
		force: false,
	}

	for (let i = 1; i < args.length; i++) {
		const arg = args[i]

		switch (arg) {
			case "--title":
				options.title = args[++i]
				break
			case "--router":
				options.hasRouter = true
				break
			case "--layout": {
				const layout = args[++i]
				if (layout === "centered" || layout === "padded" || layout === "fullscreen") {
					options.layout = layout
				} else {
					console.error(`❌ Invalid layout: ${layout}. Use: centered, padded, or fullscreen`)
					process.exit(1)
				}
				break
			}
			case "--force":
				options.force = true
				break
			default:
				console.error(`❌ Unknown option: ${arg}`)
				showHelp()
				process.exit(1)
		}
	}

	return { componentPath, options }
}

function main() {
	const { componentPath, options } = parseArgs()

	console.log("🚀 Generating Storybook story...\n")

	try {
		// Resolve paths
		const resolvedPath = path.resolve(process.cwd(), componentPath)
		const componentDir = path.dirname(resolvedPath)
		const componentName = extractComponentName(resolvedPath)
		const storyPath = path.join(componentDir, `${componentName}.stories.tsx`)

		// Check if component file exists
		if (!fs.existsSync(resolvedPath)) {
			console.error(`❌ Component not found: ${componentPath}`)
			console.error(`   Resolved to: ${resolvedPath}`)
			process.exit(1)
		}

		// Check if story already exists
		if (fs.existsSync(storyPath) && !options.force) {
			console.error(`❌ Story already exists: ${componentName}.stories.tsx`)
			console.error("   Use --force to overwrite")
			process.exit(1)
		}

		// Generate title if not provided
		const title = options.title || generateTitleFromPath(componentPath)

		// Generate story content
		const story = generateStory({
			componentPath,
			componentName,
			title,
			hasRouter: options.hasRouter,
			layout: options.layout,
		})

		// Write story file
		fs.writeFileSync(storyPath, story)

		console.log(`✅ Generated: ${componentName}.stories.tsx`)
		console.log(`   Path: ${storyPath}`)
		console.log(`   Title: ${title}`)
		console.log(`   Router: ${options.hasRouter ? "Yes" : "No"}`)
		console.log(`   Layout: ${options.layout}`)
		console.log("\n🎉 Done!\n")
	} catch (error) {
		console.error("❌ Error generating story:", error)
		process.exit(1)
	}
}

// Run the generator
main()
