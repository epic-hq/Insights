export const UTM_COOKIE_NAME = "utm_params"

export const UTM_PARAM_KEYS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"utm_id",
	"utm_channel",
	"utm_creative",
	"utm_adgroup",
	"utm_ref",
	"ref",
	"gclid",
	"fbclid",
] as const

export type UtmParamKey = (typeof UTM_PARAM_KEYS)[number]

export type UtmParams = Partial<Record<UtmParamKey, string>>

export function extractUtmParamsFromSearch(search: URLSearchParams | URL | string): UtmParams {
	const params = search instanceof URL ? search.searchParams : typeof search === "string" ? new URLSearchParams(search) : search
	const result: UtmParams = {}

	for (const key of UTM_PARAM_KEYS) {
		const value = params.get(key)
		if (value) {
			result[key] = value
		}
	}

	return result
}

export function hasUtmParams(params: UtmParams | null | undefined): params is UtmParams {
	if (!params) return false
	return Object.keys(params).length > 0
}

export function mergeUtmParams(...sources: Array<UtmParams | null | undefined>): UtmParams {
	return sources.reduce<UtmParams>((acc, source) => {
		if (!source) return acc
		for (const [key, value] of Object.entries(source)) {
			if (value) {
				acc[key as UtmParamKey] = value
			}
		}
		return acc
	}, {})
}
