import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"

export const getCurrentDateTool = createTool({
	id: "get-current-date",
	description:
		"REQUIRED: Call this tool whenever the user asks about today's date, current time, what day it is, or any date/time related question. DO NOT guess or use training data for dates - always call this tool. Returns accurate current date/time in the user's local timezone (auto-detected from browser).",
	inputSchema: z.object({
		timezone: z
			.string()
			.nullish()
			.describe(
				"Optional timezone override (e.g., 'America/New_York', 'Europe/London'). If not provided, uses the user's browser timezone from context."
			),
	}),
	outputSchema: z.object({
		date: z.string().describe("Current date in YYYY-MM-DD format"),
		time: z.string().describe("Current time in HH:MM:SS format"),
		dayOfWeek: z.string().describe("Day of the week (e.g., Monday, Tuesday)"),
		timestamp: z.string().describe("Full ISO 8601 timestamp"),
		timezone: z.string().describe("Timezone used"),
	}),
	execute: async (input, context?) => {
		// Debug logging
		consola.debug("getCurrentDate tool called", {
			contextTimezone: input.timezone,
			runtimeContextAvailable: !!context,
			userTimezone: context?.requestContext?.get?.("user_timezone"),
		})

		// Priority: explicit param > runtime context user_timezone > UTC fallback
		const timezone =
			input.timezone ||
			context?.requestContext?.get?.("user_timezone") ||
			context?.requestContext?.get?.("timezone") ||
			"UTC"

		consola.debug("getCurrentDate using timezone", { timezone })

		try {
			const now = new Date()
			const formatter = new Intl.DateTimeFormat("en-US", {
				timeZone: timezone,
				weekday: "long",
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
				hour12: false,
			})

			const parts = formatter.formatToParts(now)
			const getPart = (type: string) => parts.find((p) => p.type === type)?.value || ""

			const year = getPart("year")
			const month = getPart("month")
			const day = getPart("day")
			const hour = getPart("hour")
			const minute = getPart("minute")
			const second = getPart("second")
			const dayOfWeek = getPart("weekday")

			return {
				date: `${year}-${month}-${day}`,
				time: `${hour}:${minute}:${second}`,
				dayOfWeek,
				timestamp: now.toISOString(),
				timezone,
			}
		} catch {
			// Fallback to UTC if timezone is invalid
			const now = new Date()
			return {
				date: now.toISOString().split("T")[0],
				time: now.toISOString().split("T")[1].split(".")[0],
				dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
				timestamp: now.toISOString(),
				timezone: "UTC",
			}
		}
	},
})
