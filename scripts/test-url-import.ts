#!/usr/bin/env npx tsx
/**
 * Test script for URL import functionality
 *
 * Usage:
 *   npx tsx scripts/test-url-import.ts
 *
 * Tests:
 * 1. Vento URL extraction and media info fetch
 * 2. Apollo URL extraction (may fail without auth)
 */

import consola from "consola"

// Test URLs
const TEST_URLS = {
	vento: "https://vento.so/view/1cfbf26a-d650-463f-9aa7-157dd2657204?utm_medium=share",
	apollo: [
		"https://app.apollo.io/#/conversation-shares/691f7790fefa720021b5c66c-691faa446fcc0c001542d9e5",
		"https://app.apollo.io/#/conversation-shares/69165daef631610019230b6e-691faa7fa046c2000dbeda47",
	],
}

type Provider = "vento" | "apollo" | "unknown"

interface MediaInfo {
	provider: Provider
	title: string
	duration?: number
	videoUrl?: string
	audioUrl?: string
	thumbnailUrl?: string
	isHls: boolean
}

function detectProvider(url: string): Provider {
	const urlLower = url.toLowerCase()
	if (urlLower.includes("vento.so")) return "vento"
	if (urlLower.includes("apollo.io")) return "apollo"
	return "unknown"
}

function extractVentoId(url: string): string | null {
	const match = url.match(/vento\.so\/view\/([a-f0-9-]+)/i)
	return match?.[1] ?? null
}

function extractApolloId(url: string): string | null {
	const match = url.match(/conversation-shares\/([a-f0-9-]+)/i)
	return match?.[1] ?? null
}

async function fetchVentoMedia(recordingId: string): Promise<MediaInfo | null> {
	try {
		consola.info(`  Fetching Vento API: /api/recording/${recordingId}`)
		const response = await fetch(`https://vento.so/api/recording/${recordingId}`)

		if (!response.ok) {
			consola.error(`  Vento API returned ${response.status}`)
			return null
		}

		const data = await response.json()

		return {
			provider: "vento",
			title: data.title || data.name || `Vento Recording ${recordingId.slice(0, 8)}`,
			duration: data.duration || data.durationSeconds,
			videoUrl: data.videoUrl || data.video_url || data.url,
			audioUrl: data.audioUrl || data.audio_url,
			thumbnailUrl: data.thumbnailUrl || data.thumbnail_url,
			isHls: (data.videoUrl || data.video_url || data.url)?.includes(".m3u8") ?? false,
		}
	} catch (error) {
		consola.error("  Failed to fetch Vento media:", error)
		return null
	}
}

async function fetchApolloMedia(shareId: string): Promise<MediaInfo | null> {
	try {
		consola.info(`  Fetching Apollo API: /api/v1/conversation_shares/${shareId}`)
		const response = await fetch(`https://app.apollo.io/api/v1/conversation_shares/${shareId}`)

		if (!response.ok) {
			consola.warn(`  Apollo API returned ${response.status}`)
			return null
		}

		const data = await response.json()
		consola.info("  Apollo API response:", JSON.stringify(data, null, 2))

		if (data.message === "Redirect required") {
			consola.warn("  Apollo requires external redirect - authentication needed")
			return null
		}

		return {
			provider: "apollo",
			title: data.title || data.name || `Apollo Recording ${shareId.slice(0, 8)}`,
			duration: data.duration,
			videoUrl: data.video_url || data.videoUrl,
			audioUrl: data.audio_url || data.audioUrl,
			isHls: data.video_url?.includes(".m3u8") ?? false,
		}
	} catch (error) {
		consola.error("  Failed to fetch Apollo media:", error)
		return null
	}
}

async function testUrl(url: string): Promise<void> {
	consola.info(`\n🔍 Testing: ${url}`)

	const provider = detectProvider(url)
	consola.info(`  Provider: ${provider}`)

	if (provider === "vento") {
		const ventoId = extractVentoId(url)
		consola.info(`  Vento ID: ${ventoId}`)

		if (ventoId) {
			const mediaInfo = await fetchVentoMedia(ventoId)
			if (mediaInfo) {
				consola.success("  ✅ Media info extracted:")
				consola.info(`     Title: ${mediaInfo.title}`)
				consola.info(`     Duration: ${mediaInfo.duration}s`)
				consola.info(`     Video URL: ${mediaInfo.videoUrl?.slice(0, 80)}...`)
				consola.info(`     Audio URL: ${mediaInfo.audioUrl?.slice(0, 80)}...`)
				consola.info(`     Is HLS: ${mediaInfo.isHls}`)
			} else {
				consola.error("  ❌ Failed to extract media info")
			}
		}
	} else if (provider === "apollo") {
		const apolloId = extractApolloId(url)
		consola.info(`  Apollo ID: ${apolloId}`)

		if (apolloId) {
			const mediaInfo = await fetchApolloMedia(apolloId)
			if (mediaInfo) {
				consola.success("  ✅ Media info extracted:")
				consola.info(`     Title: ${mediaInfo.title}`)
				consola.info(`     Video URL: ${mediaInfo.videoUrl}`)
			} else {
				consola.warn("  ⚠️  Apollo requires authentication for media access")
			}
		}
	} else {
		consola.error("  ❌ Unknown provider")
	}
}

async function main() {
	consola.info("=".repeat(60))
	consola.info("URL Import Test Script")
	consola.info("=".repeat(60))

	// Test Vento
	await testUrl(TEST_URLS.vento)

	// Test Apollo
	for (const apolloUrl of TEST_URLS.apollo) {
		await testUrl(apolloUrl)
	}

	consola.info("\n" + "=".repeat(60))
	consola.info("Test Complete")
	consola.info("=".repeat(60))
}

main().catch(console.error)
