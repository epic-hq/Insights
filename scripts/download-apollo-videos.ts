/**
 * Download videos from Apollo.io conversation share pages
 *
 * Usage:
 *   npx tsx scripts/download-apollo-videos.ts
 *
 * The script will:
 * 1. Open a browser window for you to login to Apollo.io
 * 2. Navigate to each conversation share page
 * 3. Extract and download the video
 */

import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { chromium } from "playwright";

const URLS = [
	"https://app.apollo.io/#/conversation-shares/691f7790fefa720021b5c66c-691faa446fcc0c001542d9e5",
	"https://app.apollo.io/#/conversation-shares/69165daef631610019230b6e-691faa7fa046c2000dbeda47",
	"https://app.apollo.io/#/conversation-shares/68c833b3c696380019feca4b-691faaad32677f001f12c99a",
	"https://app.apollo.io/#/conversation-shares/68e98a928f75d70015895108-68e98fb17d890a0019646595",
	"https://app.apollo.io/#/conversation-shares/68e9349f757013001957573a-68ed6712211db6001da434a1",
];

const OUTPUT_DIR = path.join("~/Downloads", "apollo-videos");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const protocol = url.startsWith("https") ? https : http;
		const file = fs.createWriteStream(outputPath);

		protocol
			.get(url, (response) => {
				// Handle redirects
				if (response.statusCode === 301 || response.statusCode === 302) {
					const redirectUrl = response.headers.location;
					if (redirectUrl) {
						file.close();
						fs.unlinkSync(outputPath);
						return downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
					}
				}

				response.pipe(file);
				file.on("finish", () => {
					file.close();
					resolve();
				});
			})
			.on("error", (err) => {
				fs.unlinkSync(outputPath);
				reject(err);
			});
	});
}

async function main() {
	console.log("🚀 Starting Apollo.io video downloader...");

	const browser = await chromium.launch({
		headless: false,
		slowMo: 100,
	});

	const context = await browser.newContext({
		viewport: { width: 1280, height: 720 },
	});

	const page = await context.newPage();

	// Navigate to Apollo.io login page first
	console.log("📝 Please login to Apollo.io in the browser window...");
	await page.goto("https://app.apollo.io/login");

	// Wait for user to login (check for authenticated state)
	console.log("⏳ Waiting for login... (script will auto-continue once logged in)");
	await page.waitForURL("**/app.apollo.io/**", { timeout: 120000 });
	await page.waitForTimeout(2000);

	console.log("✅ Login detected! Starting video downloads...\n");

	for (let i = 0; i < URLS.length; i++) {
		const url = URLS[i];
		const conversationId = url.split("/").pop() || `video-${i + 1}`;

		console.log(`\n📹 [${i + 1}/${URLS.length}] Processing: ${conversationId}`);

		try {
			await page.goto(url, { waitUntil: "networkidle" });
			await page.waitForTimeout(3000);

			// Try multiple selectors for video elements
			const videoSelectors = [
				"video",
				"video[src]",
				"source[src]",
				'iframe[src*="video"]',
				'[data-testid*="video"]',
				".video-player video",
			];

			let videoUrl: string | null = null;

			// Try to find video element
			for (const selector of videoSelectors) {
				try {
					const element = await page.$(selector);
					if (element) {
						const src = await element.getAttribute("src");
						if (src) {
							videoUrl = src;
							console.log(`   ✓ Found video with selector: ${selector}`);
							break;
						}
					}
				} catch (_e) {
					// Continue to next selector
				}
			}

			// Also check for blob URLs or network requests
			if (!videoUrl) {
				// Listen for video network requests
				const videoRequests: string[] = [];

				page.on("request", (request) => {
					const url = request.url();
					if (
						url.includes(".mp4") ||
						url.includes(".webm") ||
						url.includes(".mov") ||
						url.includes("video") ||
						request.resourceType() === "media"
					) {
						videoRequests.push(url);
					}
				});

				// Trigger video playback
				await page.click('video, [role="button"][aria-label*="play"]').catch(() => {});
				await page.waitForTimeout(2000);

				if (videoRequests.length > 0) {
					videoUrl = videoRequests[0];
					console.log("   ✓ Found video from network request");
				}
			}

			if (!videoUrl) {
				console.log("   ❌ No video found on page");

				// Take screenshot for debugging
				const screenshotPath = path.join(OUTPUT_DIR, `${conversationId}-screenshot.png`);
				await page.screenshot({ path: screenshotPath, fullPage: true });
				console.log(`   📸 Screenshot saved: ${screenshotPath}`);
				continue;
			}

			// Download video
			const extension = videoUrl.includes(".mp4") ? "mp4" : videoUrl.includes(".webm") ? "webm" : "mp4";
			const outputPath = path.join(OUTPUT_DIR, `${conversationId}.${extension}`);

			console.log(`   ⬇️  Downloading: ${videoUrl.substring(0, 100)}...`);

			if (videoUrl.startsWith("blob:")) {
				// For blob URLs, we need to download via CDP
				const client = await context.newCDPSession(page);
				await client.send("Page.setDownloadBehavior", {
					behavior: "allow",
					downloadPath: OUTPUT_DIR,
				});

				// Try to trigger download
				await page.evaluate((url) => {
					const a = document.createElement("a");
					a.href = url;
					a.download = "video.mp4";
					a.click();
				}, videoUrl);

				console.log("   ⚠️  Blob URL detected - may need manual download");
			} else {
				// Download via HTTP
				await downloadFile(videoUrl, outputPath);
				console.log(`   ✅ Saved: ${outputPath}`);
			}
		} catch (error) {
			console.error(`   ❌ Error processing ${conversationId}:`, error);
		}
	}

	console.log("\n\n✨ Done! Videos saved to:", OUTPUT_DIR);

	await browser.close();
}

main().catch(console.error);
