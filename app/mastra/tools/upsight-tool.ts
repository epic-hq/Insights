import { createTool } from "@mastra/core/tools"
import { z } from "zod"

interface GeocodingResponse {
	results: {
		latitude: number
		longitude: number
		name: string
	}[]
}
interface WeatherResponse {
	current: {
		time: string
		temperature_2m: number
		apparent_temperature: number
		relative_humidity_2m: number
		wind_speed_10m: number
		wind_gusts_10m: number
		weather_code: number
	}
}

export const signUpTool = createTool({
	id: "get-signup-data",
	description: "Get signup data",
	inputSchema: z.object({
		user_id: z.string().describe("User ID"),
	}),
	outputSchema: z.object({
		problem: z.string(),
		challenges: z.string(),
		importance: z.number(),
		ideal_solution: z.string(),
		content_types: z.string(),
		other_feedback: z.string(),
		location: z.string(),
	}),
	execute: async ({ context }) => {
		return await getSignupData(context.user_id)
	},
})

const getSignupData = async (_user_id: string) => {
	const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
	const geocodingResponse = await fetch(geocodingUrl)
	const geocodingData = (await geocodingResponse.json()) as GeocodingResponse

	if (!geocodingData.results?.[0]) {
		throw new Error(`Location '${location}' not found`)
	}

	const { latitude, longitude, name } = geocodingData.results[0]

	const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`

	const response = await fetch(weatherUrl)
	const data = (await response.json()) as WeatherResponse

	return {
		temperature: data.current.temperature_2m,
		feelsLike: data.current.apparent_temperature,
		humidity: data.current.relative_humidity_2m,
		windSpeed: data.current.wind_speed_10m,
		windGust: data.current.wind_gusts_10m,
		conditions: getWeatherCondition(data.current.weather_code),
		location: name,
	}
}
